import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { configuration } from '../dist/config.js';
import { catalog } from '../dist/openapi.js';
import { operations } from '../dist/catalog.js';
import { api, requestUrl } from '../dist/http.js';

const root = new URL('../', import.meta.url);
const product = JSON.parse(await readFile(new URL('api/product.json', root)));
const policy = JSON.parse(await readFile(new URL('api/policy.json', root)));
const snapshot = JSON.parse(await readFile(new URL('api/openapi.json', root)));
const contract = catalog(snapshot, policy, product.profile);
const prefix = product.profile === 'admin' ? 'dokukiste_admin' : 'dokukiste';
const key = 'test-key-do-not-disclose';
const config = configuration({ DOKUKISTE_BASE_URL: 'http://127.0.0.1:12345', DOKUKISTE_API_KEY: key, DOKUKISTE_SCHEMA_MODE: 'snapshot' });

test('configuration requires an instance and key, validates limits and protects credentials in URLs', () => {
  assert.throws(() => configuration({}), /Set DOKUKISTE/);
  assert.throws(() => configuration({ DOKUKISTE_BASE_URL: 'https://user:password@example.test', DOKUKISTE_API_KEY: key }), /credentials/);
  assert.throws(() => configuration({ DOKUKISTE_BASE_URL: 'http://example.test', DOKUKISTE_API_KEY: key }), /HTTPS/);
  assert.throws(() => configuration({ DOKUKISTE_BASE_URL: 'https://example.test', DOKUKISTE_API_KEY: key, DOKUKISTE_TIMEOUT_MS: '0' }), /range/);
  assert.throws(() => configuration({ DOKUKISTE_BASE_URL: 'https://example.test', DOKUKISTE_API_KEY: key, DOKUKISTE_ALLOW_WRITES: 'yes' }), /true or false/);
});

test('profiles are disjoint and exclude browser authentication and provider callbacks', () => {
  const standard = catalog(snapshot, policy, 'standard').operations;
  const admin = catalog(snapshot, policy, 'admin').operations;
  const standardIds = new Set(standard.map(operation => operation.id));
  assert.ok(standard.length > 600 && admin.length > 400);
  assert.ok(admin.every(operation => !standardIds.has(operation.id)));
  assert.ok(standard.every(operation => !['Admin', 'ApiKeys', 'Users', 'Security'].includes(operation.tag)));
  assert.ok([...standard, ...admin].every(operation => !['POST /api/videos/{id}/playback', 'GET /api/videos/{id}/media/{file}'].includes(operation.id)));
  assert.ok([...standard, ...admin].every(operation => !['Account', 'AuthSso', 'MailOAuth', 'GitHubWebhook', 'GetMyInvoicesWebhook'].includes(operation.tag)));
});

test('every reviewed request schema compiles and all convenient tools refer to current operations', () => {
  const registry = operations(contract, true);
  for (const operation of registry.list) {
    try { registry.validate(operation, {}); }
    catch (error) { assert.match(error.message, /^Invalid operation input:/, operation.id); }
  }
  for (const id of Object.values(product.tools)) assert.ok(registry.find(id));
});

test('read-only operation discovery hides writes, including legacy mutating GETs, and preserves POST search', () => {
  const standard = catalog(snapshot, policy, 'standard');
  const registry = operations(standard, false);
  assert.ok(registry.find('POST /api/documents/search').readOnly);
  assert.throws(() => registry.find('POST /api/documents/upload'), /unavailable/);
  assert.throws(() => registry.find('GET /api/FileUpload/start'), /unavailable/);
  assert.throws(() => registry.find('GET /api/ApiKeys'), /unavailable/);
});

test('route parameters cannot escape the reviewed endpoint and query arrays retain repeated values', () => {
  const operation = catalog(snapshot, policy, 'standard').operations.find(item => item.id === 'GET /api/documents/detail/{id}');
  assert.throws(() => requestUrl(config, operation, { path: { id: '../Admin' } }), /Unsafe/);
  assert.throws(() => requestUrl(config, operation, { path: { id: '..' } }), /Unsafe/);
  assert.throws(() => requestUrl(config, operation, { path: { id: 'safe' }, query: { apikey: 'injected' } }), /Authentication/);
  const url = requestUrl(config, { ...operation, queryParameters: [{ name: 'tags', explode: true, style: 'form' }] }, { path: { id: 'a b' }, query: { tags: ['one', 'two'] } });
  assert.equal(url.pathname, '/api/documents/detail/a%20b');
  assert.deepEqual(url.searchParams.getAll('tags'), ['one', 'two']);
});

test('writes and confirmation are checked before any HTTP request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('{}'); };
  const write = contract.operations.find(item => !item.readOnly);
  await assert.rejects(api(config, fetcher).execute(write, { confirm: true }), /Writes require/);
  await assert.rejects(api({ ...config, allowWrites: true }, fetcher).execute(write, {}), /Writes require/);
  assert.equal(calls, 0);
});

test('HTTP status errors omit response bodies and credentials; redirects are rejected; response size is bounded', async () => {
  const read = contract.operations.find(item => item.readOnly && !Object.keys(item.inputSchema.properties).length);
  let seen;
  const fetcher = async (_url, init) => { seen = init; return new Response(key + ' customer password', { status: 403 }); };
  await assert.rejects(api(config, fetcher).execute(read, {}), error => error.message.includes('HTTP 403') && !error.message.includes(key));
  assert.equal(seen.headers['X-API-Key'], key);
  assert.equal(seen.headers.Authorization, undefined);
  assert.equal(seen.redirect, 'error');
  await assert.rejects(api({ ...config, maxBytes: 3 }, async () => new Response('1234')).execute(read, {}), /exceeds/);
});

test('raw chunks and multipart uploads send binary bytes rather than JSON/base64 wrappers', async () => {
  const standard = catalog(snapshot, policy, 'standard');
  const raw = standard.operations.find(item => item.id === 'POST /api/FileUpload/{uploadId}/chunk');
  const upload = standard.operations.find(item => item.id === 'POST /api/documents/upload');
  const file = { filename: 'document.pdf', mimeType: 'application/pdf', dataBase64: Buffer.from('%PDF-test').toString('base64') };
  const captured = [];
  const fetcher = async (_url, init) => { captured.push(init); return new Response('{}', { headers: { 'content-type': 'application/json' } }); };
  const client = api({ ...config, allowWrites: true }, fetcher);
  await client.execute(raw, { path: { uploadId: 'upload-id' }, query: { chunkIndex: 0 }, body: file, confirm: true });
  assert.equal(await captured[0].body.text(), '%PDF-test');
  assert.equal(captured[0].headers['Content-Type'], 'application/octet-stream');
  await client.execute(upload, { body: { file }, confirm: true });
  assert.equal(await captured[1].body.get('file').text(), '%PDF-test');
  assert.equal(captured[1].headers['Content-Type'], undefined);
  await assert.rejects(client.execute(raw, { path: { uploadId: 'id' }, body: { ...file, filename: '../secret' }, confirm: true }), /filename/);
});

async function host(writeMode, handler, work) {
  const received = [];
  const server = httpServer((req, res) => {
    received.push({ url: req.url, method: req.method, key: req.headers['x-api-key'], authorization: req.headers.authorization });
    if (req.url === '/swagger/v1/swagger.json') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(snapshot)); return; }
    handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const transport = new StdioClientTransport({ command: process.execPath, args: ['dist/index.js'], cwd: root.pathname,
    env: { DOKUKISTE_BASE_URL: `http://127.0.0.1:${address.port}`, DOKUKISTE_API_KEY: key,
      DOKUKISTE_ALLOW_WRITES: String(writeMode), DOKUKISTE_SCHEMA_MODE: 'live' }, stderr: 'pipe' });
  const client = new Client({ name: 'dokukiste-product-tests', version: '1.0.0' });
  try { await client.connect(transport); await work(client, received); }
  finally { await client.close(); await new Promise(resolve => server.close(resolve)); }
}

test('real MCP stdio handshake, discovery, live schemas and authenticated HTTP roundtrip', async () => {
  await host(false, (_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'doc-1', version: '13.80.0' })); }, async (client, received) => {
    const listed = await client.listTools();
    assert.ok(listed.tools.some(tool => tool.name === prefix + '_find_operations'));
    const capabilities = await client.callTool({ name: prefix + '_capabilities', arguments: {} });
    assert.equal(capabilities.structuredContent.result.allowWrites, false);
    const found = await client.callTool({ name: prefix + '_find_operations', arguments: { query: product.profile === 'standard' ? 'GET /api/documents/detail' : 'GET /api/Admin/Version' } });
    assert.ok(found.structuredContent.result.total > 0);
    const id = product.profile === 'standard' ? 'GET /api/documents/detail/{id}' : 'GET /api/Admin/Version';
    const arguments_ = product.profile === 'standard' ? { path: { id: 'doc-1' } } : {};
    const output = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: id, arguments: arguments_ } });
    assert.equal(output.isError, undefined);
    assert.equal(output.structuredContent.result.id, 'doc-1');
    assert.ok(received.every(request => request.key === key && !request.authorization));
    const count = received.length;
    const forbidden = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: product.profile === 'standard' ? 'GET /api/ApiKeys' : 'GET /api/documents', arguments: {} } });
    assert.equal(forbidden.isError, true);
    assert.equal(forbidden.structuredContent.error.code, 'OPERATION_UNAVAILABLE');
    assert.equal(received.length, count);
    const unknown = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: 'GET https://other.test', arguments: {} } });
    assert.equal(unknown.isError, true);
    assert.equal(received.length, count);
  });
});

test('MCP input validation prevents malformed requests before HTTP; binary downloads are embedded resources', async () => {
  const target = contract.operations.find(operation => operation.id === (product.profile === 'standard' ? 'GET /api/documents/{id}/download' : 'GET /health/live'));
  const arguments_ = Object.keys(target.inputSchema.properties).includes('path') ? { path: { id: 'doc-1' } } : {};
  await host(false, (_req, res) => { res.setHeader('content-type', 'application/pdf'); res.end('%PDF-test'); }, async (client, received) => {
    const count = received.length;
    const invalid = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: target.id, arguments: { ...arguments_, unexpected: 'secret' } } });
    assert.equal(invalid.isError, true);
    assert.equal(received.length, count);
    const output = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: target.id, arguments: arguments_ } });
    assert.equal(output.content[1].type, 'resource');
    assert.equal(Buffer.from(output.content[1].resource.blob, 'base64').toString(), '%PDF-test');
  });
});

test('MCP errors expose stable sanitized HTTP status metadata', async () => {
  const id = product.profile === 'standard' ? 'GET /api/documents/detail/{id}' : 'GET /api/Admin/Version';
  const arguments_ = product.profile === 'standard' ? { path: { id: 'document' } } : {};
  await host(false, (_req, res) => { res.statusCode = 403; res.end(key + ' secret body'); }, async client => {
    const output = await client.callTool({ name: prefix + '_call_operation', arguments: { operationId: id, arguments: arguments_ } });
    assert.equal(output.isError, true);
    assert.equal(output.structuredContent.error.code, 'HTTP_ERROR');
    assert.equal(output.structuredContent.error.status, 403);
    assert.ok(!JSON.stringify(output).includes(key));
    assert.ok(!JSON.stringify(output).includes('secret body'));
  });
});

test('snapshot preserves request properties named examples', () => {
 const operation = catalog(snapshot, policy, 'standard').operations.find(item => item.id === 'POST /api/assistant/generate-regex');
 const referenced = operation.inputSchema.properties.body.$ref.replace('#/$defs/', '');
 assert.ok(operation.inputSchema.$defs[referenced].properties.examples);
});
