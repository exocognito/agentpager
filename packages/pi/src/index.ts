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
// tells the agent not to wait. For each of this session's decisions in the record of what's waiting, it takes the steps
// of the adapters' contract (store.ts › Waiting): it holds the command's wait that picks nothing up, `agentpager wait
// --agent <id> <decision> --no-pickup --json`, in a child process, one 50 s wait after another; once pi has settled,
// never in the middle of a run, it hands that wait's reply to the agent as a follow-up turn; and once that turn has
// started, it runs `agentpager pickup`, again until it lands, so the answer counts as picked up only once the agent has
// it (B32.12). A wait left running when pi is killed, or a reply pi never takes, picks nothing up, and the owner is
// warned (B5.13). Each decision's reply goes in once on the session's branch: the turn's message names its decisions in
// its details, each with whether it carried the answer, which pi keeps in the session. So a later start of the same
// session, or a move to another point of its tree, neither hands over again a reply its branch holds nor holds its
// wait; it only runs the pickup of an answer it carried, if that hadn't landed. A decision still waiting on the agent
// whose reply only another branch holds is handed over again on this one, and a reply collected for a branch the owner
// has since left isn't handed over on one that holds it. An answer the agent has read by itself, with a wait of its
// own, isn't handed over as well: the record says so (its state, and its count of such reads). It reads ids, states
// and counts from the record and statuses from the command's JSON, never the words of a reply.
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
// What the extension's messages in the session are called.
export const TYPE = 'agentpager';
// How long before a wait or a pickup that ended without landing is run again: the server away or a reply not understood,
// the command not found; and, while the pager is off, a minute.
const RETRY_MS = 10_000, OFF_RETRY_MS = 60_000;
// A follow-up that pi hasn't started this long after it was sent, while idle, is sent again, each time waiting twice as
// long, up to 5 minutes.
const CONFIRM_MS = 10_000, CONFIRM_MAX_MS = 300_000;
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
  sessionManager: { getSessionId(): string; getEntries(): readonly unknown[]; getBranch(): readonly unknown[] };
  ui: { notify(message: string, type?: 'info' | 'warning' | 'error'): void };
};
export type Events = {
  session_start: unknown;
  session_shutdown: unknown;
  session_tree: unknown;
  before_agent_start: { systemPromptOptions?: { sections?: { [name: string]: string } } };
  message_start: { message?: unknown };
  agent_start: unknown;
  agent_settled: unknown;
  tool_result: unknown;
};
export type Pi = {
  on<E extends keyof Events>(event: E, handler: (event: Events[E], ctx: Context) => void): unknown;
  sendMessage(message: { customType: string; content: string; display: boolean; details?: unknown }, options?: { triggerTurn?: boolean; deliverAs?: 'steer' | 'followUp' | 'nextTurn' }): void;
};
// command: how to run agentpager; home: the folder it keeps its files in; retryMs, offRetryMs and confirmMs: a test
// shortens them.
export type Options = { command?: readonly string[]; home?: string; retryMs?: number; offRetryMs?: number; confirmMs?: number };

type Reply = { agent: string; decision: string; text: string; answered: boolean };
const keyOf = (agent: string, decision: string) => `${agent} ${decision}`;
const fields = (v: unknown): { [k: string]: unknown } | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : null;
const ids = (v: unknown): { agent: string; decision: string } | null => {
  const f = fields(v);
  return f && typeof f.agent === 'string' && AGENT.test(f.agent) && typeof f.decision === 'string' && DECISION.test(f.decision) ? { agent: f.agent, decision: f.decision } : null;
};

// One agent's record of what's waiting, waiting/<agent>.json: this session's decisions in it, with where each stands
// and how many times a wait of the agent's own has handed it the answer. Null when the file can't be read as a record,
// which is not the same as one that lists none.
type Listed = { state: 'waiting' | 'answered'; reads: number };
function listedIn(file: string, agent: string, session: string): Map<string, Listed> | null {
  let record: { [k: string]: unknown } | null;
  try { record = fields(JSON.parse(readFileSync(file, 'utf8'))); } catch { return null; }
  if (!record || record.version !== 1 || record.agent !== agent || !Array.isArray(record.decisions)) return null;
  const mine = new Map<string, Listed>();
  for (const entry of record.decisions) {
    const d = fields(entry), wake = fields(d?.wake);
    if (!d || typeof d.decision !== 'string' || !DECISION.test(d.decision) || (d.state !== 'waiting' && d.state !== 'answered')) continue;
    if (wake?.app === 'pi' && wake.session === session) mine.set(d.decision, { state: d.state, reads: typeof d.reads === 'number' ? d.reads : 0 });
  }
  return mine;
}

export function agentpagerWake(pi: Pi, options: Options = {}) {
  const command = options.command ?? ['agentpager'], retryMs = options.retryMs ?? RETRY_MS, offRetryMs = options.offRetryMs ?? OFF_RETRY_MS, confirmMs = options.confirmMs ?? CONFIRM_MS;
  const home = () => options.home ?? (process.env.AGENTPAGER_HOME || path.join(homedir(), '.agentpager'));
  const waitingDir = () => path.join(home(), 'waiting');
  const listed = (agent: string) => session === null ? null : listedIn(path.join(waitingDir(), `${agent}.json`), agent, session);

  let session: string | null = null, ctx: Context | null = null, stopped = false, running = false, told = false;
  // holding: the waits running now. again: a wait to hold again later, by decision; pickAgain: a pickup to run again
  // later, which never keeps a wait from being held. ready: replies to hand over, in the order they came. inFlight: the
  // follow-up sent and not yet started by pi. done: decisions whose reply this run sent, or left out. here: the replies
  // the session's branch holds, by decision, each with whether it carried the answer; elsewhere: those only another
  // branch holds. readBefore: each decision's count of the agent's own reads when this branch was first looked at.
  // tried: the pickups this run has started.
  type Timers = Map<string, ReturnType<typeof setTimeout>>;
  const children = new Set<ChildProcess>(), holding = new Set<string>();
  const again: Timers = new Map(), pickAgain: Timers = new Map();
  const ready = new Map<string, Reply>(), tried = new Set<string>();
  let done = new Set<string>(), here = new Map<string, boolean>(), elsewhere = new Set<string>(), readBefore = new Map<string, number>();
  let inFlight: { replies: Reply[]; tries: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let watcher: FSWatcher | null = null, rescan: ReturnType<typeof setTimeout> | null = null;

  const idle = () => { try { return Boolean(ctx?.isIdle()) && !ctx?.hasPendingMessages(); } catch { return false; } };
  const notify = (message: string) => { try { if (ctx?.hasUI) ctx.ui.notify(message, 'warning'); } catch { /* the session is gone */ } };

  // Stops every child this started, at once, each with its process group.
  const stopChildren = () => {
    for (const child of children) {
      if (child.pid === undefined) continue;
      try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* it ended */ } }
    }
    children.clear();
  };
  const onExit = () => stopChildren();

  // One run of the command, `<args> --json`, in a process group of its own, with this process's environment without the
  // session's wake or the pager's number; ended hears its JSON reply, or null for none.
  const run = (args: string[], ended: (reply: { [k: string]: unknown } | null) => void) => {
    const env = { ...process.env };
    delete env.AGENTPAGER_WAKE; delete env.AGENTPAGER_PAGER;
    let child: ChildProcess;
    try { child = spawn(command[0], [...command.slice(1), ...args, '--json'], { stdio: ['ignore', 'pipe', 'ignore'], env, detached: true, windowsHide: true }); }
    catch { ended(null); return; }
    children.add(child);
    child.unref();
    const chunks: Buffer[] = [];
    let size = 0, over = false;
    child.stdout?.on('data', (b: Buffer) => { size += b.length; if (size <= REPLY_MAX_BYTES) chunks.push(b); });
    child.stdout?.on('error', () => { /* the reply is read on close */ });
    // A socket's unref stops it holding pi open; the pipe still delivers while pi runs.
    const out: unknown = child.stdout;
    if (out && typeof out === 'object' && 'unref' in out && typeof out.unref === 'function') out.unref();
    const end = (reply: { [k: string]: unknown } | null) => { if (over) return; over = true; children.delete(child); if (!stopped) ended(reply); };
    child.on('error', e => {
      if (!told) { told = true; notify(`AgentPager couldn't run the agentpager command to wait for your owner's answer (${'code' in e ? String(e.code) : 'error'}). It keeps trying.`); }
      end(null);
    });
    child.on('close', () => {
      let reply: { [k: string]: unknown } | null = null;
      try { reply = size <= REPLY_MAX_BYTES ? fields(JSON.parse(Buffer.concat(chunks).toString('utf8'))) : null; } catch { reply = null; }
      end(reply);
    });
  };
  const later = (timers: Timers, key: string, ms: number, then: () => void) => {
    if (stopped || timers.has(key)) return;
    const timer = setTimeout(() => { timers.delete(key); if (!stopped) then(); }, ms);
    timer.unref();
    timers.set(key, timer);
  };

  // Whether the agent on this branch is still owed the reply of a decision the record lists: one waiting here is; one
  // answered here is only where another branch was handed its reply and the agent hasn't read it with a wait of its
  // own since this branch was first looked at. (An answered one no branch was handed, the agent read by itself.)
  const owed = (key: string, d: Listed) => d.state === 'waiting' || (elsewhere.has(key) && d.reads === (readBefore.get(key) ?? d.reads));
  // Looks through the record for this session's decisions. One whose answer the branch holds gets its pickup, if it is
  // still waiting here and this run hasn't run it; one the branch holds no reply for gets its wait held while it is owed.
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
      for (const [decision, d] of listedIn(path.join(dir, name), agent, session) ?? []) {
        const key = keyOf(agent, decision), held = here.get(key);
        if (!readBefore.has(key)) readBefore.set(key, d.reads);
        if (held !== undefined || done.has(key)) { if (held === true && d.state === 'waiting' && !tried.has(key)) pickup(agent, decision); continue; }
        if (holding.has(key) || again.has(key) || ready.has(key)) continue;
        if (owed(key, d)) hold(agent, decision);
      }
    }
    deliver();
  };

  // The command's wait that picks nothing up, for one decision: up to 50 s, then held again while it is pending.
  const hold = (agent: string, decision: string) => {
    const key = keyOf(agent, decision), started = Date.now();
    holding.add(key);
    run(['wait', '--agent', agent, decision, '--no-pickup'], reply => {
      holding.delete(key);
      // The owner moved meanwhile to a branch that holds this decision's reply: there is nothing to hand over.
      if (here.has(key)) return scan();
      const result = fields(reply?.result), text = typeof reply?.text === 'string' ? reply.text : null;
      // The answer, or a refusal another wait would only repeat (an answer that doesn't open, an agent file that can't
      // be read): its reply is handed to the agent. A decision that closed unanswered (the agent finished it) or an agent
      // that is gone needs nothing more. Pending is held again at once, or after a second when it came back sooner, so
      // a server that doesn't hold is never spun on; anything else is held again later.
      if (text !== null && reply?.code === 0 && result?.status === 'answered') return collect({ agent, decision, text, answered: true });
      if (text !== null && reply?.code === 2 && result?.status === undefined) return collect({ agent, decision, text, answered: false });
      if ((reply?.code === 2 && result?.status === 'closed') || reply?.code === 6) return;
      const ms = reply?.code === 0 && result?.status === 'pending' ? (Date.now() - started < 1000 ? 1000 : 0) : reply?.code === 4 ? offRetryMs : retryMs;
      later(again, key, ms, scan);
    });
  };
  const collect = (reply: Reply) => { ready.set(keyOf(reply.agent, reply.decision), reply); deliver(); };

  // The agent has the answer: the service is told, until it lands (picked up or acknowledged), the decision closes or
  // leaves the record (its acknowledgement picked it up), or the command says it can't.
  const pickup = (agent: string, decision: string) => {
    const key = keyOf(agent, decision);
    tried.add(key);
    run(['pickup', '--agent', agent, decision], reply => {
      if (reply?.code === 0 || reply?.code === 2 || reply?.code === 6) return;
      later(pickAgain, key, reply?.code === 4 ? offRetryMs : retryMs, () => { const l = listed(agent); if (!l || l.get(decision)?.state === 'waiting') pickup(agent, decision); });
    });
  };

  // The replies among these the agent is still owed, by the record as it is now: a decision the agent read by itself
  // meanwhile is left out, whether it has left the record (acknowledged or closed) or a wait of the agent's own has
  // handed it the answer. A record that can't be read leaves its replies in.
  const stillOwed = (replies: Iterable<Reply>) => {
    const out: Reply[] = [], lists = new Map<string, Map<string, Listed> | null>();
    for (const r of replies) {
      if (!lists.has(r.agent)) lists.set(r.agent, listed(r.agent));
      const key = keyOf(r.agent, r.decision), l = lists.get(r.agent), d = l?.get(r.decision);
      if (l && (!d || !owed(key, d))) { done.add(key); continue; }
      out.push(r);
    }
    return out;
  };
  // Hands the replies waiting over as one follow-up turn, once pi has settled with nothing queued: never into a run.
  const deliver = () => {
    if (stopped || session === null || running || inFlight || ready.size === 0 || !idle()) return;
    const replies = stillOwed([...ready.values()]);
    ready.clear();
    if (replies.length) send(replies, 1);
  };
  const send = (replies: Reply[], tries: number) => {
    for (const r of replies) done.add(keyOf(r.agent, r.decision));
    running = true;
    const sent = { replies, tries, timer: setTimeout(() => unconfirmed(sent), Math.min(confirmMs * 2 ** (tries - 1), CONFIRM_MAX_MS)) };
    sent.timer.unref();
    inFlight = sent;
    const content = replies.map(r => `${r.answered ? `AgentPager: your owner answered decision ${r.decision} (agent ${r.agent}).` : `AgentPager: the wait for decision ${r.decision} (agent ${r.agent}) ended without an answer it could give you.`} The agentpager command's reply:\n\n${r.text}`).join('\n\n');
    pi.sendMessage({ customType: TYPE, content, display: true, details: { decisions: replies.map(r => ({ agent: r.agent, decision: r.decision, answered: r.answered })) } }, { triggerTurn: true, deliverAs: 'followUp' });
  };
  // A follow-up pi never put in the session (it failed before its run began) is sent again until pi starts it, without
  // any reply the agent has read by itself in a run since. Until then nothing is picked up, so the owner is warned
  // after 3 minutes.
  const resend = () => {
    const sent = inFlight;
    if (!sent) return;
    clearTimeout(sent.timer);
    inFlight = null; running = false;
    const replies = stillOwed(sent.replies);
    if (replies.length) send(replies, sent.tries + 1);
  };
  const unconfirmed = (sent: NonNullable<typeof inFlight>) => {
    if (stopped || inFlight !== sent) return;
    if (idle()) return resend();
    sent.timer = setTimeout(() => unconfirmed(sent), Math.min(confirmMs * 2 ** (sent.tries - 1), CONFIRM_MAX_MS));
    sent.timer.unref();
  };

  // The replies the session holds, from its own entries: each turn's message names its decisions and whether it carried
  // the answer. Only those on the branch count as the agent's; this run's own replies on their way still count.
  const handedIn = (entries: readonly unknown[]) => {
    const out = new Map<string, boolean>();
    for (const entry of entries) {
      const e = fields(entry), handed = e?.type === 'custom_message' && e.customType === TYPE ? fields(e.details)?.decisions : undefined;
      if (Array.isArray(handed)) for (const d of handed) { const x = ids(d); if (x) { const key = keyOf(x.agent, x.decision); out.set(key, out.get(key) === true || fields(d)?.answered === true); } }
    }
    return out;
  };
  const recall = (c: Context) => {
    let branch: readonly unknown[] = [], all: readonly unknown[] = [];
    try { branch = c.sessionManager.getBranch(); } catch { branch = []; }
    try { all = c.sessionManager.getEntries(); } catch { all = branch; }
    here = handedIn(branch);
    elsewhere = new Set([...handedIn(all).keys()].filter(key => !here.has(key)));
    // What the agent has read by itself is counted from here on: the scan that follows notes each decision's count.
    readBefore = new Map();
    // A reply this branch already holds isn't handed over on it again: one waiting to be handed over, or sent and not
    // yet started by pi, was collected for the branch the owner left. (A wait still held for it is dropped when it ends.)
    for (const key of [...ready.keys()]) if (here.has(key)) ready.delete(key);
    if (inFlight) {
      inFlight.replies = inFlight.replies.filter(r => !here.has(keyOf(r.agent, r.decision)));
      // pi lets its owner move only while it isn't working, so the run this follow-up was to start hasn't begun.
      if (inFlight.replies.length === 0) { clearTimeout(inFlight.timer); inFlight = null; running = false; }
    }
    done = new Set(inFlight ? inFlight.replies.map(r => keyOf(r.agent, r.decision)) : []);
  };
  pi.on('session_start', (_e, c) => {
    ctx = c;
    let id: string | null = null;
    if (c.mode !== 'print' && c.mode !== 'json') { try { id = c.sessionManager.getSessionId(); } catch { id = null; } }
    if (id === null || !SESSION.test(id)) { delete process.env.AGENTPAGER_WAKE; return; }
    session = id;
    process.env.AGENTPAGER_WAKE = `pi:${id}`;
    recall(c);
    process.off('exit', onExit);
    process.on('exit', onExit);
    scan();
  });
  // The owner moved to another point of the session's tree: what its branch holds is read again.
  pi.on('session_tree', (_e, c) => {
    ctx = c;
    if (session === null) return;
    recall(c);
    scan();
  });
  pi.on('before_agent_start', (e, c) => {
    ctx = c;
    const prompt = e.systemPromptOptions;
    if (session === null || !prompt) return;
    prompt.sections ??= {};
    prompt.sections.agentpager = LINE;
  });
  // The follow-up is in the session once pi starts its message, whether it began a run or joined one: only now does the
  // agent have each answer, so only now is it picked up.
  pi.on('message_start', (e, c) => {
    ctx = c;
    const m = fields(e.message), sent = inFlight;
    if (!sent || m?.role !== 'custom' || m.customType !== TYPE || !Array.isArray(fields(m.details)?.decisions)) return;
    clearTimeout(sent.timer);
    inFlight = null;
    for (const r of sent.replies) if (r.answered) pickup(r.agent, r.decision);
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
    for (const timers of [again, pickAgain]) { for (const t of timers.values()) clearTimeout(t); timers.clear(); }
    if (inFlight) clearTimeout(inFlight.timer);
    if (rescan) clearTimeout(rescan);
    watcher?.close();
    watcher = null;
    if (session !== null && process.env.AGENTPAGER_WAKE === `pi:${session}`) delete process.env.AGENTPAGER_WAKE;
    session = null;
  });
}

export default function (pi: Pi) { agentpagerWake(pi); }
