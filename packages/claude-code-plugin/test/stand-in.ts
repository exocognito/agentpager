import type { Entry, Host, Spawned } from '../hooks/wake.ts';

// A stand-in for Claude Code under the mod (wake.ts › Host): a clock the test moves, a file system in memory, the
// children the mod starts, which the test ends with the command's reply, and Claude Code's own handling of a plugin's
// prompt, as Claude Code 2.1.321 did it in the real run of 9 Nov 2026 (the pull request has it):
// - A prompt waits while a turn or a compaction runs, and its call stays unresolved. A compaction is no turn: the mod
//   is told nothing of it.
// - Everything waiting starts as one turn once Claude Code is idle. Each call resolves entered, and then the mod hears
//   the turn start, with "The agentpager plugin sent a message:" and the last prompt's text.
// - Esc ends the running turn and removes the prompts waiting, whose calls resolve not entered; until the person
//   types, a plugin's prompt is refused at once.
// - After a /clear or a /resume the session's id is still the old one until Claude Code's session-start hooks are
//   done, and a prompt still waiting starts in the conversation that comes next.
// Nothing in it is AgentPager's: the record is written as the command writes it, and the waits answer as the command
// answers.
export type Child = { argv: string[]; stopped: boolean; ended: boolean; exit(stdout: string, code?: number): void };
type Entering = { entered: true } | { entered: false; why: string };
export type Driven = { turnStarted(text?: string): Promise<void>; turnEnded(): Promise<void>; sessionEnded(reason: string, id?: string): void };
export type StandIn = Host & {
  t: number; session: string; wake: (string | undefined)[]; children: Child[]; logs: string[];
  // The mod under it, which hears each turn start and end.
  mod?: Driven;
  // What Claude Code is doing, which keeps a plugin's prompt waiting; whether the person stopped it and hasn't typed since.
  doing: 'turn' | 'compaction' | 'starting' | null; stopped: boolean;
  // The prompts the mod submitted, in order, and of those the ones whose turn has started, with the session it started in.
  submitted: string[]; turns: string[]; turnsIn: string[];
  // The declarations' other reading of submit: the call resolves once its prompt is queued behind a running turn.
  entersWhenQueued: boolean;
  // The other order: the mod hears the turn start before the call resolves.
  startsBeforeEntered: boolean;
  // Each `agentpager pickup` the mod ran, with the turns there were at the time, and what the next one replies.
  pickups: { argv: string[]; turns: number }[]; picking: string;
  files: Map<string, { text: string; mtimeMs: number }>; dirs: Set<string>;
  // Folders whose listing fails, and files whose reading fails, as a file system's can.
  failing: Set<string>;
  advance(ms: number): Promise<void>;
  write(file: string, text: string): void;
  remove(file: string): void;
  running(): Child[];
  // The person's prompt starts a turn; the running turn ends, and then, before what waits starts, `first` happens (a
  // /clear the person queued); the person presses Esc; a compaction runs and ends; Claude Code's start is over.
  type(text?: string): Promise<void>;
  finish(first?: () => void): Promise<void>;
  esc(): Promise<void>;
  compact(): void;
  idle(): Promise<void>;
  // A /clear or a /resume: the session ends now, and its id becomes `next` when `arrive` is called; what waited starts then.
  leave(reason: 'clear' | 'resume', next: string): { arrive(): Promise<void> };
  // Another plugin's prompt, waiting like the mod's own.
  other(text: string): void;
  // Claude Code quits: the mod hears the session end, and what waited is gone with the process.
  quit(): void;
};

export const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));
export const framed = (text: string) => `The agentpager plugin sent a message:\n${text}`;

export function standIn(session = 'session-1'): StandIn {
  const timers: { at: number; fn: () => void; every?: number; cancelled: boolean }[] = [];
  const timer = (ms: number, fn: () => void, every?: number) => {
    const t = { at: h.t + ms, fn, every, cancelled: false };
    timers.push(t);
    return { cancel: () => { t.cancelled = true; } };
  };
  let edits = 0;
  let waiting: { text: string; resolve: (r: Entering) => void }[] = [];
  // Everything waiting starts as one turn, in the session Claude Code is in by then.
  const drain = async () => {
    if (h.doing !== null || waiting.length === 0) return;
    const batch = waiting; waiting = [];
    h.doing = 'turn';
    const enter = () => { for (const p of batch) { h.turns.push(p.text); h.turnsIn.push(h.session); p.resolve({ entered: true }); } };
    const start = () => h.mod?.turnStarted(framed(batch.at(-1)?.text ?? ''));
    // The call's reply and the turn's start reach the mod one after the other, each on its own.
    if (h.startsBeforeEntered) { await start(); enter(); } else { enter(); await new Promise(r => setImmediate(r)); await start(); }
  };
  const h: StandIn = {
    t: 1_000_000, session, wake: [], children: [], logs: [], files: new Map(), dirs: new Set(['/']), failing: new Set(),
    doing: null, stopped: false, submitted: [], turns: [], turnsIn: [], entersWhenQueued: false, startsBeforeEntered: false,
    pickups: [], picking: JSON.stringify({ code: 0, text: 'Picked up.', result: { status: 'picked-up' } }) + '\n',
    now: async () => h.t,
    after: (ms, fn) => timer(ms, fn),
    every: (ms, fn) => timer(ms, fn, ms),
    sessionId: async () => h.session,
    setWake: async value => { h.wake.push(value); return true; },
    list: async dir => {
      if (h.failing.has(dir)) throw new Error('EIO');
      if (!h.dirs.has(dir)) return null;
      const out: Entry[] = [];
      for (const [file, f] of h.files) if (parent(file) === dir) out.push({ name: file.slice(dir.length + 1), kind: 'file', size: f.text.length, mtimeMs: f.mtimeMs });
      for (const d of h.dirs) if (d !== dir && parent(d) === dir) out.push({ name: d.slice(dir.length + 1), kind: 'dir', size: 0, mtimeMs: 0 });
      return out;
    },
    read: async file => { const f = h.files.get(file); if (!f || h.failing.has(file)) throw new Error(f ? 'EIO' : 'ENOENT'); return f.text; },
    exists: async file => h.files.has(file) || h.dirs.has(file),
    run: async argv => {
      const [bin, ...args] = argv;
      if (bin === '/bin/mkdir' && args[0] === '-p') {
        for (let d = args.at(-1) ?? ''; d && d !== '/'; d = parent(d)) h.dirs.add(d);
        return { exitCode: 0, stdout: '' };
      }
      if (bin === '/bin/mkdir') {
        const d = args[0] ?? '';
        if (h.dirs.has(d) || !h.dirs.has(parent(d))) return { exitCode: 1, stdout: '' };
        h.dirs.add(d);
        return { exitCode: 0, stdout: '' };
      }
      if (bin === '/bin/rmdir') return { exitCode: h.dirs.delete(args[0] ?? '') ? 0 : 1, stdout: '' };
      if (bin === 'agentpager' && args[0] === 'pickup') { h.pickups.push({ argv, turns: h.turns.length }); return { exitCode: 0, stdout: h.picking }; }
      return { exitCode: 127, stdout: '' };
    },
    spawn: (argv): Spawned => {
      let end: (r: { code: number | null; stdout: string }) => void = () => undefined;
      const done = new Promise<{ code: number | null; stdout: string }>(r => { end = r; });
      const child: Child = { argv, stopped: false, ended: false, exit: (stdout, code = 0) => { child.ended = true; end({ code, stdout }); } };
      h.children.push(child);
      return { done, stop: () => { child.stopped = true; end({ code: null, stdout: '' }); } };
    },
    submit: text => new Promise<Entering>(resolve => {
      h.submitted.push(text);
      if (h.stopped) { resolve({ entered: false, why: 'the session was stopped and nobody has sent input since' }); return; }
      waiting.push({ text, resolve });
      if (h.doing === null) void drain();
      else if (h.entersWhenQueued && h.doing === 'turn') resolve({ entered: true });
    }),
    debug: line => { h.logs.push(line); },
    async advance(ms) {
      const until = h.t + ms;
      for (;;) {
        await settle();
        const due = timers.filter(t => !t.cancelled && t.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        h.t = Math.max(h.t, due.at);
        if (due.every) due.at += due.every; else due.cancelled = true;
        due.fn();
      }
      h.t = until;
      await settle();
    },
    write(file, text) {
      for (let d = parent(file); d && d !== '/'; d = parent(d)) h.dirs.add(d);
      h.files.set(file, { text, mtimeMs: h.t + ++edits });
    },
    remove(file) { h.files.delete(file); },
    // A child runs until it exits or is stopped.
    running: () => h.children.filter(c => !c.stopped && !c.ended),
    async type(text = 'Carry on.') {
      if (h.doing !== null) throw new Error(`the stand-in is in a ${h.doing}: a prompt typed now would wait`);
      h.stopped = false; h.doing = 'turn';
      await h.mod?.turnStarted(text);
      await settle();
    },
    async finish(first) {
      if (h.doing !== 'turn') throw new Error('no turn is running');
      h.doing = null;
      await h.mod?.turnEnded();
      first?.();
      await drain();
      await settle();
    },
    async esc() {
      if (h.doing !== 'turn') throw new Error('no turn is running');
      const removed = waiting; waiting = [];
      for (const p of removed) p.resolve({ entered: false, why: 'the prompt was removed from the queue before it ran' });
      h.doing = null; h.stopped = true;
      // The removal reaches the mod before the turn's end does (10 ms before, in the real run).
      await new Promise(r => setImmediate(r));
      await h.mod?.turnEnded();
      await settle();
    },
    compact() {
      if (h.doing !== null) throw new Error(`the stand-in is in a ${h.doing}`);
      h.doing = 'compaction';
    },
    async idle() {
      if (h.doing === 'turn') throw new Error('a turn ends with finish or esc');
      h.doing = null;
      await drain();
      await settle();
    },
    leave(reason, next) {
      if (h.doing === 'turn') throw new Error('a /clear or a /resume waits for the running turn to end');
      h.doing = 'starting';
      h.mod?.sessionEnded(reason, h.session);
      return { arrive: async () => { h.session = next; h.doing = null; await drain(); await settle(); } };
    },
    other(text) { waiting.push({ text, resolve: () => undefined }); if (h.doing === null) void drain(); },
    quit() {
      h.mod?.sessionEnded('prompt_input_exit', h.session);
      h.mod = undefined; waiting = []; h.doing = null; h.stopped = false;
    },
  };
  return h;
}

// The record of what's waiting, as the command writes it (packages/cli/src/store.ts › waitingOf).
export type Wake = { app: 'claude-code' | 'pi'; session: string } | { app: 'codex'; thread: string; rung?: string };
export const record = (agent: string, decisions: { decision: string; state?: 'waiting' | 'answered'; reads?: number; wake?: Wake }[]) =>
  JSON.stringify({ version: 1, agent, decisions: decisions.map(d => ({ decision: d.decision, askedAt: '2026-11-09T19:00:00.000Z', state: d.state ?? 'waiting', ...(d.reads ? { reads: d.reads } : {}), ...(d.wake ? { wake: d.wake } : {}) })) }, null, 2) + '\n';
// The command's `--json` replies to a wait (packages/cli/src/main.ts, commands.ts › wait).
export const reply = {
  answered: (text: string) => JSON.stringify({ code: 0, text, result: { status: 'answered', option: 'A' } }) + '\n',
  pending: () => JSON.stringify({ code: 0, text: 'Pending. Your owner hasn\'t answered "Which plan?" yet.', result: { status: 'pending' } }) + '\n',
  refused: (text: string) => JSON.stringify({ code: 2, text }) + '\n',
  off: () => JSON.stringify({ code: 4, text: 'Not sent. This pager is turned off.' }) + '\n',
  unreachable: () => JSON.stringify({ code: 5, text: 'Can\'t reach the server.' }) + '\n',
  unknown: (agent: string) => JSON.stringify({ code: 6, text: `No agent ${agent} on this machine.` }) + '\n',
};
