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

// The command run from this checkout's source, never an agentpager on PATH; anything else as named.
const command = (argv: string[]): [string, string[]] => argv[0] === COMMAND ? [process.execPath, ['--experimental-strip-types', '--no-warnings', main, ...argv.slice(1)]] : [argv[0] ?? '', argv.slice(1)];
// Claude Code as the mod sees it, on this machine: Node's clock, files and processes, with `agentpager` run from source.
type Turn = { text: string; at: number };
function claudeCode(session: string) {
  const turns: Turn[] = [], mine = new Set<number>();
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
    run: argv => new Promise(resolve => execFile(...command(argv), (e, stdout) => resolve({ exitCode: e ? Number(e.code ?? 1) : 0, stdout }))),
    spawn: argv => {
      const child = spawn(...command(argv), { stdio: ['ignore', 'pipe', 'ignore'] });
      if (child.pid) { mine.add(child.pid); pids.add(child.pid); }
      let stdout = '';
      child.stdout.on('data', d => { stdout += d; });
      const done = new Promise<{ code: number | null; stdout: string }>(resolve => child.on('close', code => resolve({ code, stdout })));
      return { done, stop: () => { child.kill('SIGTERM'); } };
    },
    submit: async text => { turns.push({ text, at: Date.now() }); return { entered: true }; },
    debug: () => undefined,
  };
  return { host, turns, pids: mine };
}
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const card = (title: string) => ({ object: { title, detail: 'A plugin test.', context: { summary: 'Ready.' }, options: [{ label: 'Blue', title: 'Blue', prioritizes: 'calm' }, { label: 'Green', title: 'Green', prioritizes: 'speed' }], recommendation: { option: 'A', why: 'Calm.' } } });
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);

let f: Awaited<ReturnType<typeof fixture>>;
// Every mod a test starts, and every process of the command it started, are stopped at the end, whatever the test came to.
const mods: Mod[] = [], pids = new Set<number>();
before(async () => { f = await fixture('claude-code-plugin'); process.env.AGENTPAGER_SERVER = f.origin; });
after(async () => {
  for (const m of mods) m.sessionEnded('prompt_input_exit');
  for (const pid of pids) if (alive(pid)) process.kill(pid, 'SIGTERM');
  await f?.stop();
});
async function seen(p: { pagerId: string; phone: string }, title: string) {
  for (const a of (await f.pager(p.pagerId, p.phone)).agents) {
    const d = [...a.open, ...a.answered].find(x => x.title === title);
    if (d) return { ...d, agentId: a.agent.agentId };
  }
  return undefined;
}

test('B33.2 B32.12 With the plugin, an agent that asks from its shell isn\'t told to wait; its owner\'s answer comes as a turn within a second when Claude is idle, as the next turn when busy, and after a restart, carrying the command\'s reply; it counts as picked up only once that turn has started, and nothing is left running', { timeout: 180_000 }, async () => {
  const p = await f.makePager(), session = randomUUID();
  // Claude Code's shell: CLAUDECODE and its own session id; the mod names the session at its start.
  Object.assign(process.env, { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: session });
  const cc = claudeCode(session), mod = new Mod(cc.host, home);
  mods.push(mod);
  await mod.start();
  assert.equal(process.env.AGENTPAGER_WAKE, `claude-code:${session}`);
  const id = field(await op.connect({ number: p.number, project: 'plugin' }), 'agent');
  const handed = (agent: string, d: string) => existsSync(path.join(home, 'claude-code', `${agent}.${d}`));
  const answer = async (title: string, number: number) => {
    const d = await seen(p, title);
    return (await f.answer(d?.agentId ?? '', p.phone, d?.decisionId ?? '', { kind: 'option', number })).sentAt;
  };

  // Idle.
  const asked = await op.ask(id, card('Which colour?')), d = field(asked, 'decision');
  assert.ok(asked.text.endsWith(`\nDecision ${d}. Don't wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.`), asked.text);
  await until(async () => mod.held, held => held.some(x => x.decision === d && x.state === 'holding'));
  const sentAt = await answer('Which colour?', 2);
  const [turn] = await until(async () => cc.turns, t => t.length > 0);
  assert.ok(turn && turn.at - Date.parse(sentAt) < 1_000, `the turn ${turn ? turn.at - Date.parse(sentAt) : '?'} ms after Send`);
  assert.match(turn?.text ?? '', new RegExp(`^AgentPager: your owner answered decision ${d} \\(agent ${id}\\)\\. The agentpager command's reply:\\n\\nAnswered at .+: option B "Green"\\.\\nDo it, then confirm: agentpager ack --agent ${id} ${d} "<what happens next>"$`));
  await until(async () => (await seen(p, 'Which colour?'))?.collectedAt, at => Boolean(at), 5_000);
  assert.ok(handed(id, d));
  // The agent acknowledges: the decision leaves the record, and the record of handing it over goes.
  await op.ack(id, d, 'Painting it green.');
  await until(async () => handed(id, d), there => !there, 5_000);

  // Busy: the answer is held, and not picked up, until the running turn ends.
  const busy = field(await op.ask(id, card('Which size?')), 'decision');
  await until(async () => mod.held, held => held.some(x => x.decision === busy && x.state === 'holding'));
  await mod.turnStarted();
  await answer('Which size?', 1);
  await until(async () => mod.held, held => held.some(x => x.decision === busy && x.state === 'ready'));
  await new Promise(r => setTimeout(r, 1_500));
  assert.equal(cc.turns.length, 1, 'no turn while one runs');
  assert.equal((await seen(p, 'Which size?'))?.collectedAt, undefined, 'not picked up while Claude is busy');
  const ended = Date.now();
  await mod.turnEnded();
  const next = (await until(async () => cc.turns, t => t.length > 1))[1];
  assert.ok(next && next.at - ended < 1_000 && next.text.includes(`decision ${busy} `), `the next turn ${next ? next.at - ended : '?'} ms after the running one ended`);
  await until(async () => (await seen(p, 'Which size?'))?.collectedAt, at => Boolean(at), 5_000);

  // Claude Code quits before the owner answers: its wait stops with it, and nothing picks the answer up.
  const later = field(await op.ask(id, card('Which shade?')), 'decision');
  await until(async () => mod.held, held => held.some(x => x.decision === later && x.state === 'holding'));
  mod.sessionEnded('prompt_input_exit');
  await until(async () => [...cc.pids].filter(alive), running => running.length === 0, 5_000);
  await answer('Which shade?', 1);
  await new Promise(r => setTimeout(r, 1_500));
  assert.equal((await seen(p, 'Which shade?'))?.collectedAt, undefined);
  // Started again on the same session, the mod hands it over as the first turn, once.
  const again = claudeCode(session), restarted = new Mod(again.host, home);
  mods.push(restarted);
  await restarted.start();
  const [first] = await until(async () => again.turns, t => t.length > 0);
  assert.match(first?.text ?? '', new RegExp(`decision ${later} .*option A "Blue"`, 's'));
  await until(async () => (await seen(p, 'Which shade?'))?.collectedAt, at => Boolean(at), 5_000);
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
    { decision: 'd_aaaa', session: 'sess-1', pickedUp: false }, { decision: 'd_bbbb', session: 'sess-1', pickedUp: true },
    { decision: 'd_dddd', session: null, pickedUp: false }, { decision: 'd_eeee', session: null, pickedUp: false }, { decision: 'd_gggg', session: null, pickedUp: false },
  ] });
});
