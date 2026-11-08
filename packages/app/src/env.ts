import type { DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';
import { AGENT_IDLE_MS, AUTO_OFF, PICKUP_MS } from './contract.ts';
// The APNS_ values are set only where alerts go out (see push.ts); APNS_ORIGIN points tests at a stand-in for Apple.
export interface Env {
  AGENT: DurableObjectNamespace; REGISTRY: DurableObjectNamespace; PAGER: DurableObjectNamespace; ASSETS: Fetcher;
  APNS_KEY_P8?: string; APNS_KEY_ID?: string; APNS_TEAM_ID?: string; APNS_TOPIC?: string; APNS_ORIGIN?: string;
}
declare const __LOCAL_AUTO_OFF_MS__: number;
declare const __LOCAL_IDLE_MS__: number;
declare const __LOCAL_PICKUP_MS__: number;
declare const __BUILD_SHA__: string;
export const BUILD = __BUILD_SHA__;
// Compile-time constants, so local tests cross the clocks in real time. Zero means the production value; deploy and
// dogfood always build with zero.
function local(value: number) {
  if (!Number.isInteger(value) || value < 0) throw new Error('Invalid local clock');
  return value === 0 ? null : value;
}
const autoOff = local(__LOCAL_AUTO_OFF_MS__), idle = local(__LOCAL_IDLE_MS__), pickup = local(__LOCAL_PICKUP_MS__);
export const clocks = {
  autoOffMs: (choice: keyof typeof AUTO_OFF) => autoOff ?? AUTO_OFF[choice],
  idleMs: idle ?? AGENT_IDLE_MS,
  pickupMs: pickup ?? PICKUP_MS,
};
export async function forward(namespace: DurableObjectNamespace, id: string, path: string, init?: { method: string; headers: Headers | Record<string, string>; body?: ArrayBuffer | string }) {
  const response = await namespace.get(namespace.idFromName(id)).fetch(`https://object${path}`, init ? {
    method: init.method, headers: init.headers instanceof Headers ? Object.fromEntries(init.headers) : init.headers, body: init.body,
  } : undefined);
  return new Response(await response.arrayBuffer(), { status: response.status, headers: Object.fromEntries(response.headers) });
}
