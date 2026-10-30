import { Either, Schema } from 'effect';

// The HTTP API is the binary's transport (the server's /start documents it). A reply is decoded with its route's
// schema from the server's contract, so a page that isn't AgentPager's (a proxy, a Wi-Fi sign-in page) is never taken
// for one: it is `NotUnderstood`. A refusal is the server's {error, message, ...}. A call that never connected is
// `Unreachable`, and nothing was sent; one that timed out or lost its connection is `NoReply`, and like `NotUnderstood`
// it may have reached the owner.
export type Failure = { ok: false; status: number; error: string; message: string; reason?: string };
export type Reply<A> = { ok: true; value: A } | Failure;

// A timeout or a dropped connection can come after the request went out; anything else (no such host, refused, a bad
// address) stopped before it.
export function transportFailure(e: unknown): Failure {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause : e, why = cause instanceof Error ? cause.message : 'unknown';
  if (e instanceof Error && e.name === 'TimeoutError') return { ok: false, status: 0, error: 'NoReply', message: 'timed out' };
  if (cause instanceof Error && 'code' in cause && ['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(String(cause.code))) return { ok: false, status: 0, error: 'NoReply', message: 'the connection closed' };
  return { ok: false, status: 0, error: 'Unreachable', message: /refused/i.test(why) ? 'connection refused' : why };
}

export async function call<A, I>(schema: Schema.Schema<A, I>, server: string, method: string, route: string, opts: { key?: string; data?: unknown; timeoutMs?: number } = {}): Promise<Reply<A>> {
  let response: Response, text: string;
  try {
    response = await fetch(server + route, {
      method, signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      headers: { 'content-type': 'application/json', ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}) },
      body: opts.data === undefined ? undefined : JSON.stringify(opts.data),
    });
    text = await response.text();
  } catch (e) { return transportFailure(e); }
  let value: unknown = null;
  try { value = JSON.parse(text); } catch { /* not JSON */ }
  if (response.ok) {
    const decoded = Schema.decodeUnknownEither(schema)(value);
    if (Either.isRight(decoded)) return { ok: true, value: decoded.right };
    return { ok: false, status: response.status, error: 'NotUnderstood', message: `HTTP ${response.status}, ${response.headers.get('content-type')?.split(';')[0] || 'no content type'}` };
  }
  const field = (k: string) => typeof value === 'object' && value !== null && k in value ? String(Reflect.get(value, k)) : undefined;
  return { ok: false, status: response.status, error: field('error') ?? `HTTP${response.status}`, message: field('message') ?? `The server answered ${response.status}.`, reason: field('reason') };
}
