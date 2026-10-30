// The HTTP API is the binary's transport (the server's /start documents it). A refusal is the server's
// {error, message, ...}; a request that never got there is `unreachable`.
export type Reply = { ok: true; value: unknown } | { ok: false; status: number; error: string; message: string; reason?: string } | { ok: false; status: 0; error: 'Unreachable'; message: string };

export async function call(server: string, method: string, route: string, opts: { key?: string; data?: unknown; timeoutMs?: number } = {}): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch(server + route, {
      method, signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      headers: { 'content-type': 'application/json', ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}) },
      body: opts.data === undefined ? undefined : JSON.stringify(opts.data),
    });
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : e instanceof Error ? e.message : 'unknown';
    return { ok: false, status: 0, error: 'Unreachable', message: /refused/i.test(cause) ? 'connection refused' : cause };
  }
  let value: unknown = null;
  try { value = await response.json(); } catch { /* not JSON */ }
  if (response.ok) return { ok: true, value };
  const field = (k: string) => typeof value === 'object' && value !== null && k in value ? String(Reflect.get(value, k)) : undefined;
  return { ok: false, status: response.status, error: field('error') ?? `HTTP${response.status}`, message: field('message') ?? `The server answered ${response.status}.`, reason: field('reason') };
}

export const get = (value: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((v, k) => typeof v === 'object' && v !== null && k in v ? Reflect.get(v, k) : undefined, value);
