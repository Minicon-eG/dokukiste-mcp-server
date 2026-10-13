export type JsonObject = Record<string, unknown>;
export interface PolicyEntry { profile: 'standard' | 'admin' | 'excluded'; tag: string; readOnly: boolean; reason: string }
export interface Policy { backendVersion: string; backendCommit: string; operations: Record<string, PolicyEntry> }
export interface Operation {
  id: string; method: string; path: string; tag: string; description: string;
  readOnly: boolean; inputSchema: JsonObject; contentType?: string;
  queryParameters: readonly { name: string; explode: boolean; style: string }[];
}
export interface Catalog { version: string; operations: readonly Operation[]; excluded: readonly string[] }
export interface Configuration {
  baseUrl: string; apiKey: string; allowWrites: boolean; schemaMode: 'live' | 'snapshot';
  timeoutMs: number; maxBytes: number;
}
function isObject(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function object(value: unknown): JsonObject {
  if (!isObject(value)) throw new Error('Expected a JSON object');
  return value;
}
export function array(value: unknown): readonly unknown[] { return Array.isArray(value) ? value : []; }
export function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }

export function problem(code: string, message: string, status?: number): Error {
  return new Error(message, { cause: Object.freeze({ code, status }) });
}
