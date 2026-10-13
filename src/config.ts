import type { Configuration } from './types.js';

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error('Limits must be positive integers');
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error('Limit is outside the supported range');
  return parsed;
}
function boolean(value: string | undefined): boolean {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') return true;
  throw new Error('Boolean options accept only true or false');
}
export function configuration(env: NodeJS.ProcessEnv = process.env): Configuration {
  if (!env.DOKUKISTE_BASE_URL || !env.DOKUKISTE_API_KEY?.trim()) throw new Error('Set DOKUKISTE_BASE_URL and DOKUKISTE_API_KEY');
  const url = new URL(env.DOKUKISTE_BASE_URL);
  if (url.username || url.password || url.search || url.hash) throw new Error('Base URL must not contain credentials, a query or a fragment');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (loopback || boolean(env.DOKUKISTE_ALLOW_HTTP)))) throw new Error('Use HTTPS, or explicitly set DOKUKISTE_ALLOW_HTTP=true for your trusted HTTP installation');
  if (env.DOKUKISTE_SCHEMA_MODE && !['live', 'snapshot'].includes(env.DOKUKISTE_SCHEMA_MODE)) throw new Error('DOKUKISTE_SCHEMA_MODE must be live or snapshot');
  return Object.freeze({
    baseUrl: url.href.replace(/\/$/, ''), apiKey: env.DOKUKISTE_API_KEY,
    allowWrites: boolean(env.DOKUKISTE_ALLOW_WRITES), schemaMode: env.DOKUKISTE_SCHEMA_MODE === 'snapshot' ? 'snapshot' : 'live',
    timeoutMs: positiveInteger(env.DOKUKISTE_TIMEOUT_MS, 30000, 300000),
    maxBytes: positiveInteger(env.DOKUKISTE_MAX_BYTES, 16 * 1024 * 1024, 128 * 1024 * 1024),
  });
}
