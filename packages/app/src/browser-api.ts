import { Effect, Layer, Schema } from 'effect';
import { CardApi, HomeApi, Unreachable, type CardError } from '../../blueprint/design/effects/cards.ts';
import * as E from '../../blueprint/design/effects/session.ts';
import * as S from '../../blueprint/design/schemas/exchange.ts';
import { decode, token as newToken } from './shared.ts';

const Live = Schema.Struct({ kind: Schema.Literal('live'), paired: Schema.Boolean, sessionId: S.Token, phoneKey: S.Token, name: S.SessionName, expiresAt: Schema.NullOr(S.Timestamp) });
type Held = typeof Live.Type;
const Pending = Schema.Struct({ phoneKey: S.Token, expiresAt: S.Timestamp });
const ErrorReply = Schema.Struct({ error: Schema.String, reason: Schema.optional(Schema.String), sessionName: Schema.optional(S.SessionName), expiredAt: Schema.optional(S.Timestamp), endedAt: Schema.optional(S.Timestamp), endedBy: Schema.optional(Schema.Literal('owner', 'agent')), finishedAt: Schema.optional(S.Timestamp), receipt: Schema.optional(S.Receipt) });
const prefix = 'agentpager.session.';
const connectPrefix = 'agentpager.connect.';
const linkPrefix = 'agentpager.link.';
const claimPrefix = 'agentpager.claim.';
const endedPrefix = 'agentpager.ended.';
// Every membership mutation (discovery, read, retirement) shares one short cross-tab
// commit lock. Network requests run outside it; a reply owns no right to restore data.
const membership = <A>(fn: () => A) => navigator.locks.request('agentpager.membership', fn);
export function held(id: string): Held | null { const raw = localStorage.getItem(prefix + id); return raw ? decode(Live, JSON.parse(raw)) : null; }
function save(record: Held) { localStorage.setItem(prefix + record.sessionId, JSON.stringify(decode(Live, record))); }
export function allHeld() { return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => held(k.slice(prefix.length))).filter((x): x is Held => x !== null); }
function endedLabels() { return Object.keys(localStorage).filter(k => k.startsWith(endedPrefix)).map(k => decode(S.EndedHomeSession, JSON.parse(localStorage.getItem(k)!))); }
export function hasSessions() { return allHeld().length > 0 || endedLabels().length > 0 || Object.keys(localStorage).some(k => k.startsWith(claimPrefix) || k.startsWith(connectPrefix)); }
function forgetLinks(id: string) {
  for (const key of Object.keys(localStorage)) if (key.startsWith(linkPrefix) && localStorage.getItem(key) === id) {
    localStorage.removeItem(claimPrefix + key.slice(linkPrefix.length));
    localStorage.removeItem(key);
  }
}
function label(name: string, at: string) {
  localStorage.setItem(endedPrefix + newToken(), JSON.stringify(decode(S.EndedHomeSession, { name, endedAt: at })));
}
async function retire(id: string, at: string) {
  await membership(() => {
    const h = held(id); if (!h) return;
    label(h.name, at);
    localStorage.removeItem(prefix + id);
    forgetLinks(id);
  });
}
// Remove the previous candidate's terminal routing identifiers on upgrade, too.
export async function migrateTerminalLabels() {
  await membership(() => {
    const legacy = Schema.Struct({ kind: Schema.Literal('ended', 'expired'), name: S.SessionName, at: S.Timestamp });
    for (const key of Object.keys(localStorage).filter(k => k.startsWith(prefix))) {
      const raw: unknown = JSON.parse(localStorage.getItem(key)!);
      if (Schema.is(legacy)(raw)) {
        label(raw.name, raw.at);
        localStorage.removeItem(key);
        forgetLinks(key.slice(prefix.length));
      }
    }
  });
}
export async function sweep() {
  for (const h of allHeld()) if (h.paired && h.expiresAt && Date.now() >= Date.parse(h.expiresAt)) await retire(h.sessionId, h.expiresAt);
}
class RefusedLink extends Error {
  constructor(readonly result: 'over' | 'refused') { super(result); }
}
function errorFrom(raw: unknown): CardError | RefusedLink {
  const e = Schema.decodeUnknownSync(ErrorReply)(raw);
  switch (e.error) {
    case 'PairingLinkInvalid': case 'ConnectLinkInvalid': return new RefusedLink('over');
    case 'AlreadyPaired': return new RefusedLink('refused');
    case 'Unauthorized': return new E.Unauthorized();
    case 'UnknownSession': return new E.UnknownSession();
    case 'UnknownDecision': return new E.UnknownDecision();
    case 'InvalidInput': return new E.InvalidInput({ reason: e.reason ?? 'Invalid request' });
    case 'SessionExpired': if (e.expiredAt) return new E.SessionExpired({ expiredAt: e.expiredAt, ...(e.sessionName === undefined ? {} : { sessionName: e.sessionName }) }); break;
    case 'SessionEnded': if (e.endedAt && e.endedBy) return new E.SessionEnded({ endedAt: e.endedAt, endedBy: e.endedBy, ...(e.sessionName === undefined ? {} : { sessionName: e.sessionName }) }); break;
    case 'AgentFinished': if (e.finishedAt) return new E.AgentFinished({ finishedAt: e.finishedAt }); break;
    case 'AlreadyAnswered': if (e.receipt) return new E.AlreadyAnswered({ receipt: e.receipt }); break;
  }
  return new Unreachable();
}
async function request(path: string, phoneKey?: string, data?: unknown, method = 'GET', signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { method, headers: { ...(phoneKey ? { [E.PHONE_AUTH_HEADER]: phoneKey } : {}), 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000), cache: 'no-store' });
  const raw: unknown = await response.json();
  if (!response.ok) throw errorFrom(raw);
  return raw;
}
const attempt = <A>(fn: (signal: AbortSignal) => Promise<A>) => Effect.tryPromise({ try: fn, catch: (e): CardError => e instanceof E.Unauthorized || e instanceof E.UnknownSession || e instanceof E.UnknownDecision || e instanceof E.InvalidInput || e instanceof E.SessionExpired || e instanceof E.SessionEnded || e instanceof E.AgentFinished || e instanceof E.AlreadyAnswered ? e : new Unreachable() });
async function read(id: string, signal?: AbortSignal): Promise<S.Inbox> {
  const h = held(id);
  try {
    const inbox = decode(S.Inbox, await request(`/api/sessions/${id}/cards`, h?.phoneKey, undefined, 'GET', signal));
    await membership(() => {
      const current = held(id);
      if (h && current && current.phoneKey === h.phoneKey) save({ ...current, paired: inbox.session.paired, name: inbox.session.name, expiresAt: inbox.session.expiresAt });
    });
    return inbox;
  } catch (e) {
    if (e instanceof E.SessionExpired) await retire(id, e.expiredAt);
    if (e instanceof E.SessionEnded) await retire(id, e.endedAt);
    throw e;
  }
}
function key(id: string) { const h = held(id); if (!h) throw new E.Unauthorized(); return h.phoneKey; }
export function cardLayer(id: string) {
  return Layer.succeed(CardApi, {
    readCards: () => attempt(signal => read(id, signal)),
    answerCard: (decisionId, input) => attempt(async signal => {
      const result = decode(S.Receipt, await request(`/api/sessions/${id}/cards/${decisionId}/answer`, key(id), input, 'POST', signal));
      await read(id, signal);
      return result;
    }),
    endSession: () => attempt(async signal => {
      const result = decode(Schema.Struct({ endedAt: S.Timestamp }), await request(`/api/sessions/${id}/end`, key(id), undefined, 'POST', signal));
      await retire(id, result.endedAt); return result;
    }),
  });
}
// A pending record is a consumable membership right. Commit only if it still exists
// unchanged; another tab may already have discovered AND retired this session.
async function commitPending(k: string, original: string, commit: () => void) {
  await membership(() => {
    if (localStorage.getItem(k) !== original) return;
    commit();
    localStorage.removeItem(k);
  });
}
async function retirePending(k: string, original: string, error: E.SessionEnded | E.SessionExpired) {
  await commitPending(k, original, () => {
    if (error.sessionName !== undefined) label(error.sessionName, error instanceof E.SessionEnded ? error.endedAt : error.expiredAt);
  });
}
async function discover(signal: AbortSignal) {
  for (const k of Object.keys(localStorage).filter(k => k.startsWith(claimPrefix))) {
    await claim(k.slice(claimPrefix.length), signal, true);
  }
  for (const k of Object.keys(localStorage).filter(k => k.startsWith(connectPrefix))) {
    const original = localStorage.getItem(k); if (!original) continue;
    const pending = decode(Pending, JSON.parse(original));
    try {
      const status = decode(S.ConnectStatus, await request(`/api/connect/${k.slice(connectPrefix.length)}`, pending.phoneKey, undefined, 'GET', signal));
      if (status.sessionId !== null) await commitPending(k, original, () => {
        if (!held(status.sessionId)) save({ kind: 'live', paired: false, sessionId: status.sessionId, phoneKey: pending.phoneKey, name: status.name, expiresAt: null });
      });
    } catch (e) {
      if (e instanceof E.SessionEnded || e instanceof E.SessionExpired) await retirePending(k, original, e);
      else if (e instanceof RefusedLink) await commitPending(k, original, () => {});
      else throw e; // A timeout never proves an unused link, even after its join deadline.
    }
  }
}
export const homeLayer = Layer.succeed(HomeApi, {
  listSessions: () => Effect.tryPromise({ try: async signal => {
    await discover(signal);
    const rows = await Promise.all(allHeld().map(async h => {
      try {
        const i = await read(h.sessionId, signal);
        if (!held(h.sessionId)) return null;
        return decode(S.LiveHomeSession, { sessionId: h.sessionId, name: i.session.name, status: i.session.finishedAt ? 'finished' : i.session.paired ? 'active' : 'unpaired', openCount: i.open.length, lastActivityAt: i.session.lastAcceptedAt });
      } catch (e) { if (!(e instanceof E.SessionExpired) && !(e instanceof E.SessionEnded)) throw e; return null; }
    }));
    const sessions: S.HomeSession[] = [...rows.filter((r): r is S.LiveHomeSession => r !== null), ...endedLabels()];
    const at = (s: S.HomeSession) => 'sessionId' in s ? s.lastActivityAt : s.endedAt;
    return sessions.sort((a, b) => at(b).localeCompare(at(a)));
  }, catch: () => new Unreachable() }),
  openConnect: connectId => Effect.tryPromise({ try: async signal => {
    const opened = decode(S.ConnectOpened, await request(`/api/connect/${connectId}`, undefined, undefined, 'POST', signal));
    await membership(() => localStorage.setItem(connectPrefix + connectId, JSON.stringify(opened))); return opened;
  }, catch: () => new Unreachable() }),
});
export async function claim(token: string, signal?: AbortSignal, recoveryOnly = false) {
  return navigator.locks.request(claimPrefix + token, async () => {
    const existing = localStorage.getItem(linkPrefix + token);
    if (existing && held(existing)) return existing;
    const k = claimPrefix + token;
    // Home only consumes persisted reservations, never recreates one another tab removed.
    const original = await membership(() => {
      const pending = localStorage.getItem(k);
      if (pending || recoveryOnly) return pending;
      const phoneKey = newToken();
      localStorage.setItem(k, phoneKey); return phoneKey;
    });
    if (!original) return 'over';
    try {
      const claimed = decode(S.ClaimedSession, await request(`/api/pairing/${token}/claim`, original, undefined, 'POST', signal));
      if (claimed.phoneKey !== original) throw new Unreachable();
      await commitPending(k, original, () => {
        if (!held(claimed.sessionId)) save({ kind: 'live', paired: false, ...claimed, expiresAt: null });
        localStorage.setItem(linkPrefix + token, claimed.sessionId);
      });
      if (!held(claimed.sessionId)) return 'over';
      await read(claimed.sessionId, signal);
      return claimed.sessionId;
    } catch (e) {
      if (e instanceof E.SessionEnded || e instanceof E.SessionExpired) {
        await retirePending(k, original, e); return 'over';
      }
      if (e instanceof RefusedLink || e instanceof E.Unauthorized) {
        await commitPending(k, original, () => {});
        return e instanceof RefusedLink ? e.result : 'refused';
      }
      throw e;
    }
  });
}
