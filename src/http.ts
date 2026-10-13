import { object, type Configuration, type JsonObject, type Operation } from './types.js';

export async function bytes(response: Response, max: number): Promise<Buffer> {
  if (Number(response.headers.get('content-length') ?? 0) > max) { await response.body?.cancel(); throw new Error('Response exceeds DOKUKISTE_MAX_BYTES'); }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) { await reader.cancel(); throw new Error('Response exceeds DOKUKISTE_MAX_BYTES'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

function file(value: unknown, max: number): { blob: Blob; filename: string } {
  const input = object(value);
  if (typeof input.filename !== 'string' || /[\r\n/\\]/.test(input.filename)) throw new Error('Invalid upload filename');
  if (typeof input.dataBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.dataBase64)) throw new Error('Invalid base64 upload');
  if (input.dataBase64.length > Math.ceil(max / 3) * 4) throw new Error('Upload exceeds DOKUKISTE_MAX_BYTES');
  const content = Buffer.from(input.dataBase64, 'base64');
  if (content.byteLength > max) throw new Error('Upload exceeds DOKUKISTE_MAX_BYTES');
  return { blob: new Blob([new Uint8Array(content)], { type: typeof input.mimeType === 'string' ? input.mimeType : 'application/octet-stream' }), filename: input.filename };
}

function encodedBody(operation: Operation, input: unknown, max: number): BodyInit | undefined {
  if (input === undefined) return undefined;
  if (operation.contentType === 'application/octet-stream') return file(input, max).blob;
  if (operation.contentType === 'multipart/form-data') {
    const form = new FormData();
    let total = 0;
    function bounded(size: number): void { total += size + 512; if (total > max) throw new Error('Multipart request exceeds DOKUKISTE_MAX_BYTES'); }
    function append(name: string, value: unknown): void {
      if (Array.isArray(value)) { value.forEach(item => append(name, item)); return; }
      if (value !== null && typeof value === 'object' && 'dataBase64' in value) { const upload = file(value, max); bounded(upload.blob.size); form.append(name, upload.blob, upload.filename); return; }
      const encoded = typeof value === 'string' ? value : JSON.stringify(value);
      bounded(Buffer.byteLength(encoded));
      form.append(name, encoded);
    }
    Object.entries(object(input)).forEach(([key, value]) => append(key, value));
    return form;
  }
  if (operation.contentType === 'application/x-www-form-urlencoded') {
    return new URLSearchParams(Object.entries(object(input)).map(([name, value]) => [name, String(value)]));
  }
  return operation.contentType === 'text/plain' ? String(input) : JSON.stringify(input);
}

export function requestUrl(config: Configuration, operation: Operation, args: JsonObject): URL {
  const parameters = object(args.path ?? {});
  const path = operation.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = parameters[name];
    if (value === undefined || value === null) throw new Error('Missing path parameter');
    const segment = String(value);
    if (segment === '.' || segment === '..' || /[\/\\\x00-\x1f]/.test(segment)) throw new Error('Unsafe path parameter');
    return encodeURIComponent(segment);
  });
  const base = new URL(config.baseUrl);
  const url = new URL(config.baseUrl + path);
  if (url.origin !== base.origin) throw new Error('Cross-origin API request rejected');
  for (const [name, value] of Object.entries(object(args.query ?? {}))) {
    if (value === undefined || value === null) continue;
    if (/^(apikey|access_token|authorization)$/i.test(name)) throw new Error('Authentication is configured on the server, not in tool inputs');
    const parameter = operation.queryParameters.find(item => item.name === name);
    if (Array.isArray(value)) {
      if (parameter?.explode === false) { url.searchParams.set(name, value.map(String).join(parameter.style === 'spaceDelimited' ? ' ' : parameter.style === 'pipeDelimited' ? '|' : ',')); }
      else value.forEach(item => url.searchParams.append(name, String(item)));
    } else if (typeof value === 'object') { throw new Error('Object-valued query parameters are unsupported'); }
    else url.searchParams.set(name, String(value));
  }
  return url;
}

export function api(config: Configuration, fetcher: typeof fetch = fetch) {
  async function fetchResponse(url: URL, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const response = await fetcher(url, { ...init, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { 'X-API-Key': config.apiKey, Accept: 'application/json', ...init.headers } });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`DokuKiste returned HTTP ${response.status}. Check API-key scopes, permissions, enabled features and request parameters.`); }
    return response;
  }
  return Object.freeze({
    async schema(): Promise<unknown> {
      const response = await fetchResponse(new URL(config.baseUrl + '/swagger/v1/swagger.json'), {});
      return JSON.parse((await bytes(response, 16 * 1024 * 1024)).toString('utf8'));
    },
    async execute(operation: Operation, args: JsonObject, signal?: AbortSignal) {
      if (!operation.readOnly && (!config.allowWrites || args.confirm !== true)) throw new Error('Writes require DOKUKISTE_ALLOW_WRITES=true and confirm=true');
      const body = encodedBody(operation, args.body, config.maxBytes);
      if (typeof body === 'string' && Buffer.byteLength(body) > config.maxBytes) throw new Error('Request exceeds DOKUKISTE_MAX_BYTES');
      const headers = operation.contentType && operation.contentType !== 'multipart/form-data' ? { 'Content-Type': operation.contentType } : undefined;
      const response = await fetchResponse(requestUrl(config, operation, args), { method: operation.method, body, headers }, signal);
      const data = await bytes(response, config.maxBytes);
      const mimeType = response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
      if (data.length === 0) return { kind: 'json' as const, value: { status: response.status } };
      if (mimeType.includes('json')) return { kind: 'json' as const, value: JSON.parse(data.toString('utf8')) };
      if (mimeType.startsWith('text/')) return { kind: 'json' as const, value: data.toString('utf8') };
      return { kind: 'binary' as const, data, mimeType };
    },
  });
}
