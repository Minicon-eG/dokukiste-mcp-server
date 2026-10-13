import { array, object, text, type Catalog, type JsonObject, type Operation, type Policy } from './types.js';

const uploadSchema = { type: 'object', properties: {
  filename: { type: 'string', minLength: 1, maxLength: 255 },
  mimeType: { type: 'string', default: 'application/octet-stream' },
  dataBase64: { type: 'string', description: 'Base64-encoded file content; no local filesystem paths' },
}, required: ['filename', 'dataBase64'], additionalProperties: false };

function resolve(value: unknown, document: JsonObject): JsonObject {
  const source = object(value);
  if (!source.$ref) return source;
  const ref = text(source.$ref);
  if (!ref.startsWith('#/')) throw new Error('External OpenAPI references are unsupported');
  let current: unknown = document;
  for (const part of ref.slice(2).split('/')) current = object(current)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  return object(current);
}

function schema(value: unknown): JsonObject {
  const source = object(value);
  if (source.format === 'binary') return uploadSchema;
  const result: JsonObject = {};
  for (const [key, entry] of Object.entries(source)) {
    if (['example', 'xml', 'discriminator', 'nullable', 'readOnly', 'writeOnly', 'deprecated', 'externalDocs'].includes(key)) continue;
    if (key === 'format' && !['date','time','date-time','duration','email','hostname','ipv4','ipv6','uri','uri-reference','uuid','regex','byte','int32','int64','float','double'].includes(text(entry))) continue;
    if (key === '$ref') { result.$ref = text(entry).replace('#/components/schemas/', '#/$defs/'); continue; }
    if (key === 'properties' || key === '$defs') { result[key] = Object.fromEntries(Object.entries(object(entry)).map(([name, nested]) => [name, schema(nested)])); continue; }
    if (key === 'items' || key === 'additionalProperties' && typeof entry === 'object' && entry !== null) { result[key] = schema(entry); continue; }
    if (['allOf', 'oneOf', 'anyOf'].includes(key)) { result[key] = array(entry).map(schema); continue; }
    result[key] = entry;
  }
  if (source.nullable === true) return { anyOf: [result, { type: 'null' }] };
  return result;
}

function definitions(root: JsonObject, converted: JsonObject): JsonObject {
  const all = object(object(root.components ?? {}).schemas ?? {});
  const found: JsonObject = {};
  function visit(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value === null || typeof value !== 'object') return;
    const record = object(value);
    if (typeof record.$ref === 'string') {
      const key = record.$ref.replace('#/$defs/', '').replace(/~1/g, '/').replace(/~0/g, '~');
      if (!(key in found)) {
        if (!all[key]) throw new Error('OpenAPI contains an unresolved schema reference');
        found[key] = {};
        found[key] = schema(all[key]);
        visit(found[key]);
      }
    }
    Object.values(record).forEach(visit);
  }
  visit(converted);
  return found;
}

function operation(root: JsonObject, path: string, method: string, value: unknown, readOnly: boolean, tag: string, common: unknown): Operation {
  const source = object(value);
  const properties: JsonObject = {};
  const required: string[] = [];
  const queryParameters: { name: string; explode: boolean; style: string }[] = [];
  for (const location of ['path', 'query']) {
    const fields: JsonObject = {};
    const requiredFields: string[] = [];
    for (const raw of [...array(common), ...array(source.parameters)]) {
      const parameter = resolve(raw, root);
      if (parameter.in !== location) continue;
      const name = text(parameter.name);
      if (/^(apikey|access_token|authorization)$/i.test(name)) continue;
      fields[name] = { ...schema(parameter.schema ?? {}), ...(parameter.description ? { description: parameter.description } : {}) };
      if (parameter.required === true) requiredFields.push(name);
      if (location === 'query') queryParameters.push({ name, explode: parameter.explode !== false, style: text(parameter.style, 'form') });
    }
    if (Object.keys(fields).length) {
      properties[location] = { type: 'object', properties: fields, required: requiredFields, additionalProperties: false };
      if (requiredFields.length) required.push(location);
    }
  }
  let contentType: string | undefined;
  if (source.requestBody) {
    const body = resolve(source.requestBody, root);
    const content = object(body.content ?? {});
    contentType = ['application/json', 'multipart/form-data', 'application/x-www-form-urlencoded', 'application/octet-stream', 'text/plain'].find(type => content[type]);
    if (!contentType) throw new Error('Unsupported request content type');
    properties.body = schema(object(content[contentType]).schema ?? {});
    if (body.required === true) required.push('body');
  }
  // These controllers consume Request.Body; Swagger does not describe the binary payload.
  if (/^\/api\/FileUpload\/\{uploadId\}\/chunk$/i.test(path) || /^\/api\/videos\/uploads\/\{id\}\/chunks\/\{part\}$/i.test(path)) {
    properties.body = uploadSchema; contentType = 'application/octet-stream'; required.push('body');
  }
  if (!readOnly) { properties.confirm = { const: true, description: 'Explicit confirmation of the requested write operation' }; required.push('confirm'); }
  const converted = { type: 'object', properties, required, additionalProperties: false };
  return Object.freeze({
    id: method.toUpperCase() + ' ' + path, method: method.toUpperCase(), path, tag, readOnly,
    description: text(source.summary, `${method.toUpperCase()} ${path}`), contentType, queryParameters,
    inputSchema: { ...converted, $defs: definitions(root, converted) },
  });
}

export function catalog(document: unknown, policy: Policy, profile: 'standard' | 'admin'): Catalog {
  const root = object(document);
  if (!text(root.openapi).startsWith('3.0.')) throw new Error('DokuKiste must provide an OpenAPI 3.0 specification');
  const operations: Operation[] = [];
  const excluded: string[] = [];
  for (const [path, raw] of Object.entries(object(root.paths))) {
    const item = object(raw);
    for (const [method, value] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const id = method.toUpperCase() + ' ' + path;
      const entry = policy.operations[id];
      if (!entry || entry.profile !== profile) { excluded.push(id); continue; }
      operations.push(operation(root, path, method, value, entry.readOnly, entry.tag, item.parameters));
    }
  }
  return Object.freeze({ version: text(object(root.info ?? {}).version, 'unknown'), operations, excluded });
}
