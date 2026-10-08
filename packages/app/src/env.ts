import type { DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';
import { LIFETIMES, PAIRING_WINDOW_MS, RETENTION_MS, type Lifetime } from './contract.ts';
export interface Env { SESSION: DurableObjectNamespace; REGISTRY: DurableObjectNamespace; ASSETS: Fetcher }
declare const __LOCAL_UNPAIRED_MS__: number;
declare const __LOCAL_SESSION_MS__: number;
declare const __LOCAL_RETAIN_MS__: number;
declare const __BUILD_SHA__: string;
export const BUILD = __BUILD_SHA__;
// Compile-time constants. Zero means the production value; deploy and dogfood always build with zero.
function local(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new Error('Invalid local lifetime');
  return value === 0 ? null : value;
}
const pairingWindow = local(__LOCAL_UNPAIRED_MS__), lifetime = local(__LOCAL_SESSION_MS__), retain = local(__LOCAL_RETAIN_MS__);
export const lifetimes = {
  windowMs: pairingWindow ?? PAIRING_WINDOW_MS,
  retainMs: retain ?? RETENTION_MS,
  lifetimeMs: (choice: Lifetime) => lifetime ?? LIFETIMES[choice],
};
export async function forward(namespace: DurableObjectNamespace, id: string, path: string, init?: { method: string; headers: Headers | Record<string, string>; body?: ArrayBuffer | string }) {
  const response = await namespace.get(namespace.idFromName(id)).fetch(`https://object${path}`, init ? {
    method: init.method, headers: init.headers instanceof Headers ? Object.fromEntries(init.headers) : init.headers, body: init.body,
  } : undefined);
  return new Response(await response.arrayBuffer(), { status: response.status, headers: Object.fromEntries(response.headers) });
}
