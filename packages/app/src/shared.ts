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
