import { Schema } from 'effect';
import type { Env } from './env.ts';
import { PICKUP_MS } from './contract.ts';
import { letter, type Payload as BriefCard } from '../../contract/brief.ts';

// Alerts through Apple's push service (C17::get-paged). The phone gives each pager it holds its device token, and
// the pager alerts that phone when its agent asks or acknowledges. The token goes when the pager ends.
// Apple's service speaks HTTP/2 only: a deployed Worker reaches it, local workerd does not, so a local server keeps
// tokens but its alerts fail. An alert that fails is logged and never refuses the agent's call.
export const PushTarget = Schema.Struct({
  token: Schema.String.pipe(Schema.pattern(/^[0-9a-f]{64,200}$/)),
  environment: Schema.Literal('sandbox', 'production'),
});
export type PushTarget = typeof PushTarget.Type;

export type Alert = {
  title: string; body: string; timeSensitive: boolean; expiresAt: string; collapseId: string; thread: string;
  data: Record<string, string>;
};
export type Outcome = 'sent' | 'gone' | 'failed' | 'off';

const HOSTS = { sandbox: 'https://api.sandbox.push.apple.com', production: 'https://api.push.apple.com' } as const;
// Apple refuses a provider token older than an hour and one renewed more often than every 20 minutes.
const RENEW_MS = 50 * 60_000;
let signed: { jwt: string; at: number; keyId: string } | null = null;

const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

// The key may arrive as a PEM with or without its line breaks; only the base64 body matters.
async function providerToken(p8: string, keyId: string, teamId: string) {
  if (signed && signed.keyId === keyId && Date.now() - signed.at < RENEW_MS) return signed.jwt;
  const der = Uint8Array.from(atob(p8.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const at = Date.now();
  const unsigned = `${encode({ alg: 'ES256', kid: keyId })}.${encode({ iss: teamId, iat: Math.floor(at / 1000) })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  signed = { jwt: `${unsigned}.${base64url(signature)}`, at, keyId };
  return signed.jwt;
}

export async function alert(env: Env, to: PushTarget, a: Alert): Promise<Outcome> {
  if (!env.APNS_KEY_P8 || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_TOPIC) return 'off';
  try {
    const jwt = await providerToken(env.APNS_KEY_P8, env.APNS_KEY_ID, env.APNS_TEAM_ID);
    const payload = {
      aps: {
        alert: { title: a.title, body: a.body }, sound: 'default', 'thread-id': a.thread, 'content-available': 1,
        'interruption-level': a.timeSensitive ? 'time-sensitive' : 'active',
      },
      ...a.data,
    };
    const response = await fetch(`${env.APNS_ORIGIN ?? HOSTS[to.environment]}/3/device/${to.token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`, 'apns-topic': env.APNS_TOPIC, 'apns-push-type': 'alert', 'apns-priority': '10',
        // Never delivered after the pager would have ended.
        'apns-expiration': String(Math.floor(Date.parse(a.expiresAt) / 1000)), 'apns-collapse-id': a.collapseId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return 'sent';
    const reason = await response.json().then((b: { reason?: string }) => b.reason ?? '', () => '');
    console.error(`APNs refused an alert: ${response.status} ${reason}`);
    if (reason === 'ExpiredProviderToken') signed = null;
    return response.status === 410 || reason === 'BadDeviceToken' || reason === 'DeviceTokenNotForTopic' ? 'gone' : 'failed';
  } catch (error) {
    console.error('APNs alert failed', error instanceof Error ? error.name : 'unknown');
    return 'failed';
  }
}

// The warning when no agent has collected an answer: who, where and what, so the owner knows which agent to go to.
export function pickupBody(agent: { app: string; project: string; machine?: string }, title: string) {
  const who = `${agent.app}${agent.machine ? ` on ${agent.machine}` : ''} (${agent.project})`;
  return `${who} hasn’t picked up your answer to “${title}” after ${PICKUP_MS / 60_000} min. AgentPager can’t reach it: it may be asleep, closed or disconnected. Check in with it directly.`;
}

// The alert body: the question, then its detail and the recommended option, which show when the alert is expanded.
// Cut to 600 characters so the payload stays under Apple's 4 KB.
export function questionBody(q: { title: string; detail?: string; card: BriefCard }) {
  const recommended = q.card.options.find(o => o.number === q.card.recommended);
  const lines = [q.title, q.detail, recommended && `Recommended: ${letter(recommended.number)}. ${recommended.title}`].filter(Boolean);
  const characters = Array.from(lines.join('\n'));
  return characters.length > 600 ? characters.slice(0, 599).join('') + '…' : characters.join('');
}
