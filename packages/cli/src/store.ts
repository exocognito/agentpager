import { appendFileSync, chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { Either, ParseResult, Schema } from 'effect';
import { Token } from '../../contract/exchange.ts';

// Everything the binary keeps lives under ~/.agentpager (AGENTPAGER_HOME moves it), never in the project:
//   config.json            { "server": "https://agentpager.me" }, optional
//   agents/<id>.json       one file per agent, mode 600: its server key, its own private key, its pager's public key
//                          as checked at connect, and its reminder clock
//   history/<pager>.jsonl  every decision asked from this machine on that pager, with its answer
//   waiting/<id>.json      mode 600: the record of what's waiting, each of the agent's decisions with its ids and
//                          where it stands, for the adapters that wake an agent (below)
export const DEFAULT_SERVER = 'https://agentpager.me';
export const home = () => process.env.AGENTPAGER_HOME || path.join(homedir(), '.agentpager');

// Who wakes the agent for a decision, when something does (B33, blueprint/areas/2-agents.md): an adapter, under the
// session AGENTPAGER_WAKE named when it was asked (detect.ts), or Codex's thread, which the command's watcher rings
// (codex.ts). For Codex, via says how the thread asked, MCP or its shell, for the note's words; watcher is the process
// id of the watcher waiting to ring it, while one runs; ring is set before `codex queue` runs, so the thread is never
// rung twice, and says how the call went ('ringing' until it ends, or for good if the watcher stopped mid-call).
const RING = ['ringing', 'queued', 'timed-out', 'unknown-thread', 'failed', 'no-cli'] as const;
export type RingOutcome = typeof RING[number];
const AdapterWake = Schema.Struct({ app: Schema.Literal('claude-code', 'pi'), session: Schema.String });
const CodexWake = Schema.mutable(Schema.Struct({
  app: Schema.Literal('codex'), thread: Schema.String, via: Schema.Literal('mcp', 'shell'), watcher: Schema.optional(Schema.Number),
  ring: Schema.optional(Schema.Struct({ at: Schema.String, outcome: Schema.Literal(...RING) })),
}));
export type CodexWake = typeof CodexWake.Type;
const Wake = Schema.Union(AdapterWake, CodexWake);
export type DecisionWake = typeof Wake.Type;

// A key as the agent file keeps it: 32 bytes, base64url.
const Key = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_-]{43}$/));
const AgentFile = Schema.mutable(Schema.Struct({
  id: Schema.String, server: Schema.String, pager: Schema.String, agentId: Token, agentKey: Token,
  // The agent's own X25519 private key, made at connect: its public key goes in every card, as the key the phone seals
  // the answer to, and this opens the answers. Never printed and never sent. pagerKey: the pager's public key, checked
  // against the number at connect (I19); every part this agent sends is sealed to it and no other.
  privateKey: Key, pagerKey: Key,
  app: Schema.String, project: Schema.String, machine: Schema.optional(Schema.String), createdAt: Schema.String,
  rulesShownAt: Schema.NullOr(Schema.String), cardsSinceRules: Schema.Number,
  // Short decision ids for the agent (d_2x8w): the server's id, the question and its option labels, and how far it got.
  // askedAt came later, closed (it closed unanswered, as the service said) later still, and wake (Wake, above) in M7, so
  // a file from before any of them still loads; a command from before one keeps it when it writes the file.
  decisions: Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Struct({
    id: Schema.String, title: Schema.String, options: Schema.mutable(Schema.Array(Schema.String)),
    askedAt: Schema.optional(Schema.String), answered: Schema.optional(Schema.Boolean), acknowledged: Schema.optional(Schema.Boolean),
    closed: Schema.optional(Schema.Boolean), wake: Schema.optional(Wake),
  })) })),
  // Asks no reply has settled yet, by their card's content: the request id chosen for each, so the same card asked
  // again after a lost reply names the same decision; the run that last took it (run), which alone may change it; and,
  // while that run is sending it, until when. It came later, so a file from before it still loads.
  asking: Schema.optional(Schema.mutable(Schema.Record({ key: Schema.String, value: Schema.mutable(Schema.Struct({ requestId: Token, run: Token, sendingUntil: Schema.optional(Schema.String) })) }))),
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
// Each file is written beside itself and renamed over itself, so a reader never sees part of one. Both are written
// before either is renamed, so a write that fails (a full disk, a folder it can't write) changes neither, and the
// record never names a decision the agent's file doesn't, or the other way round.
function staged(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  try { writeFileSync(temp, text, { mode: 0o600 }); chmodSync(temp, 0o600); }
  catch (e) { rmSync(temp, { force: true }); throw e; }
  return { temp, file };
}
export function saveAgent(a: AgentFile) {
  const agent = staged(agentPath(a.id), JSON.stringify(a, null, 2) + '\n');
  let record: { temp: string; file: string };
  try { record = staged(waitingPath(a.id), JSON.stringify(waitingOf(a), null, 2) + '\n'); }
  catch (e) { rmSync(agent.temp, { force: true }); throw e; }
  renameSync(agent.temp, agent.file);
  renameSync(record.temp, record.file);
}

// The record of what's waiting, waiting/<agent id>.json: the contract with the adapters that wake an agent, the Claude
// Code plugin's mod and the pi extension, which read it instead of the words of the command's replies, and the
// command's own Codex watcher. It is written with the agent's file, every time, so it says what that file says, and
// is private to the machine's user like it (mode 600, in a folder of mode 700). It holds ids and where each decision
// stands: never a key, a pager number, a card's words or an answer.
//   { "version": 1, "agent": "ap-7f3k", "decisions": [
//     { "decision": "d_2x8w", "askedAt": "2026-11-08T19:11:02.461Z", "state": "waiting",
//       "wake": { "app": "claude-code", "session": "<the session AGENTPAGER_WAKE named>" } },
//     { "decision": "d_9k2m", "askedAt": "…", "state": "answered", "wake": { "app": "codex", "thread": "<thread id>", "rung": "queued" } },
//     { "decision": "d_4hq7", "askedAt": "…", "state": "waiting" } ] }
// A decision asked from this machine is listed until this machine acknowledges it or learns it closed unanswered:
// "waiting" until a wait here has its answer, then "answered". "wake" says who wakes the agent for it, when something
// does: an adapter's session, as AGENTPAGER_WAKE named it when the agent asked (detect.ts), or the Codex thread that
// asked, with how its ring went once it has rung (RingOutcome). An adapter acts only on the decisions whose wake names
// its own app and session; it ignores the rest, and a decision that leaves the list is done with. For each, it:
//   1. holds `agentpager wait --agent <agent> <decision> --no-pickup --json`, with `--forever` for a wait with no end,
//      or without it for one that holds up to 50 s and replies pending, to be held again. It replies as any wait does,
//      {code, text, result: {status}} with the command's exit codes (0 answered or pending, 2 refused, closed among
//      them as status closed, 4 pager off, 5 no usable reply, 6 unknown agent), but picks nothing up: the service isn't
//      told and nothing here changes, so the decision stays waiting and the owner's not-picked-up clock runs;
//   2. hands the text of an answered reply to the agent as a new turn;
//   3. once that turn has started, runs `agentpager pickup --agent <agent> <decision> --json`, which tells the service
//      this agent's command received the answer (B32.12) and records it here as answered. Its result's status:
//      picked-up or acknowledged, exit 0, done (saying it again gets picked-up again); pending, closed, unreadable or
//      refused, exit 2, not to be run again; pager-off, exit 4, or try-again, exit 5, or a reply with no JSON: run it
//      again later.
// So a wait whose adapter went away, or an answer never handed over, picks nothing up, and the owner is warned (B5.13).
export type Waiting = {
  version: 1; agent: string;
  decisions: { decision: string; askedAt?: string; state: 'waiting' | 'answered'; wake?: { app: 'claude-code' | 'pi'; session: string } | { app: 'codex'; thread: string; rung?: RingOutcome } }[];
};
export const waitingPath = (id: string) => path.join(home(), 'waiting', `${id}.json`);
export function waitingOf(a: AgentFile): Waiting {
  const decisions = Object.entries(a.decisions).filter(([, d]) => !d.acknowledged && !d.closed).map(([decision, d]) => {
    const w = d.wake, wake = !w ? undefined : w.app === 'codex' ? { app: w.app, thread: w.thread, ...(w.ring ? { rung: w.ring.outcome } : {}) } : { app: w.app, session: w.session };
    return { decision, ...(d.askedAt ? { askedAt: d.askedAt } : {}), state: d.answered ? 'answered' as const : 'waiting' as const, ...(wake ? { wake } : {}) };
  });
  return { version: 1, agent: a.id, decisions };
}
// Several agents (a coordinator and its helpers, each its own process) may share one id: each change takes the
// agent's lock, re-reads the file and is applied to what is there now, so one's write never drops another's
// decision. A lock is a directory (mkdir is atomic); one left by a crashed process is broken after 10 seconds. The
// history takes one of its own, per pager.
const LOCK_STALE_MS = 10_000, LOCK_WAIT_MS = 5_000;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function lockedAt<A>(lock: string, busy: string, run: () => A): A {
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try { mkdirSync(lock); break; } catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) throw e;
      try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { rmSync(lock, { recursive: true, force: true }); continue; } } catch { continue; }
      if (Date.now() > until) throw Object.assign(new Error(busy), { code: 'EBUSY' });
      pause(10);
    }
  }
  try { return run(); } finally { rmSync(lock, { recursive: true, force: true }); }
}
const locked = <A>(id: string, run: () => A): A => lockedAt(path.join(agentsDir(), `${id}.lock`), `agent ${id} is busy`, run);
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
// and never quoted: it holds the agent's key. Fields it doesn't know (a newer binary's) are kept. A file from before
// the encryption switch (M5) has no keys of its own: that agent can't ask or wait any more, and is told to connect
// again, which makes a new agent with its keys.
export class UnreadableAgent extends Error {}
const PreSwitch = Schema.Struct({ id: Schema.String, agentId: Token, agentKey: Token, privateKey: Schema.optional(Schema.Never), pagerKey: Schema.optional(Schema.Never) });
export function loadAgent(id: string): AgentFile | null {
  if (!/^ap-[a-z0-9]{4}$/.test(id)) return null;
  let why: string;
  try {
    const raw: unknown = JSON.parse(readFileSync(agentPath(id), 'utf8'));
    const decoded = Schema.decodeUnknownEither(AgentFile, { onExcessProperty: 'preserve' })(raw);
    if (Either.isRight(decoded)) return decoded.right;
    if (Schema.is(PreSwitch)(raw)) throw new UnreadableAgent(`Agent ${id} was connected before this version of agentpager, which encrypts every decision, so it can't ask or wait any more. Connect again with your owner's pager number for a new agent.`);
    const field = ParseResult.ArrayFormatter.formatErrorSync(decoded.left)[0]?.path.map(String).join('.');
    why = field ? `${field} is missing or wrong` : 'not an agent file';
  } catch (e) {
    if (e instanceof UnreadableAgent) throw e;
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
// Each line is one event: these four fields, and whatever else its kind of event holds.
const HistoryEvent = Schema.Struct(
  { at: Schema.String, event: Schema.Literal('asked', 'answered', 'acknowledged', 'closed'), agent: Schema.String, decision: Schema.String },
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);
export type HistoryEvent = typeof HistoryEvent.Type;
// Every agent on the pager appends to its one file, each from its own process: the append and the trim take the
// pager's history lock, so a trim never drops a line another agent appended after reading. The trimmed file is
// written beside it and renamed over it, so a crash leaves the old file or the new one, never part of one. The trim
// keeps each line as it is, one that isn't an event among them, and drops only the oldest.
export function appendHistory(pager: string, e: HistoryEvent) {
  const file = historyPath(pager);
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  lockedAt(`${file}.lock`, 'the history is busy', () => {
    let before = '';
    try { before = readFileSync(file, 'utf8'); } catch (err) { if (!(err instanceof Error && 'code' in err && err.code === 'ENOENT')) throw err; }
    // An append that failed part way leaves a line with no end. This one starts a line of its own, so it is never
    // joined to that line and skipped with it.
    const line = (before && !before.endsWith('\n') ? '\n' : '') + JSON.stringify(e) + '\n';
    appendFileSync(file, line, { mode: 0o600 });
    const lines = (before + line).split('\n').filter(Boolean);
    if (lines.length <= HISTORY_CAP) return;
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, lines.slice(-HISTORY_CAP).join('\n') + '\n', { mode: 0o600, flush: true });
    chmodSync(temp, 0o600);
    renameSync(temp, file);
  });
}
// Read without the lock, so reading stays cheap and never waits on a busy history. Another agent's append may be part
// way through, and one that failed leaves a line with no end: a line that isn't a whole event is skipped, and every
// other line is kept. No file is no history.
export function readHistory(pager: string): HistoryEvent[] {
  let text: string;
  try { text = readFileSync(historyPath(pager), 'utf8'); } catch { return []; }
  return text.split('\n').map(json).filter(Schema.is(HistoryEvent));
}
const json = (line: string): unknown => { try { return JSON.parse(line); } catch { return undefined; } };

// The pager id inside a number: `ap1_` and base64url of the pager id (16 bytes) and the key fingerprint (8 bytes).
export function pagerOf(number: string): string | null {
  if (!/^ap1_[A-Za-z0-9_-]{32}$/.test(number)) return null;
  return Buffer.from(number.slice(4), 'base64url').subarray(0, 16).toString('hex');
}
// The fingerprint inside a number: the first 8 bytes of the SHA-256 of the pager's public key, as hex.
export function fingerprintOf(number: string): string | null {
  if (!/^ap1_[A-Za-z0-9_-]{32}$/.test(number)) return null;
  return Buffer.from(number.slice(4), 'base64url').subarray(16, 24).toString('hex');
}
