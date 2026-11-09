import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, assert, pause, until } from '../../app/test/support.ts';

// How each supported app is woken from the command's side (B33, blueprint/areas/2-agents.md;
// docs/research/2026-11-08-clients-wake-lab.md): who's asking (B33.1), the words for an app whose AgentPager adapter
// wakes it, the record of what's waiting that the adapters read, and Codex's doorbell (B33.4). A stand-in for the Codex
// CLI records each call's arguments, so no real Codex thread is ever rung; CODEX_HOME is a folder of the test's own.

const cli = fileURLToPath(new URL('..', import.meta.url)), main = path.join(cli, 'src', 'main.ts');
const work = mkdtempSync(path.join(tmpdir(), 'agentpager-wake-'));
const home = path.join(work, 'home'), codexHome = path.join(work, 'codex'), bin = path.join(work, 'bin'), calls = path.join(work, 'codex-calls.jsonl');
mkdirSync(bin); mkdirSync(codexHome);
const MARKS = ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CODEX_THREAD_ID', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'AGENTPAGER_WAKE', 'AGENTPAGER_PAGER'];
for (const v of MARKS) delete process.env[v];
process.env.AGENTPAGER_HOME = home; process.env.CODEX_HOME = codexHome; process.env.FAKE_CODEX_LOG = calls;

// The stand-ins, by name: codex-ok queues, codex-slow takes 5 s, codex-gone doesn't know the thread, codex-old is
// 0.148.0, from before `codex queue`, codex-flaky fails on its own twice for a thread and then queues, and codex-broken
// always fails on its own. Each records the arguments of every call but --version, and what it was given of the asking
// turn's environment.
const fake = (mode: string) => {
  const file = path.join(bin, `codex-${mode}`);
  writeFileSync(file, `#!${process.execPath}
const fs = require('node:fs'), mode = ${JSON.stringify(mode)}, args = process.argv.slice(2);
if (args[0] === '--version') { console.log(mode === 'old' ? 'codex-cli 0.148.0' : 'codex-cli 0.163.0'); process.exit(0); }
fs.appendFileSync(process.env.FAKE_CODEX_LOG, JSON.stringify({ at: Date.now(), mode, args, thread: process.env.CODEX_THREAD_ID ?? null, number: process.env.AGENTPAGER_PAGER ?? null }) + '\\n');
const before = fs.readFileSync(process.env.FAKE_CODEX_LOG, 'utf8').split('\\n').filter(l => l.includes(JSON.stringify(args[1]))).length - 1;
if (mode === 'slow') setTimeout(() => process.exit(0), 5000);
else if (mode === 'gone') { console.error('Error: no rollout found for thread id ' + args[1].slice(9)); process.exit(1); }
else if (mode === 'broken' || (mode === 'flaky' && before < 2)) { console.error('Error: failed to connect to the app server'); process.exit(1); }
else console.log('Queued message 01a1bc92-4382-7a62-8528-471b87561f05 for thread ' + args[1].slice(9) + '.');
`);
  chmodSync(file, 0o755);
  return file;
};
const codex = { ok: fake('ok'), slow: fake('slow'), gone: fake('gone'), old: fake('old'), flaky: fake('flaky'), broken: fake('broken') };
process.env.AGENTPAGER_CODEX = codex.ok;
type Call = { at: number; mode: string; args: string[]; thread: string | null; number: string | null };
const rang = (): Call[] => existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const ringsFor = (thread: string) => rang().filter(c => c.args[1] === `--thread=${thread}`);

// A Codex thread id as Codex makes them (UUID v7, its time first), and its rollout as Codex files it.
const v7 = () => {
  const t = Date.now().toString(16).padStart(12, '0'), r = randomBytes(10).toString('hex');
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-7${r.slice(0, 3)}-${(8 + (parseInt(r[3], 16) & 3)).toString(16)}${r.slice(4, 7)}-${r.slice(7, 19)}`;
};
function rollout(thread: string, payload: { source: unknown; originator: string; thread_source?: string }) {
  const day = new Date(parseInt(thread.replace(/-/g, '').slice(0, 12), 16)), pad = (n: number) => String(n).padStart(2, '0');
  const dir = path.join(codexHome, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()));
  mkdirSync(dir, { recursive: true });
  const meta = { timestamp: day.toISOString(), type: 'session_meta', payload: { id: thread, ...payload, cwd: work, base_instructions: { text: 'x'.repeat(20_000) } } };
  writeFileSync(path.join(dir, `rollout-2026-11-08T19-11-02-${thread}.jsonl`), JSON.stringify(meta) + '\n' + JSON.stringify({ type: 'turn_context' }) + '\n');
}
const terminal = { source: 'vscode', originator: 'codex-tui', thread_source: 'user' }, exec = { source: 'exec', originator: 'codex_exec', thread_source: 'user' };
// What a Codex tool call carries, as Codex 0.163.0 sent it in the lab.
const meta = (thread: string, turn: { trigger?: string; source?: string; id?: string } = {}) => ({ threadId: thread, 'x-codex-turn-metadata': { thread_id: turn.id ?? thread, turn_trigger: turn.trigger ?? 'user', thread_source: turn.source ?? 'user', codex_version: '0.163.0' } });

const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);
const card = (title: string) => ({ object: { title, detail: 'A wake test.', context: { summary: 'Ready.' }, options: [{ label: 'Blue', title: 'Blue', prioritizes: 'calm' }, { label: 'Red', title: 'Red', prioritizes: 'speed' }], recommendation: { option: 'A', why: 'Calm.' } } });
const op = await import('../src/commands.ts');
const store = await import('../src/store.ts');
const detect = await import('../src/detect.ts');
const wake = await import('../src/codex.ts');
const NUDGE = 'AgentPager can\'t wake an agent in this app, so when your owner answers, they may have to nudge you to read it.';
const codexMcp = (id: string, d: string) => `Don't wait for it: when your owner answers, a note that the answer is in comes to this thread. Carry on or end your turn, and when the note comes, call the agentpager wait tool (agent ${id}, decision ${d}) to read it.`;
const codexShell = (id: string, d: string) => `Don't wait for it: when your owner answers, a note that the answer is in comes to this thread. Carry on or end your turn, and when the note comes, run agentpager wait --agent ${id} ${d} to read it.`;
const everyone = (id: string, d: string) => `Wait for the answer with: agentpager wait --agent ${id} ${d}`;

// The watcher a decision has now, by its process id, and whether that process is still there.
const watcherOf = (id: string, d: string) => { const w = store.loadAgent(id)?.decisions[d]?.wake; return w?.app === 'codex' ? w.watcher : undefined; };
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const running = (pid: number) => { try { return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const started = new Set<number>();
const watcherStarts = async (id: string, d: string) => {
  const pid = await until(async () => watcherOf(id, d), p => p !== undefined);
  if (pid !== undefined) started.add(pid);
  return pid ?? 0;
};
const record = (id: string): unknown => JSON.parse(readFileSync(store.waitingPath(id), 'utf8'));
// Where each of the record's decisions stands, read without a cast.
const states = (id: string) => {
  const r = record(id), ds = typeof r === 'object' && r !== null ? Reflect.get(r, 'decisions') : undefined;
  return Array.isArray(ds) ? ds.map((d: unknown) => typeof d === 'object' && d !== null ? Reflect.get(d, 'state') : undefined) : [];
};

let f: Awaited<ReturnType<typeof fixture>>;
before(async () => { f = await fixture('cli-wake'); process.env.AGENTPAGER_SERVER = f.origin; });
// Only the watchers these tests started are stopped, by their process ids, if any is still there: those the tests saw
// start, and any other that put itself in an agent file of this test's home.
after(async () => {
  for (const id of store.agentIds()) for (const d of Object.values(store.loadAgent(id)?.decisions ?? {})) if (d.wake?.app === 'codex' && d.wake.watcher) started.add(d.wake.watcher);
  for (const pid of started) if (alive(pid) && running(pid).includes(' watch --agent ')) process.kill(pid, 'SIGTERM');
  await f?.stop();
});

// A shell with only these of the apps' variables; a Codex thread's reads the test's own CODEX_HOME.
const inShell = (env: Record<string, string>) => {
  for (const v of MARKS) delete process.env[v];
  Object.assign(process.env, env);
  if (env.CODEX_THREAD_ID && !env.CODEX_HOME) process.env.CODEX_HOME = codexHome;
};
// A decision as the phone sees it, with its agent's id on the service.
async function decisionId(p: { pagerId: string; phone: string }, title: string) {
  for (const a of (await f.pager(p.pagerId, p.phone)).agents) {
    const d = [...a.open, ...a.answered].find(x => x.title === title);
    if (d) return { ...d, agentId: a.agent.agentId };
  }
  return undefined;
}

test('B33.1 B33.4 The command names an agent\'s app only for certain: Codex by its thread, never a codex exec turn or a thread Codex started itself, and an adapter\'s session by AGENTPAGER_WAKE', () => {
  const thread = v7(), execThread = v7(), helper = v7(), unknown = v7();
  rollout(thread, terminal); rollout(execThread, exec); rollout(helper, { source: { subagent: { thread_spawn: {} } }, originator: 'codex-tui', thread_source: 'subagent' });
  const shell = (env: Record<string, string>) => { inShell(env); return detect.identify(); };
  assert.deepEqual(shell({ CODEX_THREAD_ID: thread }), { app: 'codex', via: 'shell', thread }, 'Codex\'s shell, its rollout the terminal\'s');
  assert.deepEqual(shell({ CODEX_THREAD_ID: execThread }), { app: 'codex', via: 'shell', thread: null }, 'a codex exec run');
  assert.deepEqual(shell({ CODEX_THREAD_ID: helper }), { app: 'codex', via: 'shell', thread: null }, 'a thread Codex started as a helper');
  assert.deepEqual(shell({ CODEX_THREAD_ID: unknown }), { app: 'codex', via: 'shell', thread: null }, 'no rollout: nothing says how its turn started');
  assert.equal(shell({ CODEX_THREAD_ID: thread, CLAUDECODE: '1' }), null, 'Codex inside Claude Code, or the other way round');
  assert.deepEqual(shell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:sess-1.A_b' }), { app: 'claude-code', wake: { app: 'claude-code', session: 'sess-1.A_b' } });
  assert.deepEqual(shell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code' }), { app: 'claude-code', wake: null }, 'the lab\'s value names no session');
  assert.equal(shell({ AGENTPAGER_WAKE: 'claude-code:sess-1' }), null, 'Claude Code\'s adapter, outside Claude Code');
  assert.deepEqual(shell({ AGENTPAGER_WAKE: 'pi:7f3k-1' }), { app: 'pi', wake: { app: 'pi', session: '7f3k-1' } });
  for (const bad of ['pi:', 'pi:has space', 'other:x', `pi:${'x'.repeat(129)}`]) assert.equal(shell({ AGENTPAGER_WAKE: bad }), null, bad);
  assert.equal(shell({ AGENTPAGER_WAKE: 'pi:7f3k-1', CLAUDECODE: '1' }), null, 'pi inside Claude Code, or the other way round');
  assert.equal(shell({ AGENTPAGER_WAKE: 'pi:7f3k-1', CODEX_THREAD_ID: thread }), null, 'pi inside Codex');

  // Over MCP the client names the app; the call's _meta names Codex's thread.
  inShell({ AGENTPAGER_WAKE: 'claude-code:sess-1' }); process.env.CODEX_HOME = codexHome;
  const mcp = (client: string, m?: unknown) => detect.identify({ client, meta: m });
  assert.deepEqual(mcp('claude-code'), { app: 'claude-code', wake: null }, 'an MCP server\'s AGENTPAGER_WAKE may name an earlier session');
  assert.deepEqual(mcp('codex-mcp-client', meta(thread)), { app: 'codex', via: 'mcp', thread }, 'a typed turn');
  assert.deepEqual(mcp('codex-mcp-client', meta(unknown, { trigger: 'queue' })), { app: 'codex', via: 'mcp', thread: unknown }, 'a queued turn, its rollout not found');
  assert.deepEqual(mcp('codex-mcp-client', meta(unknown, { trigger: 'exec' })), { app: 'codex', via: 'mcp', thread: null }, 'codex exec');
  assert.deepEqual(mcp('codex-mcp-client', meta(execThread)), { app: 'codex', via: 'mcp', thread: null }, 'a turn that says user, in a codex exec rollout');
  assert.deepEqual(mcp('codex-mcp-client', meta(unknown, { source: 'subagent' })), { app: 'codex', via: 'mcp', thread: null }, 'a helper\'s thread');
  assert.deepEqual(mcp('codex-mcp-client', meta(thread, { id: v7() })), { app: 'codex', via: 'mcp', thread: null }, 'two threads named');
  assert.deepEqual(mcp('codex-mcp-client', { threadId: 'my-thread' }), { app: 'codex', via: 'mcp', thread: null }, 'not a thread id');
  assert.deepEqual(mcp('codex-mcp-client'), { app: 'codex', via: 'mcp', thread: null }, 'no _meta');
  assert.equal(mcp('cursor-vscode', meta(thread)), null, 'another client\'s _meta names nothing');
  for (const v of MARKS) delete process.env[v];
});

test('B33.4 The Codex CLI that rings is 0.149 or later, AGENTPAGER_CODEX\'s when set, else the one on PATH', () => {
  const env = (e: Record<string, string>) => ({ HOME: process.env.HOME ?? '', ...e });
  assert.equal(wake.codexCli(env({ AGENTPAGER_CODEX: codex.ok })), codex.ok);
  assert.equal(wake.codexCli(env({ AGENTPAGER_CODEX: codex.old })), null, 'from before codex queue');
  assert.equal(wake.codexCli(env({ AGENTPAGER_CODEX: path.join(bin, 'none') })), null, 'not there');
  assert.equal(wake.codexCli(env({ AGENTPAGER_CODEX: 'codex-ok' })), null, 'a name, not a path');
  const onPath = mkdtempSync(path.join(work, 'path-'));
  writeFileSync(path.join(onPath, 'codex'), readFileSync(codex.ok)); chmodSync(path.join(onPath, 'codex'), 0o755);
  assert.equal(wake.codexCli(env({ PATH: `relative:${onPath}` })), path.join(onPath, 'codex'));
  assert.deepEqual(wake.threadOfCall(meta('01A1BC86-BF16-7680-BB35-FB51454A1782')), { thread: '01A1BC86-BF16-7680-BB35-FB51454A1782', trigger: 'user', source: 'user' });
  assert.deepEqual(wake.threadOfCall({ threadId: '01a1bc86-bf16-7680-bb35-fb51454a1782' }), { thread: '01a1bc86-bf16-7680-bb35-fb51454a1782', trigger: null, source: null });
  for (const bad of [null, [], 'x', { threadId: 7 }, { threadId: '01a1bc86-bf16-7680-bb35-fb51454a178' }, { threadId: '01a1bc86-bf16-7680-bb35-fb51454a1782 ', 'x-codex-turn-metadata': {} }]) assert.equal(wake.threadOfCall(bad), null, JSON.stringify(bad));
  assert.equal(wake.note('ap-7f3k', 'd_2x8w', 'mcp'), 'AgentPager: your owner answered decision d_2x8w. Call the agentpager wait tool (agent ap-7f3k, decision d_2x8w) to read the answer, then acknowledge it.');
  assert.equal(wake.note('ap-7f3k', 'd_2x8w', 'shell'), 'AgentPager: your owner answered decision d_2x8w. Run agentpager wait --agent ap-7f3k d_2x8w to read the answer, then acknowledge it.');
});

test('B33.4 B33.1 B32.12 A Codex thread that asks over MCP is told a note will come; its watcher outlives Codex, rings that thread once without the answer, and never picks the answer up: the agent\'s own wait does', { timeout: 120_000 }, async () => {
  const p = await f.makePager(), thread = v7();
  rollout(thread, terminal);
  const client = new Client({ name: 'codex-mcp-client', version: '0.163.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--experimental-strip-types', main, 'mcp'], env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', AGENTPAGER_HOME: home, AGENTPAGER_SERVER: f.origin, AGENTPAGER_CODEX: codex.ok, CODEX_HOME: codexHome, FAKE_CODEX_LOG: calls, AGENTPAGER_PAGER: p.number }, stderr: 'ignore' }));
  const say = async (name: string, args: Record<string, unknown>, m: ReturnType<typeof meta> = meta(thread)) => {
    const r = await client.callTool({ name, arguments: args, _meta: m });
    const content = Array.isArray(r.content) ? r.content : [];
    return typeof content[0]?.text === 'string' ? content[0].text : '';
  };
  let closed = false;
  try {
    const connected = await say('connect', { number: p.number, project: 'wake' });
    assert.ok(!connected.includes(NUDGE), 'a Codex thread a note can wake needs no nudge');
    const id = connected.match(/agent (ap-[a-z0-9]{4})/)?.[1] ?? '';
    const asked = await say('ask', { agent: id, card: card('Which colour, over MCP?').object });
    const d = asked.match(/Decision (d_[a-z0-9]{4})\./)?.[1] ?? '';
    assert.ok(asked.endsWith(`\nDecision ${d}. ${codexMcp(id, d)}`), asked);
    const pid = await watcherStarts(id, d);
    assert.match(running(pid), new RegExp(` watch --agent ${id} ${d}$`), 'a process of its own, naming only the agent and the decision');
    assert.equal(await say('wait', { agent: id, decision: d, seconds: 1 }), `Pending. Your owner hasn't answered "Which colour, over MCP?" yet.\nDon't wait for it: a note that the answer is in comes to this thread when your owner answers. Carry on or end your turn, and when the note comes, call the agentpager wait tool (agent ${id}, decision ${d}) to read it.`);
    assert.equal(watcherOf(id, d), pid, 'the same watcher still runs: a wait starts none');
    assert.deepEqual(record(id), { version: 1, agent: id, decisions: [{ decision: d, askedAt: store.loadAgent(id)?.decisions[d]?.askedAt, state: 'waiting', wake: { app: 'codex', thread } }] });

    // Codex quits, and with it the command's MCP server; the watcher stays.
    await client.close(); closed = true;
    assert.ok(alive(pid), 'the watcher outlives the call that asked, and Codex');
    const seen = await decisionId(p, 'Which colour, over MCP?');
    const answer = 'Blue, and tell nobody the launch code 4417';
    const receipt = await f.answer(seen?.agentId ?? '', p.phone, seen?.decisionId ?? '', { kind: 'feedback', text: answer });
    const [call] = await until(async () => ringsFor(thread), c => c.length > 0);
    assert.deepEqual(call.args, ['queue', `--thread=${thread}`, `--message=AgentPager: your owner answered decision ${d}. Call the agentpager wait tool (agent ${id}, decision ${d}) to read the answer, then acknowledge it.`]);
    assert.ok(!JSON.stringify(call).includes('4417') && !JSON.stringify(call).includes('Blue'), 'the note never holds the answer');
    assert.deepEqual([call.thread, call.number], [null, null], 'codex queue gets neither the asking turn\'s thread variable nor the pager\'s number');
    const ms = call.at - Date.parse(receipt.sentAt);
    assert.ok(ms < 3000, `rung ${ms} ms after Send, at once rather than on a poll`);
    await until(async () => alive(pid), up => !up);
    assert.deepEqual(record(id), { version: 1, agent: id, decisions: [{ decision: d, askedAt: store.loadAgent(id)?.decisions[d]?.askedAt, state: 'waiting', wake: { app: 'codex', thread, rung: 'queued' } }] });
    assert.equal(watcherOf(id, d), undefined, 'the watcher is gone, and says so');
    assert.equal((await decisionId(p, 'Which colour, over MCP?'))?.collectedAt, undefined, 'the watcher saw the answer but never picked it up, so the owner would still be warned');

    // The note's turn: the agent's own wait reads the answer, and its acknowledgement takes it off the record.
    const again = new Client({ name: 'codex-mcp-client', version: '0.163.0' });
    await again.connect(new StdioClientTransport({ command: process.execPath, args: ['--experimental-strip-types', main, 'mcp'], env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', AGENTPAGER_HOME: home, AGENTPAGER_SERVER: f.origin, AGENTPAGER_CODEX: codex.ok, CODEX_HOME: codexHome, FAKE_CODEX_LOG: calls }, stderr: 'ignore' }));
    try {
      const r = await again.callTool({ name: 'wait', arguments: { agent: id, decision: d }, _meta: meta(thread, { trigger: 'queue' }) });
      assert.match(JSON.stringify(r.content), /launch code 4417/);
      assert.deepEqual(states(id), ['answered']);
      assert.ok((await decisionId(p, 'Which colour, over MCP?'))?.collectedAt, 'the agent\'s wait picked it up');
      await again.callTool({ name: 'ack', arguments: { agent: id, decision: d, nextSteps: 'Blue it is.' }, _meta: meta(thread, { trigger: 'queue' }) });
      assert.deepEqual(record(id), { version: 1, agent: id, decisions: [] });
    } finally { await again.close(); }
    assert.equal(ringsFor(thread).length, 1, 'rung once');
  } finally { if (!closed) await client.close(); }
});

test('B33.4 A thread is rung once, recorded before codex queue runs: never again after a timed-out call, a call cut off, or a second watcher, and never by a watcher that started too late; a pager turned off and on again, a lock a dead process left, or a call that fails on its own, still rings', { timeout: 120_000 }, async () => {
  inShell({});
  const p = await f.makePager(), id = field(await op.connect({ number: p.number, app: 'Codex', project: 'wake' }), 'agent');
  // Decisions asked from a shell no app marks, each then given a Codex thread's wake, as an ask from that thread records it.
  const asked = async (title: string, thread: string) => {
    const d = field(await op.ask(id, card(title)), 'decision');
    store.updateAgent(id, x => { x.decisions[d].wake = { app: 'codex', thread, via: 'shell' }; });
    return { d, thread, seen: await decisionId(p, title) };
  };
  const answer = (x: { seen?: { agentId: string; decisionId: string } }) => f.answer(x.seen?.agentId ?? '', p.phone, x.seen?.decisionId ?? '', { kind: 'option', number: 1 });

  // A call that runs past its time may have queued: it is never made again.
  const slow = await asked('Timed out?', v7());
  process.env.AGENTPAGER_CODEX = codex.slow;
  const watching = op.watch(id, slow.d, { queueTimeoutMs: 300 });
  await until(async () => watcherOf(id, slow.d), pid => pid === process.pid);
  await answer(slow);
  assert.equal((await watching).text, `Rang thread ${slow.thread}: timed-out.`);
  process.env.AGENTPAGER_CODEX = codex.ok;
  assert.equal((await op.watch(id, slow.d)).text, 'Nothing to watch: it has rung, this machine has the answer, or another watcher runs.');
  assert.equal(ringsFor(slow.thread).length, 1, 'one call, the one that timed out');

  // A watcher stopped during its call leaves the ring recorded as ringing: no later watcher, nor wait, rings again.
  const cut = await asked('Cut off?', v7());
  store.updateAgent(id, x => { const w = x.decisions[cut.d].wake; if (w?.app === 'codex') w.ring = { at: new Date().toISOString(), outcome: 'ringing' }; });
  assert.equal((await op.watch(id, cut.d)).text, 'Nothing to watch: it has rung, this machine has the answer, or another watcher runs.');
  rollout(cut.thread, terminal); inShell({ CODEX_THREAD_ID: cut.thread });
  assert.ok((await op.wait(id, cut.d, { seconds: 1 })).text.endsWith(`Keep waiting: agentpager wait --agent ${id} ${cut.d}`), 'a wait from that thread starts no watcher, and isn\'t told a note will come');
  inShell({});
  assert.equal(watcherOf(id, cut.d), undefined);

  // Codex doesn't know the thread: recorded, and not tried again.
  const gone = await asked('Thread gone?', v7());
  process.env.AGENTPAGER_CODEX = codex.gone;
  const goneWatch = op.watch(id, gone.d);
  await until(async () => watcherOf(id, gone.d), pid => pid === process.pid);
  await answer(gone);
  assert.equal((await goneWatch).text, `Rang thread ${gone.thread}: unknown-thread.`);
  process.env.AGENTPAGER_CODEX = codex.ok;

  // A call that fails on its own queued nothing: it is made again, 30 s apart (here 50 ms), up to three more times.
  const flaky = await asked('Flaky Codex?', v7());
  process.env.AGENTPAGER_CODEX = codex.flaky;
  const flakyWatch = op.watch(id, flaky.d, { ringAgainMs: 50 });
  await until(async () => watcherOf(id, flaky.d), pid => pid === process.pid);
  await answer(flaky);
  assert.equal((await flakyWatch).text, `Rang thread ${flaky.thread}: queued.`);
  assert.deepEqual(ringsFor(flaky.thread).map(c => c.args), Array(3).fill(['queue', `--thread=${flaky.thread}`, `--message=AgentPager: your owner answered decision ${flaky.d}. Run agentpager wait --agent ${id} ${flaky.d} to read the answer, then acknowledge it.`]), 'failed twice, then queued once');
  const broken = await asked('Broken Codex?', v7());
  process.env.AGENTPAGER_CODEX = codex.broken;
  const brokenWatch = op.watch(id, broken.d, { ringAgainMs: 50 });
  await until(async () => watcherOf(id, broken.d), pid => pid === process.pid);
  await answer(broken);
  assert.equal((await brokenWatch).text, `Rang thread ${broken.thread}: failed.`);
  assert.equal(ringsFor(broken.thread).length, 4, 'one call and three more, then no more');
  assert.equal((await op.watch(id, broken.d)).text, 'Nothing to watch: it has rung, this machine has the answer, or another watcher runs.');
  assert.equal(ringsFor(broken.thread).length, 4);
  process.env.AGENTPAGER_CODEX = codex.ok;

  // Two watchers started for one decision, as two processes: one watches, the other ends at once; one ring.
  const twice = await asked('Two watchers?', v7());
  const start = () => spawn(process.execPath, ['--experimental-strip-types', main, 'watch', '--agent', id, twice.d], { stdio: ['ignore', 'pipe', 'ignore'], env: process.env });
  const first = start(), second = start();
  for (const c of [first, second]) if (c.pid) started.add(c.pid);
  const outs = [first, second].map(c => new Promise<string>(res => { let out = ''; c.stdout?.on('data', b => { out += b; }); c.on('close', () => res(out)); }));
  const one = await Promise.race(outs);
  assert.equal(one.trim(), 'Nothing to watch: it has rung, this machine has the answer, or another watcher runs.', 'the second ends at once');
  await answer(twice);
  const both = await Promise.all(outs);
  assert.deepEqual(both.map(o => o.trim()).sort(), [`Nothing to watch: it has rung, this machine has the answer, or another watcher runs.`, `Rang thread ${twice.thread}: queued.`].sort());
  assert.equal(ringsFor(twice.thread).length, 1, 'rung once');

  // The pager turned off while a watcher waits: it keeps looking, and once the pager is on again and the owner answers,
  // it rings.
  const offOn = await asked('Off, then on?', v7());
  const offWatch = op.watch(id, offOn.d, { offRetryMs: 100 });
  await until(async () => watcherOf(id, offOn.d), pid => pid === process.pid);
  await f.settings(p.pagerId, p.phone, { on: false });
  await pause(600);
  assert.equal(watcherOf(id, offOn.d), process.pid, 'still watching while off');
  await f.settings(p.pagerId, p.phone, { on: true });
  await answer(offOn);
  assert.equal((await offWatch).text, `Rang thread ${offOn.thread}: queued.`);
  assert.equal(ringsFor(offOn.thread).length, 1);

  // A lock on the agent's file left by a process that died, when the answer comes: the watcher waits it out and rings.
  const held = await asked('Lock left behind?', v7());
  const heldWatch = op.watch(id, held.d);
  await until(async () => watcherOf(id, held.d), pid => pid === process.pid);
  const left = path.join(home, 'agents', `${id}.lock`);
  mkdirSync(left);
  await answer(held);
  assert.equal((await heldWatch).text, `Rang thread ${held.thread}: queued.`, 'held past one try\'s 5 s, then broken as stale at 10 s');
  assert.equal(ringsFor(held.thread).length, 1);

  // A claim that can't be written (here the record's folder is read-only) isn't one: nothing is rung.
  const unsaved = await asked('Claim not saved?', v7());
  const unsavedWatch = op.watch(id, unsaved.d);
  await until(async () => watcherOf(id, unsaved.d), pid => pid === process.pid);
  chmodSync(path.join(home, 'waiting'), 0o500);
  try {
    await answer(unsaved);
    assert.equal((await unsavedWatch).text, 'Not rung: this machine has the answer, or it rang already.');
  } finally { chmodSync(path.join(home, 'waiting'), 0o700); }
  assert.equal(ringsFor(unsaved.thread).length, 0);

  // A watcher that can't start in time (here the agent's file is held busy) is stopped: the agent is told to wait itself,
  // and nothing is left to ring it as well.
  const late = await asked('Started late?', v7());
  rollout(late.thread, terminal);
  const lock = path.join(home, 'agents', `${id}.lock`);
  mkdirSync(lock);
  inShell({ CODEX_THREAD_ID: late.thread });
  const lateWait = await op.wait(id, late.d, { seconds: 1 });
  rmdirSync(lock);
  inShell({});
  assert.ok(lateWait.text.endsWith(`Keep waiting: agentpager wait --agent ${id} ${late.d}`), lateWait.text);
  assert.equal(watcherOf(id, late.d), undefined, 'it never took the decision');
  assert.equal(execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' }).split('\n').filter(l => l.endsWith(` watch --agent ${id} ${late.d}`)).length, 0, 'and it is gone');

  // The agent read the answer itself before the watcher saw it: nothing to ring.
  const read = await asked('Read already?', v7());
  await answer(read);
  assert.match((await op.wait(id, read.d)).text, /^Answered at /);
  assert.equal((await op.watch(id, read.d)).text, 'Nothing to watch: it has rung, this machine has the answer, or another watcher runs.');
  assert.equal(ringsFor(read.thread).length, 0);
});

test('B33.4 B25.13 B32.11 A watcher stops, ringing no one and leaving nothing running, when its decision closes as the agent finishes, when the pager is deleted, and when the server stays away; a wait from the thread starts it again after a restart', { timeout: 180_000 }, async () => {
  const thread = v7();
  rollout(thread, terminal);
  // An agent in Codex's shell, its thread the terminal's: each ask starts a watcher.
  const fromCodex = async (title: string) => {
    inShell({ CODEX_THREAD_ID: thread }); process.env.AGENTPAGER_CODEX = codex.ok;
    const p = await f.makePager(), id = field(await op.connect({ number: p.number, project: 'wake' }), 'agent');
    const asked = await op.ask(id, card(title)), d = field(asked, 'decision');
    assert.ok(asked.text.endsWith(`\nDecision ${d}. ${codexShell(id, d)}`), asked.text);
    return { p, id, d, pid: await watcherStarts(id, d) };
  };
  const stops = async (pid: number) => { await until(async () => alive(pid), up => !up); };

  const finished = await fromCodex('Finished first?');
  assert.ok((await op.finish(finished.id)).text.startsWith('Finished.'));
  await stops(finished.pid);
  assert.deepEqual(record(finished.id), { version: 1, agent: finished.id, decisions: [] }, 'the decision closed unanswered, and leaves the record');

  // A watcher gone without a word (the machine restarted, say): a wait from the same thread starts another.
  const off = await fromCodex('Restarted?');
  process.kill(off.pid, 'SIGKILL');
  await stops(off.pid);
  inShell({ CODEX_THREAD_ID: thread });
  assert.ok((await op.wait(off.id, off.d, { seconds: 1 })).text.endsWith(`Carry on or end your turn, and when the note comes, run agentpager wait --agent ${off.id} ${off.d} to read it.`));
  const again = await watcherStarts(off.id, off.d);
  assert.notEqual(again, off.pid);
  await f.request(`/api/pagers/${off.p.pagerId}/delete`, { method: 'POST', phone: off.p.phone });
  await stops(again);

  // The server gone for longer than a watcher keeps trying: here, a few tries, then it stops.
  inShell({}); process.env.AGENTPAGER_CODEX = codex.ok;
  const p = await f.makePager(), id = field(await op.connect({ number: p.number, app: 'Codex', project: 'wake' }), 'agent');
  const d = field(await op.ask(id, card('Server gone?')), 'decision');
  store.updateAgent(id, x => { x.decisions[d].wake = { app: 'codex', thread: v7(), via: 'shell' }; });
  store.updateAgent(id, x => { x.server = 'http://127.0.0.1:9'; });
  assert.equal((await op.watch(id, d, { retryMs: 50, forMs: 400 })).text, 'Stopped: watched for as long as a watcher may.');
  assert.equal(watcherOf(id, d), undefined);
  for (const x of [finished, off]) assert.equal(ringsFor(thread).length, 0, `${x.id} rang no one`);
});

test('B33.4 B33.1 A codex exec run, a Codex thread with no Codex CLI that can ring it, or a thread asked from elsewhere gets no watcher and today\'s words, and at connect is told it may need a nudge', { timeout: 120_000 }, async () => {
  const p = await f.makePager();
  const execThread = v7();
  rollout(execThread, exec);
  inShell({ CODEX_THREAD_ID: execThread }); process.env.AGENTPAGER_CODEX = codex.ok;
  const c = await op.connect({ number: p.number, project: 'wake' });
  assert.ok(c.text.endsWith(`\n${NUDGE}\nBefore your first card: agentpager rules`), c.text);
  const id = field(c, 'agent'), d = field(await op.ask(id, card('From codex exec?')), 'decision');
  assert.equal(store.loadAgent(id)?.decisions[d]?.wake, undefined, 'no wake recorded');
  const over = await op.ask(id, card('Over MCP, from codex exec?'), { client: 'codex-mcp-client', meta: meta(v7(), { trigger: 'exec' }) });
  assert.ok(over.text.endsWith(`\nDecision ${field(over, 'decision')}. ${everyone(id, field(over, 'decision'))}`), over.text);

  // A thread a note could wake, but the only Codex CLI here is too old to queue.
  const thread = v7();
  rollout(thread, terminal);
  inShell({ CODEX_THREAD_ID: thread }); process.env.AGENTPAGER_CODEX = codex.old;
  const old = await op.connect({ number: p.number, project: 'wake' });
  assert.ok(old.text.includes(NUDGE));
  const oid = field(old, 'agent'), asked = await op.ask(oid, card('With an old Codex?')), od = field(asked, 'decision');
  assert.ok(asked.text.endsWith(everyone(oid, od)), asked.text);
  assert.equal(store.loadAgent(oid)?.decisions[od]?.wake, undefined);

  // A decision a Codex thread asked, waited for from another thread: that wait gets today's words, and starts nothing.
  process.env.AGENTPAGER_CODEX = codex.ok;
  const ok = await op.connect({ number: p.number, project: 'wake' });
  assert.ok(!ok.text.includes(NUDGE));
  const kid = field(ok, 'agent'), kd = field(await op.ask(kid, card('Asked from one thread?')), 'decision');
  const pid = await watcherStarts(kid, kd);
  const other = v7(); rollout(other, terminal); inShell({ CODEX_THREAD_ID: other });
  assert.ok((await op.wait(kid, kd, { seconds: 1 })).text.endsWith(`Keep waiting: agentpager wait --agent ${kid} ${kd}`));
  assert.equal(watcherOf(kid, kd), pid);
  assert.ok((await op.finish(kid)).text.startsWith('Finished.'));
  await until(async () => alive(pid), up => !up);
  inShell({}); process.env.AGENTPAGER_CODEX = codex.ok;
});

test('B33.1 B25.6 An agent whose AgentPager adapter wakes it is told not to wait, and the record of what\'s waiting names its session; it holds ids and states only, private to the machine\'s user', { timeout: 120_000 }, async () => {
  const p = await f.makePager();
  inShell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:sess-1' });
  const c = await op.connect({ number: p.number, project: 'wake' });
  assert.ok(!c.text.includes(NUDGE), 'Claude Code is named');
  const id = field(c, 'agent');
  const adapted = await op.ask(id, card('With the plugin?')), d1 = field(adapted, 'decision');
  assert.ok(adapted.text.endsWith(`\nDecision ${d1}. Don't wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.`), adapted.text);
  assert.equal((await op.wait(id, d1, { seconds: 1 })).text, 'Pending. Your owner hasn\'t answered "With the plugin?" yet.\nDon\'t wait for it: the answer comes to you as a new message when your owner answers. Carry on or end your turn.');
  // Another session, or Claude Code without the plugin, waits in the background as before.
  process.env.AGENTPAGER_WAKE = 'claude-code:sess-2';
  assert.match((await op.wait(id, d1, { seconds: 1 })).text, /\nKeep waiting in the background: run `.+ wait --agent ap-[a-z0-9]{4} d_[a-z0-9]{4} --forever` as a background command/);
  process.env.AGENTPAGER_WAKE = 'claude-code:sess-1';
  // A decision the record can't hold (here its folder is read-only) is never sent, so nothing can be left for the plugin
  // to miss: the agent's file and the record are written together or not at all.
  chmodSync(path.join(home, 'waiting'), 0o500);
  let unsaved: Awaited<ReturnType<typeof op.ask>>;
  try { unsaved = await op.ask(id, card('Not saved?')); } finally { chmodSync(path.join(home, 'waiting'), 0o700); }
  assert.deepEqual([unsaved.code, unsaved.text], [2, `Can't write ${home} (EACCES). Nothing was sent. Set AGENTPAGER_HOME to a folder this agent can write, and try again.`]);
  assert.equal(await decisionId(p, 'Not saved?'), undefined, 'the owner never got it');
  delete process.env.AGENTPAGER_WAKE;
  const plain = await op.ask(id, card('Without the plugin?')), d2 = field(plain, 'decision');
  assert.match(plain.text, new RegExp(`\\nDecision ${d2}\\. Wait for the answer in the background: run \``));
  // pi, with its extension.
  inShell({ AGENTPAGER_WAKE: 'pi:p-1' });
  const pi = await op.connect({ number: p.number, app: 'pi', project: 'wake' });
  assert.ok(!pi.text.includes(NUDGE));
  const pid = field(pi, 'agent'), fromPi = await op.ask(pid, card('From pi?')), d3 = field(fromPi, 'decision');
  assert.ok(fromPi.text.endsWith(`\nDecision ${d3}. Don't wait for it: when your owner answers, the answer comes to you as a new message. Carry on or end your turn.`), fromPi.text);

  // The record: each decision with its ids and where it stands, and who wakes the agent for it.
  const askedAt = (a: string, d: string) => store.loadAgent(a)?.decisions[d]?.askedAt;
  assert.deepEqual(record(id), { version: 1, agent: id, decisions: [
    { decision: d1, askedAt: askedAt(id, d1), state: 'waiting', wake: { app: 'claude-code', session: 'sess-1' } },
    { decision: d2, askedAt: askedAt(id, d2), state: 'waiting' },
  ] });
  assert.deepEqual(record(pid), { version: 1, agent: pid, decisions: [{ decision: d3, askedAt: askedAt(pid, d3), state: 'waiting', wake: { app: 'pi', session: 'p-1' } }] });
  const seen = await decisionId(p, 'With the plugin?');
  await f.answer(seen?.agentId ?? '', p.phone, seen?.decisionId ?? '', { kind: 'feedback', text: 'Ship the secret plan' });
  inShell({ CLAUDECODE: '1', AGENTPAGER_WAKE: 'claude-code:sess-1' });
  assert.match((await op.wait(id, d1)).text, /Ship the secret plan/);
  assert.deepEqual(states(id), ['answered', 'waiting']);
  const file = store.waitingPath(id), text = readFileSync(file, 'utf8'), agent = readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8');
  assert.equal(statSync(file).mode & 0o777, 0o600, 'only the machine\'s user reads it');
  assert.equal(statSync(path.join(home, 'agents', `${id}.json`)).mode & 0o777, 0o600, 'nor the agent\'s own file, which keeps its keys');
  assert.equal(statSync(path.dirname(file)).mode & 0o777, 0o700);
  const a = store.loadAgent(id);
  for (const secret of [a?.agentKey, a?.privateKey, a?.pagerKey, a?.agentId, p.number, 'Ship the secret plan', 'With the plugin?']) {
    assert.ok(secret && agent.includes(secret) === (secret !== p.number && secret !== 'Ship the secret plan'), 'the agent\'s file holds its keys and its cards\' titles');
    assert.ok(!text.includes(secret), 'never in the record');
  }
  assert.deepEqual(readdirSync(path.dirname(file)).filter(n => !n.endsWith('.json')), [], 'nothing else in its folder');
  inShell({});
});
