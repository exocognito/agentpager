import { Either, ParseResult, Schema } from 'effect';
import { Refusal, refuse, STATUS, type Token } from './contract.ts';

export const strict = { onExcessProperty: 'error' } as const;
// A refusal names each field and what is wrong with it ("nextSteps: text may not exceed 280 characters"),
// never the schema's own dump, so an agent can fix its request.
export function decode<A, I>(schema: Schema.Schema<A, I>, value: unknown): A {
  const result = Schema.decodeUnknownEither(schema, strict)(value);
  if (Either.isRight(result)) return result.right;
  const issues = ParseResult.ArrayFormatter.formatErrorSync(result.left);
  throw refuse.invalid(issues.map(i => (i.path.length ? `${i.path.map(String).join('.')}: ` : '') + i.message).join('; '));
}
export function token(): Token {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replaceAll('+', '-').replaceAll('/', '_');
}
export const iso = (ms = Date.now()) => new Date(ms).toISOString();
export const json = (value: unknown, status = 200) => Response.json(value, { status });
export function refusal(error: unknown): Response {
  if (error instanceof Refusal) return json({ error: error.tag, message: error.message, ...error.fields }, STATUS[error.tag]);
  console.error('Internal failure', error instanceof Error ? error.message : 'unknown');
  return json({ error: 'InternalError', message: 'Something went wrong on the server. Try again.' }, 500);
}
// A Durable Object can restart at any time (a deploy moves it to new code, and Cloudflare moves objects too), and the
// reads it holds then throw or reply 500. A read changes nothing, so it is sent again (`call` makes a fresh stub each
// time) when the object replied 500 or the platform marks the error retryable, never when it is overloaded. An
// answer wait pauses and holds only within the time it had left, so it still answers within its wait.
const READ_TRIES = 3;
const flag = (error: unknown, name: 'retryable' | 'overloaded') => typeof error === 'object' && error !== null && name in error && Reflect.get(error, name) === true;
export async function read(path: string, call: (path: string) => Promise<Response>): Promise<Response> {
  const url = new URL(path, 'https://object'), wait = Number(url.searchParams.get('wait'));
  const held = Number.isInteger(wait) && wait > 0, until = Date.now() + wait * 1000;
  for (let tries = 1; ; tries++) {
    let why: string;
    try {
      const response = await call(url.pathname + url.search);
      if (response.status !== 500 || tries === READ_TRIES) return response;
      why = 'InternalError';
    } catch (error) {
      if (tries === READ_TRIES || !flag(error, 'retryable') || flag(error, 'overloaded')) throw error;
      why = error instanceof Error ? error.message : 'unknown';
    }
    console.warn('Reading again', url.pathname.split('/')[1], why);
    await new Promise(r => setTimeout(r, held ? Math.min(1000 * tries, Math.max(0, until - Date.now())) : 1000 * tries));
    if (held) {
      const left = Math.floor((until - Date.now()) / 1000);
      if (left > 0) url.searchParams.set('wait', String(left)); else url.searchParams.delete('wait');
    }
  }
}
export async function body(request: Request): Promise<unknown> {
  try {
    const bytes = await request.arrayBuffer();
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw refuse.invalid('Send a JSON object encoded as valid UTF-8.'); }
}
export const Empty = Schema.Struct({}).annotations({ parseOptions: strict });
export async function emptyBody(request: Request) {
  const text = await request.text();
  if (text !== '') { try { decode(Empty, JSON.parse(text)); } catch { throw refuse.invalid('This operation takes no fields.'); } }
}

// Keys and link codes are stored only as SHA-256 hex digests. Hash before a transaction (digest is async);
// compare inside it with the platform's constant-time comparison.
export async function sha256(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
interface TimingSafe { timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean }
function timingSafe(subtle: object): subtle is TimingSafe { return 'timingSafeEqual' in subtle && typeof subtle.timingSafeEqual === 'function'; }
const bytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], pair => parseInt(pair, 16));
export function sameDigest(supplied: string | null, stored: string | null): boolean {
  if (supplied === null || stored === null || supplied.length !== 64 || stored.length !== 64) return false;
  const subtle = crypto.subtle;
  if (!timingSafe(subtle)) throw new Error('crypto.subtle.timingSafeEqual is unavailable');
  return subtle.timingSafeEqual(bytes(supplied), bytes(stored));
}
