import { readFile } from 'node:fs/promises';
import { catalog } from '../dist/openapi.js';
const product = JSON.parse(await readFile(new URL('../api/product.json', import.meta.url)));
const policy = JSON.parse(await readFile(new URL('../api/policy.json', import.meta.url)));
const snapshot = JSON.parse(await readFile(new URL('../api/openapi.json', import.meta.url)));
const url = process.env.DOKUKISTE_CONTRACT_URL;
if (!url || new URL(url).protocol !== 'https:') throw new Error('Set DOKUKISTE_CONTRACT_URL to the public HTTPS Swagger URL');
const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Contract fetch failed: HTTP ${response.status}`);
const live = await response.json();
const expected = catalog(snapshot, policy, product.profile);
const actual = catalog(live, policy, product.profile);
const changes = [];
for (const operation of expected.operations) {
  const current = actual.operations.find(item => item.id === operation.id);
  if (!current || JSON.stringify(current.inputSchema) !== JSON.stringify(operation.inputSchema)) changes.push(operation.id);
}
const unreviewed = Object.entries(live.paths).flatMap(([path, item]) => Object.keys(item).filter(method => ['get','post','put','patch','delete'].includes(method)).map(method => method.toUpperCase() + ' ' + path)).filter(id => !policy.operations[id]);
if (changes.length || unreviewed.length) {
  console.error(JSON.stringify({ changedOrRemoved: changes, unreviewed }, null, 2));
  process.exitCode = 1;
} else console.log(`${product.name}: ${actual.operations.length} reviewed operations match ${actual.version}`);
