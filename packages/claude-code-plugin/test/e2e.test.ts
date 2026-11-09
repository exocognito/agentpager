import { after, before, test } from 'node:test';
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, assert, until } from '../../app/test/support.ts';
import { COMMAND, Mod, decodeRecord, type Host } from '../hooks/wake.ts';

// The Claude Code plugin's mod against the real agentpager command, run from source, and the real service, on the
// suites' local fixture (B33.2, blueprint/areas/2-agents.md). Claude Code alone is a stand-in: its environment is this
// process's, its turns are recorded, and the mod's children are real processes of the command. The real run with
// Claude Code itself is in the pull request.

const main = fileURLToPath(new URL('../../cli/src/main.ts', import.meta.url));
const home = mkdtempSync(path.join(tmpdir(), 'agentpager-plugin-'));
const MARKS = ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CODEX_SANDBOX', 'CODEX_HOME', 'CODEX_THREAD_ID', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'AGENTPAGER_WAKE', 'AGENTPAGER_PAGER'];
for (const v of MARKS) delete process.env[v];
process.env.AGENTPAGER_HOME = home;
const op = await import('../../cli/src/commands.ts');
const store = await import('../../cli/src/store.ts');
const detect = await import('../../cli/src/detect.ts');

// Claude Code as the mod sees it, on this machine: Node's clock, files and processes, with `agentpager` run from source.
type Turn = { text: string; at: number };
function claudeCode(session: string) {
  const turns: Turn[] = [], pids = new Set<number>();
  const host: Host = {
    now: async () => Date.now(),
    after: (ms, fn) => { const t = setTimeout(fn, ms); return { cancel: () => clearTimeout(t) }; },
    every: (ms, fn) => { const t = setInterval(fn, ms); return { cancel: () => clearInterval(t) }; },
    sessionId: async () => session,
    setWake: async value => { if (value === undefined) delete process.env.AGENTPAGER_WAKE; else process.env.AGENTPAGER_WAKE = value; return true; },
    list: async dir => {
      try { return readdirSync(dir).map(name => { const s = statSync(path.join(dir, name)); return { name, kind: s.isFile() ? 'file' : s.isDirectory() ? 'dir' : 'other', size: s.size, mtimeMs: s.mtimeMs }; }); } catch { return null; }
    },
    read: async file => readFileSync(file, 'utf8'),
    exists: async file => existsSync(file),
    run: argv => new Promise(resolve => execFile(argv[0] ?? '', argv.slice(1), (e, stdout) => resolve({ exitCode: e ? Number(e.code ?? 1) : 0, stdout }))),
    spawn: argv => {
      const [bin, ...args] = argv;
      const child = spawn(bin === COMMAND ? process.execPath : bin ?? '', bin === COMMAND ? ['--experimental-strip-types', '--no-warnings', main, ...args] : args, { stdio: ['ignore', 'pipe', 'ignore'] });
      if (child.pid) pids.add(child.pid);
      let stdout = '';
      child.stdout.on('data', d => { stdout += d; });
      const done = new Promise<{ code: number | null; stdout: string }>(resolve => child.on('close', code => resolve({ code, stdout })));
      return { done, stop: () => { child.kill('SIGTERM'); } };
    },
    submit: async text => { turns.push({ text, at: Date.now() }); return { entered: true }; },
    debug: () => undefined,
  };
  return { host, turns, pids };
}
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const card = (title: string) => ({ object: { title, detail: 'A plugin test.', context: { summary: 'Ready.' }, options: [{ label: 'Blue', title: 'Blue', prioritizes: 'calm' }, { label: 'Green', title: 'Green', prioritizes: 'speed' }], recommendation: { option: 'A', why: 'Calm.' } } });
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);

let f: Awaited<ReturnType<typeof fixture>>;
before(async () => { f = await fixture('claude-code-plugin'); process.env.AGENTPAGER_SERVER = f.origin; });
after(async () => { await f?.stop(); });
async function seen(p: { pagerId: string; phone: string }, title: string) {
  for (const a of (await f.pager(p.pagerId, p.phone)).agents) {
    const d = [...a.open, ...a.answered].find(x => x.title === title);
    if (d) return { ...d, agentId: a.agent.agentId };
  }
  return undefined;
}

test('B33.2 B32.12 With the plugin, an agent that asks from its shell isn\'t told to wait, and its owner\'s answer comes as a turn within a second, carrying the command\'s reply; the command picked it up, and nothing is left running', { timeout: 120_000 }, async () => {
  const p = await f.makePager(), session = randomUUID();
  // Claude Code's shell: CLAUDECODE and its own session id; the mod names the session at its start.
  Object.assign(process.env, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: session });
  const cc = claudeCode(session), mod = new Mod(cc.host, home);
  await mod.start();
  assert.equal(process.env.AGENTPAGER_WAKE, `claude-code:${session}`);
  const id = field(await op.connect({ number: p.number, project: 'plugin' }), 'agent');
  const asked = await op.ask(id, card('Which colour?')), d = field(asked, 'decision');
  assert.ok(asked.text.endsWith(`\nDecision ${d}. Don't wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.`), asked.text);
  await until(async () => mod.held, held => held.some(x => x.decision === d && x.state === 'holding'));
  const before = await seen(p, 'Which colour?');
  // The mod's wait is held; the owner answers.
  const { sentAt } = await f.answer(before?.agentId ?? '', p.phone, before?.decisionId ?? '', { kind: 'option', number: 2 });
  const [turn] = await until(async () => cc.turns, t => t.length > 0);
  assert.ok(turn && turn.at - Date.parse(sentAt) < 1_000, `the turn ${turn ? turn.at - Date.parse(sentAt) : '?'} ms after Send`);
  assert.match(turn?.text ?? '', new RegExp(`^AgentPager: your owner answered decision ${d} \\(agent ${id}\\)\\. The agentpager command's reply:\\n\\nAnswered at .+: option B "Green"\\.\\nDo it, then confirm: agentpager ack --agent ${id} ${d} "<what happens next>"$`));
  assert.ok((await seen(p, 'Which colour?'))?.collectedAt, 'the command\'s wait picked it up (B32.12)');
  assert.ok(existsSync(path.join(home, 'claude-code', `${id}.${d}`)), 'claimed');
  // The agent acknowledges: the decision leaves the record, and the claim goes.
  await op.ack(id, d, 'Painting it green.');
  await until(async () => existsSync(path.join(home, 'claude-code', `${id}.${d}`)), there => !there, 5_000);
  // A second question, and Claude Code quits before the owner answers: its wait stops with it.
  const second = field(await op.ask(id, card('Which shade?')), 'decision');
  await until(async () => mod.held, held => held.some(x => x.decision === second && x.state === 'holding'));
  mod.sessionEnded('prompt_input_exit');
  await until(async () => [...cc.pids].filter(alive), running => running.length === 0, 5_000);
  const unseen = await seen(p, 'Which shade?');
  await f.answer(unseen?.agentId ?? '', p.phone, unseen?.decisionId ?? '', { kind: 'option', number: 1 });
  // Started again on the same session, the mod hands it over as the first turn, once.
  const again = claudeCode(session), restarted = new Mod(again.host, home);
  await restarted.start();
  const [first] = await until(async () => again.turns, t => t.length > 0);
  assert.match(first?.text ?? '', new RegExp(`decision ${second} .*option A "Blue"`, 's'));
  await restarted.turnStarted(); await restarted.turnEnded();
  await new Promise(r => setTimeout(r, 2_500));
  assert.equal(again.turns.length, 1);
  restarted.sessionEnded('prompt_input_exit');
  await until(async () => [...again.pids].filter(alive), running => running.length === 0, 5_000);
  for (const v of MARKS) delete process.env[v];
});

test('B33.2 Another Claude Code session started inside one with the plugin, without the plugin, isn\'t taken for it: it gets today\'s background-wait words', () => {
  const shell = (env: Record<string, string>) => detect.identify(undefined, env);
  assert.deepEqual(shell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:s-1', CLAUDE_CODE_SESSION_ID: 's-1' }), { app: 'claude-code', wake: { app: 'claude-code', session: 's-1' } });
  assert.deepEqual(shell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:s-1', CLAUDE_CODE_SESSION_ID: 's-2' }), { app: 'claude-code', wake: null }, 'the variable came from the session it was started in');
  assert.deepEqual(shell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:s-1' }), { app: 'claude-code', wake: { app: 'claude-code', session: 's-1' } }, 'a Claude Code that names no session');
});

test('B33.2 The record the command writes is the one the plugin reads', () => {
  const a: Parameters<typeof store.waitingOf>[0] = {
    id: 'ap-7f3k', server: 'http://x', pager: 'p', agentId: 'A'.repeat(32), agentKey: 'K'.repeat(32), privateKey: 'k'.repeat(43), pagerKey: 'q'.repeat(43),
    app: 'Claude Code', project: 'x', createdAt: '2026-11-09T19:00:00.000Z', rulesShownAt: null, cardsSinceRules: 0,
    decisions: {
      d_aaaa: { id: 'a'.repeat(32), title: 'Mine?', options: ['A', 'B'], askedAt: '2026-11-09T19:00:00.000Z', wake: { app: 'claude-code', session: 'sess-1' } },
      d_bbbb: { id: 'b'.repeat(32), title: 'Answered?', options: ['A', 'B'], answered: true, wake: { app: 'claude-code', session: 'sess-1' } },
      d_cccc: { id: 'c'.repeat(32), title: 'Done?', options: ['A', 'B'], answered: true, acknowledged: true, wake: { app: 'claude-code', session: 'sess-1' } },
      d_dddd: { id: 'd'.repeat(32), title: 'Pi?', options: ['A', 'B'], wake: { app: 'pi', session: 'sess-1' } },
      d_eeee: { id: 'e'.repeat(32), title: 'Codex?', options: ['A', 'B'], wake: { app: 'codex', thread: randomUUID(), via: 'mcp', ring: { at: '2026-11-09T19:00:00.000Z', outcome: 'queued' } } },
      d_ffff: { id: 'f'.repeat(32), title: 'Closed?', options: ['A', 'B'], closed: true, wake: { app: 'claude-code', session: 'sess-1' } },
      d_gggg: { id: 'g'.repeat(32), title: 'No plugin?', options: ['A', 'B'] },
    },
  };
  assert.deepEqual(decodeRecord('ap-7f3k', JSON.stringify(store.waitingOf(a), null, 2)), { agent: 'ap-7f3k', decisions: [
    { decision: 'd_aaaa', session: 'sess-1' }, { decision: 'd_bbbb', session: 'sess-1' },
    { decision: 'd_dddd', session: null }, { decision: 'd_eeee', session: null }, { decision: 'd_gggg', session: null },
  ] });
});
