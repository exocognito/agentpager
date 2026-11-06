import { appendFileSync, chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { Either, ParseResult, Schema } from 'effect';
import { Token } from '../../contract/exchange.ts';

// Everything the binary keeps lives under ~/.agentpager (AGENTPAGER_HOME moves it), never in the project:
//   config.json            { "server": "https://agentpager.me" }, optional
//   agents/<id>.json       one file per agent, mode 600: its server key and its reminder clock
//   history/<pager>.jsonl  every decision asked from this machine on that pager, with its answer
export const DEFAULT_SERVER = 'https://agentpager.me';
export const home = () => process.env.AGENTPAGER_HOME || path.join(homedir(), '.agentpager');

const AgentFile = Schema.mutable(Schema.Struct({
  id: Schema.String, server: Schema.String, pager: Schema.String, agentId: Token, agentKey: Token,
  app: Schema.String, project: Schema.String, createdAt: Schema.String,
  rulesShownAt: Schema.NullOr(Schema.String), cardsSinceRules: Schema.Number,
  // Short decision ids for the agent (d_2x8w): the server's id, the question and its option labels, and how far it got.
  // askedAt came later, so a file from before it still loads.
  decisions: Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Struct({
    id: Schema.String, title: Schema.String, options: Schema.mutable(Schema.Array(Schema.String)),
    askedAt: Schema.optional(Schema.String), answered: Schema.optional(Schema.Boolean), acknowledged: Schema.optional(Schema.Boolean),
  })) })),
  // Asks no reply has settled yet, by their card's content: the request id chosen for each, so the same card asked
  // again after a lost reply names the same decision, and, while a run is sending it, until when. It came later, so
  // a file from before it still loads.
  asking: Schema.optional(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Struct({ requestId: Token, sendingUntil: Schema.optional(Schema.String) })) }))),
}));
export type AgentFile = typeof AgentFile.Type;

export function server(): string {
  if (process.env.AGENTPAGER_SERVER) return process.env.AGENTPAGER_SERVER.replace(/\/+$/, '');
  try {
    const config: unknown = JSON.parse(readFileSync(path.join(home(), 'config.json'), 'utf8'));
    if (typeof config === 'object' && config !== null && 'server' in config && typeof config.server === 'string') return config.server.replace(/\/+$/, '');
  } catch { /* no config: the default */ }
  return DEFAULT_SERVER;
}

// Ids are four characters from a 32-letter alphabet, unique on this machine only, never a secret.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function shortId(prefix: string, taken: (id: string) => boolean): string {
  for (;;) {
    const id = prefix + Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    if (!taken(id)) return id;
  }
}

const agentsDir = () => path.join(home(), 'agents');
const agentPath = (id: string) => path.join(agentsDir(), `${id}.json`);
export function saveAgent(a: AgentFile) {
  mkdirSync(agentsDir(), { recursive: true, mode: 0o700 });
  const file = agentPath(a.id), temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(a, null, 2) + '\n', { mode: 0o600 });
  chmodSync(temp, 0o600);
  renameSync(temp, file);
}
// Several agents (a coordinator and its helpers, each its own process) may share one id: each change takes the
// agent's lock, re-reads the file and is applied to what is there now, so one's write never drops another's
// decision. The lock is a directory (mkdir is atomic); one left by a crashed process is broken after 10 seconds.
const LOCK_STALE_MS = 10_000, LOCK_WAIT_MS = 5_000;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function locked<A>(id: string, run: () => A): A {
  const lock = path.join(agentsDir(), `${id}.lock`), until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try { mkdirSync(lock); break; } catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) throw e;
      try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { rmSync(lock, { recursive: true, force: true }); continue; } } catch { continue; }
      if (Date.now() > until) throw Object.assign(new Error(`agent ${id} is busy`), { code: 'EBUSY' });
      pause(10);
    }
  }
  try { return run(); } finally { rmSync(lock, { recursive: true, force: true }); }
}
export function updateAgent(id: string, change: (a: AgentFile) => void): AgentFile | null {
  return locked(id, () => {
    const a = loadAgent(id);
    if (!a) return null;
    change(a);
    saveAgent(a);
    return a;
  });
}
// Checked before anything is sent, so a machine that can't keep the agent's key never creates an agent it can't use.
export function writable(): string | null {
  try {
    mkdirSync(agentsDir(), { recursive: true, mode: 0o700 });
    const probe = path.join(agentsDir(), `.probe-${process.pid}`);
    writeFileSync(probe, '', { mode: 0o600 });
    rmSync(probe);
    return null;
  } catch (e) { return e instanceof Error && 'code' in e ? String(e.code) : 'not writable'; }
}
// A file that is there but isn't an agent file is refused by its id, never taken for a missing agent or written over,
// and never quoted: it holds the agent's key. Fields it doesn't know (a newer binary's) are kept.
export class UnreadableAgent extends Error {}
export function loadAgent(id: string): AgentFile | null {
  if (!/^ap-[a-z0-9]{4}$/.test(id)) return null;
  let why: string;
  try {
    const decoded = Schema.decodeUnknownEither(AgentFile, { onExcessProperty: 'preserve' })(JSON.parse(readFileSync(agentPath(id), 'utf8')));
    if (Either.isRight(decoded)) return decoded.right;
    const field = ParseResult.ArrayFormatter.formatErrorSync(decoded.left)[0]?.path.map(String).join('.');
    why = field ? `${field} is missing or wrong` : 'not an agent file';
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    why = e instanceof SyntaxError ? 'not JSON' : e instanceof Error && 'code' in e ? String(e.code) : 'unreadable';
  }
  throw new UnreadableAgent(`Can't read agent ${id}'s file, ${agentPath(id)} (${why}). Connect again for a new agent.`);
}
export function agentIds(): string[] {
  try { return readdirSync(agentsDir()).filter(f => /^ap-[a-z0-9]{4}\.json$/.test(f)).map(f => f.slice(0, -5)).sort(); } catch { return []; }
}

// History: per pager, append only, capped at 1,000 lines with the oldest dropped. Never printed unasked.
export const HISTORY_CAP = 1000;
const historyPath = (pager: string) => path.join(home(), 'history', `${pager}.jsonl`);
export type HistoryEvent = { [key: string]: unknown; at: string; event: 'asked' | 'answered' | 'acknowledged'; agent: string; decision: string };
export function appendHistory(pager: string, e: HistoryEvent) {
  mkdirSync(path.dirname(historyPath(pager)), { recursive: true, mode: 0o700 });
  appendFileSync(historyPath(pager), JSON.stringify(e) + '\n', { mode: 0o600 });
  const lines = readFileSync(historyPath(pager), 'utf8').split('\n').filter(Boolean);
  if (lines.length > HISTORY_CAP) writeFileSync(historyPath(pager), lines.slice(-HISTORY_CAP).join('\n') + '\n', { mode: 0o600 });
}
export function readHistory(pager: string): HistoryEvent[] {
  try { return readFileSync(historyPath(pager), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch { return []; }
}

// The pager id inside a number: `ap1_` and base64url of the pager id (16 bytes) and the key fingerprint (8 bytes).
export function pagerOf(number: string): string | null {
  if (!/^ap1_[A-Za-z0-9_-]{32}$/.test(number)) return null;
  return Buffer.from(number.slice(4), 'base64url').subarray(0, 16).toString('hex');
}
