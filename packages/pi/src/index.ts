import { spawn, type ChildProcess } from 'node:child_process';
import { readdirSync, readFileSync, watch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// AgentPager's pi extension (B33.5, blueprint/areas/2-agents.md; docs/research/2026-11-08-clients-wake-lab.md): it only
// wakes. The agent asks and acknowledges with the agentpager command from its shell, and this registers no tool, since pi
// sends every tool's definition with every request. The command stays the only place that holds keys and decrypts.
//
// At each session start, outside print and JSON mode, it sets AGENTPAGER_WAKE=pi:<session> for the commands the agent
// runs (detect.ts in packages/cli has the scheme), so the command records each decision asked under this session and
// tells the agent not to wait. It watches the record of what's waiting (store.ts › waitingOf) for this session's
// decisions and holds the command's own wait for each, `agentpager wait --agent <id> <decision> --forever --json`, in a
// child process: the command opens the answer and tells the service it has it (B32.12). Once pi has settled, never in
// the middle of a run, it hands the command's reply to the agent as a follow-up turn. Each decision's reply goes in once:
// the turn's message names its decisions in its details, which pi keeps in the session, and a reply this collected but
// hadn't handed over when pi stopped is collected again at the next start of the same session. It reads ids and states
// from the record and the status from the command's JSON, never the words of a reply.
//
// In print and JSON mode it does nothing but clear an AGENTPAGER_WAKE inherited from a session around it, so the command
// keeps today's words there and nothing is left running when the run ends. Every child is stopped when the session
// shuts down, or when pi exits without saying so. It writes no log, and nothing it shows holds a key, a number or an
// answer: the answer goes only into the agent's own transcript, as anything the agent reads does.
//
// Load it today with `pi -e <this repository>/packages/pi` (or `pi install <that folder>`); INSTALL publishes it as a pi
// package. Verified with pi 1.4.0. Not handled: two pi processes on one session (`pi -c` in two terminals) each hand
// the reply to their own copy of it.

// The one line every session in which it wakes the agent gets, in the system prompt of each run. Fixed: never a number,
// a key, an id or an answer.
export const LINE = 'AgentPager is available in this session: to ask your owner for a decision on their phone, run the agentpager command in your shell (start with `agentpager --help`).';
// What the extension's entries and messages in the session are called.
export const TYPE = 'agentpager';
// How long to wait before holding a decision's wait again, after one that ended without its reply: the pager off, the
// server unreachable for longer than the command rides out, or the command not found.
const RETRY_MS = 60_000;
// A follow-up that pi hasn't started this long after it was sent, while idle, is sent again, up to SEND_TRIES times.
const CONFIRM_MS = 10_000, SEND_TRIES = 3;
const REPLY_MAX_BYTES = 1024 * 1024;
// The session as AGENTPAGER_WAKE names it, the agent and decision ids as the command makes them.
const SESSION = /^[A-Za-z0-9._-]{1,128}$/, AGENT = /^ap-[a-z0-9]{4}$/, DECISION = /^d_[a-z0-9]{4}$/;

// The part of pi's extension API this uses (pi 1.4.0's ExtensionAPI and ExtensionContext have it), so the extension
// needs nothing but Node to load, and a test can stand in for pi.
export type Context = {
  mode: 'tui' | 'rpc' | 'json' | 'print';
  hasUI: boolean;
  isIdle(): boolean;
  hasPendingMessages(): boolean;
  sessionManager: { getSessionId(): string; getEntries(): readonly unknown[] };
  ui: { notify(message: string, type?: 'info' | 'warning' | 'error'): void };
};
export type Events = {
  session_start: unknown;
  session_shutdown: unknown;
  before_agent_start: { systemPromptOptions?: { sections?: { [name: string]: string } } };
  message_start: { message?: unknown };
  agent_start: unknown;
  agent_settled: unknown;
  tool_result: unknown;
};
export type Pi = {
  on<E extends keyof Events>(event: E, handler: (event: Events[E], ctx: Context) => void): unknown;
  sendMessage(message: { customType: string; content: string; display: boolean; details?: unknown }, options?: { triggerTurn?: boolean; deliverAs?: 'steer' | 'followUp' | 'nextTurn' }): void;
  appendEntry(customType: string, data?: unknown): void;
};
// command: how to run agentpager; home: the folder it keeps its files in; retryMs and confirmMs: a test shortens them.
export type Options = { command?: readonly string[]; home?: string; retryMs?: number; confirmMs?: number };

type Reply = { agent: string; decision: string; text: string; answered: boolean };
const keyOf = (agent: string, decision: string) => `${agent} ${decision}`;
const fields = (v: unknown): { [k: string]: unknown } | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const ids = (v: unknown): { agent: string; decision: string } | null => {
  const f = fields(v);
  return f && typeof f.agent === 'string' && AGENT.test(f.agent) && typeof f.decision === 'string' && DECISION.test(f.decision) ? { agent: f.agent, decision: f.decision } : null;
};

// One agent's record of what's waiting, waiting/<agent>.json: this session's decisions in it, with where each stands.
// Null when the file can't be read as a record, which is not the same as one that lists none.
function listedIn(file: string, agent: string, session: string): Map<string, 'waiting' | 'answered'> | null {
  let record: { [k: string]: unknown } | null;
  try { record = fields(JSON.parse(readFileSync(file, 'utf8'))); } catch { return null; }
  if (!record || record.version !== 1 || record.agent !== agent || !Array.isArray(record.decisions)) return null;
  const mine = new Map<string, 'waiting' | 'answered'>();
  for (const entry of record.decisions) {
    const d = fields(entry), wake = fields(d?.wake);
    if (!d || typeof d.decision !== 'string' || !DECISION.test(d.decision) || (d.state !== 'waiting' && d.state !== 'answered')) continue;
    if (wake?.app === 'pi' && wake.session === session) mine.set(d.decision, d.state);
  }
  return mine;
}

export function agentpagerWake(pi: Pi, options: Options = {}) {
  const command = options.command ?? ['agentpager'], retryMs = options.retryMs ?? RETRY_MS, confirmMs = options.confirmMs ?? CONFIRM_MS;
  const home = () => options.home ?? (process.env.AGENTPAGER_HOME || path.join(homedir(), '.agentpager'));
  const waitingDir = () => path.join(home(), 'waiting');

  let session: string | null = null, ctx: Context | null = null, stopped = false, running = false, told = false;
  // holding: the waits running now. retrying: a decision whose wait ended without its reply, until it is held again.
  // ready: replies to hand over, in the order they came. inFlight: the follow-up sent and not yet started by pi.
  // done: decisions whose reply is in the session, or on its way. collected: those this collected, as the session says.
  const holding = new Map<string, ChildProcess>(), retrying = new Map<string, ReturnType<typeof setTimeout>>();
  const ready = new Map<string, Reply>(), done = new Set<string>(), collected = new Set<string>();
  let inFlight: { replies: Reply[]; tries: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let watcher: FSWatcher | null = null, rescan: ReturnType<typeof setTimeout> | null = null;

  const idle = () => { try { return Boolean(ctx?.isIdle()) && !ctx?.hasPendingMessages(); } catch { return false; } };
  const notify = (message: string) => { try { if (ctx?.hasUI) ctx.ui.notify(message, 'warning'); } catch { /* the session is gone */ } };

  // Stops every wait this started, at once: a wait left running would collect an answer no one hands over.
  const stopChildren = () => {
    for (const child of holding.values()) {
      if (child.pid === undefined) continue;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* it ended */ } }
    }
    holding.clear();
  };
  const onExit = () => stopChildren();

  // Looks through the record for this session's decisions: each one waiting gets a wait held for it, and so does one
  // this collected before pi stopped and never handed over, whose wait returns the same reply at once.
  const scan = () => {
    if (stopped || session === null) return;
    const dir = waitingDir();
    if (!watcher) {
      try { watcher = watch(dir, { persistent: false }, () => { if (rescan) return; rescan = setTimeout(() => { rescan = null; scan(); }, 50); rescan.unref(); }); watcher.on('error', () => { watcher?.close(); watcher = null; }); }
      catch { watcher = null; }
    }
    let names: string[];
    try { names = readdirSync(dir); } catch { names = []; }
    for (const name of names) {
      const agent = /^(ap-[a-z0-9]{4})\.json$/.exec(name)?.[1];
      if (!agent) continue;
      for (const [decision, state] of listedIn(path.join(dir, name), agent, session) ?? []) {
        const key = keyOf(agent, decision);
        if (done.has(key) || holding.has(key) || retrying.has(key) || ready.has(key)) continue;
        if (state === 'waiting' || collected.has(key)) hold(agent, decision);
      }
    }
    deliver();
  };

  const later = (key: string) => {
    if (stopped || retrying.has(key)) return;
    const timer = setTimeout(() => { retrying.delete(key); scan(); }, retryMs);
    timer.unref();
    retrying.set(key, timer);
  };

  // The command's own wait for one decision, with no end, in a process group of its own so that all of it stops with
  // the session. It gets this process's environment without the session's wake or the pager's number.
  const hold = (agent: string, decision: string) => {
    const key = keyOf(agent, decision), env = { ...process.env };
    delete env.AGENTPAGER_WAKE; delete env.AGENTPAGER_PAGER;
    let child: ChildProcess;
    try { child = spawn(command[0], [...command.slice(1), 'wait', '--agent', agent, decision, '--forever', '--json'], { stdio: ['ignore', 'pipe', 'ignore'], env, detached: true }); }
    catch { later(key); return; }
    holding.set(key, child);
    child.unref();
    const chunks: Buffer[] = [];
    let size = 0;
    child.stdout?.on('data', (b: Buffer) => { size += b.length; if (size <= REPLY_MAX_BYTES) chunks.push(b); });
    child.stdout?.on('error', () => { /* the reply is read on close */ });
    // A socket's unref stops it holding pi open; the pipe still delivers while pi runs.
    const out: unknown = child.stdout;
    if (out && typeof out === 'object' && 'unref' in out && typeof out.unref === 'function') out.unref();
    let ended = false;
    const end = (reply: unknown) => {
      if (ended) return;
      ended = true;
      if (holding.get(key) === child) holding.delete(key);
      if (stopped) return;
      const r = fields(reply), result = fields(r?.result), text = typeof r?.text === 'string' ? r.text : null;
      // The answer, or a refusal that another wait would only repeat (an answer that doesn't open, an agent file that
      // can't be read): its reply is handed to the agent. A decision that closed unanswered (the agent finished it) or an
      // agent that is gone leaves the record and needs nothing. Anything else is tried again later.
      if (text !== null && r?.code === 0 && result?.status === 'answered') return collect({ agent, decision, text, answered: true });
      if (text !== null && r?.code === 2 && result?.status === undefined) return collect({ agent, decision, text, answered: false });
      if ((r?.code === 2 && result?.status === 'closed') || r?.code === 6) return;
      later(key);
    };
    child.on('error', e => {
      if (!told) { told = true; notify(`AgentPager couldn't run the agentpager command to wait for your owner's answer (${'code' in e ? String(e.code) : 'error'}). It tries again every minute.`); }
      end(null);
    });
    child.on('close', () => {
      let reply: unknown = null;
      try { reply = size <= REPLY_MAX_BYTES ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null; } catch { reply = null; }
      end(reply);
    });
  };

  // A reply is noted in the session as collected before it waits for pi to settle, so a pi that stops in between
  // collects it again at the session's next start.
  const collect = (reply: Reply) => {
    const key = keyOf(reply.agent, reply.decision);
    if (!collected.has(key)) {
      try { pi.appendEntry(TYPE, { agent: reply.agent, decision: reply.decision }); collected.add(key); } catch { /* the reply still goes in now */ }
    }
    ready.set(key, reply);
    deliver();
  };

  // Hands the replies waiting over as one follow-up turn, once pi has settled with nothing queued: never into a run. A
  // decision acknowledged or closed meanwhile (the agent read its answer by itself) is left out.
  const deliver = () => {
    if (stopped || session === null || running || inFlight || ready.size === 0 || !idle()) return;
    const replies: Reply[] = [], lists = new Map<string, Map<string, 'waiting' | 'answered'> | null>();
    for (const [key, r] of ready) {
      if (!lists.has(r.agent)) lists.set(r.agent, listedIn(path.join(waitingDir(), `${r.agent}.json`), r.agent, session));
      const listed = lists.get(r.agent);
      ready.delete(key);
      if (listed && !listed.has(r.decision)) { done.add(key); continue; }
      replies.push(r);
    }
    if (replies.length) send(replies, 1);
  };
  const send = (replies: Reply[], tries: number) => {
    for (const r of replies) done.add(keyOf(r.agent, r.decision));
    running = true;
    const sent = { replies, tries, timer: setTimeout(() => unconfirmed(sent), confirmMs) };
    sent.timer.unref();
    inFlight = sent;
    const content = replies.map(r => `${r.answered ? `AgentPager: your owner answered decision ${r.decision} (agent ${r.agent}).` : `AgentPager: the wait for decision ${r.decision} (agent ${r.agent}) ended without an answer it could give you.`} The agentpager command's reply:\n\n${r.text}`).join('\n\n');
    pi.sendMessage({ customType: TYPE, content, display: true, details: { decisions: replies.map(r => ({ agent: r.agent, decision: r.decision })) } }, { triggerTurn: true, deliverAs: 'followUp' });
  };
  // A follow-up pi never put in the session (it failed before its run began) is sent again, a few times; after that it
  // waits for the session's next start, where it is collected again.
  const resend = () => {
    const sent = inFlight;
    if (!sent) return;
    clearTimeout(sent.timer);
    inFlight = null; running = false;
    if (sent.tries < SEND_TRIES) send(sent.replies, sent.tries + 1);
  };
  const unconfirmed = (sent: NonNullable<typeof inFlight>) => {
    if (stopped || inFlight !== sent) return;
    if (idle()) return resend();
    sent.timer = setTimeout(() => unconfirmed(sent), confirmMs);
    sent.timer.unref();
  };

  pi.on('session_start', (_e, c) => {
    ctx = c;
    let id: string | null = null;
    if (c.mode !== 'print' && c.mode !== 'json') { try { id = c.sessionManager.getSessionId(); } catch { id = null; } }
    if (id === null || !SESSION.test(id)) { delete process.env.AGENTPAGER_WAKE; return; }
    session = id;
    process.env.AGENTPAGER_WAKE = `pi:${id}`;
    // What the session already holds: the replies handed over (each turn's message names its decisions) and those
    // collected.
    let entries: readonly unknown[] = [];
    try { entries = c.sessionManager.getEntries(); } catch { entries = []; }
    for (const entry of entries) {
      const e = fields(entry);
      if (e?.customType !== TYPE) continue;
      if (e.type === 'custom') { const x = ids(e.data); if (x) collected.add(keyOf(x.agent, x.decision)); }
      const listed = e.type === 'custom_message' ? fields(e.details)?.decisions : undefined;
      if (Array.isArray(listed)) for (const d of listed) { const x = ids(d); if (x) done.add(keyOf(x.agent, x.decision)); }
    }
    process.off('exit', onExit);
    process.on('exit', onExit);
    scan();
  });
  pi.on('before_agent_start', (e, c) => {
    ctx = c;
    const options = e.systemPromptOptions;
    if (session === null || !options) return;
    options.sections ??= {};
    options.sections.agentpager = LINE;
  });
  // The follow-up is in the session once pi starts its message, whether it began a run or joined one.
  pi.on('message_start', (e, c) => {
    ctx = c;
    const m = fields(e.message);
    if (!inFlight || m?.role !== 'custom' || m.customType !== TYPE || !Array.isArray(fields(m.details)?.decisions)) return;
    clearTimeout(inFlight.timer);
    inFlight = null;
  });
  pi.on('agent_start', (_e, c) => { ctx = c; running = true; });
  pi.on('agent_settled', (_e, c) => {
    ctx = c;
    if (session === null) return;
    running = false;
    if (inFlight) resend();
    scan();
  });
  // An ask run in the foreground has written the record by the time its command returns.
  pi.on('tool_result', (e, c) => { ctx = c; if (fields(e)?.toolName === 'bash') scan(); });
  pi.on('session_shutdown', () => {
    stopped = true;
    stopChildren();
    process.off('exit', onExit);
    for (const t of retrying.values()) clearTimeout(t);
    retrying.clear();
    if (inFlight) clearTimeout(inFlight.timer);
    if (rescan) clearTimeout(rescan);
    watcher?.close();
    watcher = null;
    if (session !== null && process.env.AGENTPAGER_WAKE === `pi:${session}`) delete process.env.AGENTPAGER_WAKE;
    session = null;
  });
}

export default function (pi: Pi) { agentpagerWake(pi); }
