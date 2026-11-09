import type { Entry, Host, Spawned } from '../hooks/wake.ts';

// A stand-in for Claude Code under the mod (wake.ts › Host): a clock the test moves, a file system in memory, the
// children the mod starts, which the test ends with the command's reply, and the turns the mod submits. Nothing in it
// is AgentPager's: the record is written as the command writes it, and the waits answer as the command answers.
export type Child = { argv: string[]; stopped: boolean; ended: boolean; exit(stdout: string, code?: number): void };
export type StandIn = Host & {
  t: number; session: string; wake: (string | undefined)[]; children: Child[]; turns: string[]; logs: string[];
  // Each `agentpager pickup` the mod ran, with the turns there were at the time, and what the next one replies.
  pickups: { argv: string[]; turns: number }[]; picking: string;
  files: Map<string, { text: string; mtimeMs: number }>; dirs: Set<string>;
  // What the next submit comes to: entered (and a turn starts, when started is given), or not taken.
  taking: { entered: true } | { entered: false; why: string };
  started?: () => Promise<void>;
  advance(ms: number): Promise<void>;
  write(file: string, text: string): void;
  remove(file: string): void;
  running(): Child[];
};

export const settle = async () => { for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r)); };
const parent = (p: string) => p.slice(0, p.lastIndexOf('/'));

export function standIn(session = 'session-1'): StandIn {
  const timers: { at: number; fn: () => void; every?: number; cancelled: boolean }[] = [];
  const timer = (ms: number, fn: () => void, every?: number) => {
    const t = { at: h.t + ms, fn, every, cancelled: false };
    timers.push(t);
    return { cancel: () => { t.cancelled = true; } };
  };
  let edits = 0;
  const h: StandIn = {
    t: 1_000_000, session, wake: [], children: [], turns: [], logs: [], files: new Map(), dirs: new Set(['/']),
    pickups: [], picking: JSON.stringify({ code: 0, text: 'Picked up.' }) + '\n',
    taking: { entered: true },
    now: async () => h.t,
    after: (ms, fn) => timer(ms, fn),
    every: (ms, fn) => timer(ms, fn, ms),
    sessionId: async () => h.session,
    setWake: async value => { h.wake.push(value); return true; },
    list: async dir => {
      if (!h.dirs.has(dir)) return null;
      const out: Entry[] = [];
      for (const [file, f] of h.files) if (parent(file) === dir) out.push({ name: file.slice(dir.length + 1), kind: 'file', size: f.text.length, mtimeMs: f.mtimeMs });
      for (const d of h.dirs) if (d !== dir && parent(d) === dir) out.push({ name: d.slice(dir.length + 1), kind: 'dir', size: 0, mtimeMs: 0 });
      return out;
    },
    read: async file => { const f = h.files.get(file); if (!f) throw new Error('ENOENT'); return f.text; },
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
    submit: async text => {
      h.turns.push(text);
      const r = h.taking;
      if (r.entered && h.started) await h.started();
      return r;
    },
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
  };
  return h;
}

// The record of what's waiting, as the command writes it (packages/cli/src/store.ts › waitingOf).
export type Wake = { app: 'claude-code' | 'pi'; session: string } | { app: 'codex'; thread: string; rung?: string };
export const record = (agent: string, decisions: { decision: string; state?: 'waiting' | 'answered'; wake?: Wake }[]) =>
  JSON.stringify({ version: 1, agent, decisions: decisions.map(d => ({ decision: d.decision, askedAt: '2026-11-09T19:00:00.000Z', state: d.state ?? 'waiting', ...(d.wake ? { wake: d.wake } : {}) })) }, null, 2) + '\n';
// The command's `--json` replies to a wait (packages/cli/src/main.ts, commands.ts › wait).
export const reply = {
  answered: (text: string) => JSON.stringify({ code: 0, text, result: { status: 'answered', option: 'A' } }) + '\n',
  pending: () => JSON.stringify({ code: 0, text: 'Pending. Your owner hasn\'t answered "Which plan?" yet.', result: { status: 'pending' } }) + '\n',
  refused: (text: string) => JSON.stringify({ code: 2, text }) + '\n',
  off: () => JSON.stringify({ code: 4, text: 'Not sent. This pager is turned off.' }) + '\n',
  unreachable: () => JSON.stringify({ code: 5, text: 'Can\'t reach the server.' }) + '\n',
  unknown: (agent: string) => JSON.stringify({ code: 6, text: `No agent ${agent} on this machine.` }) + '\n',
};
