import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fixture, assert, pause, release, until } from '../../app/test/support.ts';

// When an answer counts as picked up (B32.12, blueprint/areas/2-agents.md), end to end: the real local service, this
// command (from source and compiled) and the m6.1 release's. This command says it received an answer once it has read
// and opened it, from the command line and as the MCP server's wait tool; a wait killed before then picks nothing up,
// so the owner is warned (B5.13). The m6.1 command, which Sam's machines run until they update, says nothing of the
// kind and still picks an answer up by reading it. Local pickup time 3 s; the words say 3 min.

const PICKUP_MS = 3_000;
const bin = fileURLToPath(new URL('../dist/agentpager', import.meta.url));
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);
const card = (title: string) => ({ object: { title, detail: 'A test.', context: { summary: 'Ready.' }, options: [{ label: 'Now', title: 'Now', prioritizes: 'speed' }, { label: 'Later', title: 'Later', prioritizes: 'rest' }], recommendation: { option: 'A', why: 'Ready.' } } });
const yaml = (title: string) => `title: ${title}\ndetail: A test.\ncontext:\n  summary: Ready.\noptions:\n  - {label: Now, title: Now, prioritizes: speed}\n  - {label: Later, title: Later, prioritizes: rest}\nrecommendation: {option: A, why: Ready.}\n`;
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'AGENTPAGER_PAGER']) delete process.env[v];
// A command run to its end, or killed at its time limit, or by `kill`: its exit code, everything it printed.
function run(argv: string[], env: Record<string, string>, limitMs = 90_000) {
  const [command = '', ...args] = argv;
  const child = spawn(command, args, { env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', ended = false;
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { out += chunk; });
  const done = new Promise<{ code: number | null; signal: NodeJS.Signals | null; out: string }>(resolve => {
    const limit = setTimeout(() => child.kill('SIGKILL'), limitMs);
    child.on('close', (code, signal) => { clearTimeout(limit); ended = true; resolve({ code, signal, out }); });
  });
  return { done, ended: () => ended, kill: () => child.kill('SIGKILL') };
}

test('B32.12 The command says it received an answer once it has opened it, from the command line and as the MCP wait tool; a wait with no end killed before then picks nothing up, so the owner is warned', { timeout: 240_000, skip: !existsSync(bin) && 'build it first: pnpm --filter @agentpager/cli build' }, async () => {
  const f = await fixture('cli-pickup', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS });
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-pickup-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin;
  const op = await import('../src/commands.ts');
  const client = new Client({ name: 'codex-mcp-client', version: '1' });
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'pickup' }), 'agent');
    const short = async (title: string) => field(await op.ask(id, card(title)), 'decision');
    const [line, tool, killed] = [await short('From the command line?'), await short('From the MCP wait tool?'), await short('Killed mid-wait?')];
    const read = async () => (await f.pager(p.pagerId, p.phone)).agents[0];
    const agentId = (await read())?.agent.agentId ?? '';
    const decision = async (title: string) => {
      const x = await read(), d = [...(x?.open ?? []), ...(x?.answered ?? [])].find(y => y.title === title);
      assert.ok(d, `the phone reads "${title}"`);
      return d;
    };
    const idOf = async (title: string) => (await decision(title)).decisionId;

    // The command line: the wait opens the answer, says it received it, and only then hands it to the agent.
    const sent1 = await f.answer(agentId, p.phone, await idOf('From the command line?'), { kind: 'option', number: 2 });
    assert.match((await op.wait(id, line)).text, /^Answered at .*: option B "Later"\./);
    const d1 = await decision('From the command line?');
    assert.ok(d1.collectedAt && Date.parse(d1.collectedAt) >= Date.parse(sent1.sentAt), 'picked up once the command had it');

    // The MCP server's wait tool, from the compiled command, as an agent app runs it.
    await client.connect(new StdioClientTransport({ command: bin, args: ['mcp'], env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', AGENTPAGER_HOME: home }, stderr: 'ignore' }));
    await f.answer(agentId, p.phone, await idOf('From the MCP wait tool?'), { kind: 'feedback', text: 'Through the tool.' });
    const got = await client.callTool({ name: 'wait', arguments: { agent: id, decision: tool } });
    assert.match(JSON.stringify(got.content), /Through the tool\./);
    assert.ok((await decision('From the MCP wait tool?')).collectedAt, 'the wait tool says it received the answer');

    // A wait with no end, from the compiled command, killed mid-wait, then answered during the rest of its hold.
    const waiting = run([bin, 'wait', '--agent', id, killed, '--forever'], { AGENTPAGER_HOME: home });
    await pause(2_000);
    assert.equal(waiting.ended(), false, 'the wait with no end holds');
    waiting.kill();
    assert.equal((await waiting.done).signal, 'SIGKILL');
    await pause(1_000);
    const sent3 = await f.answer(agentId, p.phone, await idOf('Killed mid-wait?'));
    const warned = await until(() => decision('Killed mid-wait?'), d => d.warnedAt !== undefined, 30_000);
    assert.equal(warned.collectedAt, undefined, 'nothing picked it up');
    assert.ok(warned.warnedAt && Date.parse(warned.warnedAt) - Date.parse(sent3.sentAt) >= PICKUP_MS, 'warned, not before the pickup time');
    // The agent's next wait has it, and says so: the decision goes back to waiting for the agent.
    assert.match((await op.wait(id, killed)).text, /^Answered at .*: option B "Later"\./);
    const back = await decision('Killed mid-wait?');
    assert.ok(back.collectedAt && back.warnedAt && Date.parse(back.collectedAt) >= Date.parse(back.warnedAt), 'picked up after the warning');
    // Waiting again, and acknowledging, change nothing of when it was picked up.
    await op.wait(id, killed);
    assert.equal((await op.ack(id, killed, 'Carrying on.')).code, 0);
    assert.equal((await decision('Killed mid-wait?')).collectedAt, back.collectedAt);

    for (const title of ['From the command line?', 'From the MCP wait tool?']) assert.equal((await decision(title)).warnedAt, undefined, `"${title}" was never warned about`);
  } finally { await client.close().catch(() => {}); await f.stop(); }
});

// The m6.1 command, built from its tag, as Sam's machines run it until they update, and the m6.1 contract, which its
// command and app read with.
test('B32.12 The m6.1 command on this service still picks an answer up when its wait reads it, so its owner is never warned; the pager reads with the m6.1 contract as before', { timeout: 600_000 }, async () => {
  const old = release('m6.1');
  const f = await fixture('cli-pickup-m6.1', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS });
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-pickup-m6.1-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-pickup-m6.1-card-'));
  const command = async (...args: string[]) => { const r = await run([old.binary, ...args], { AGENTPAGER_HOME: home }).done; return { code: r.code, out: r.out }; };
  try {
    const p = await f.makePager();
    const connected = await command('connect', p.number, '--app', 'Codex', '--project', 'm6.1', '--server', f.origin, '--json');
    assert.equal(connected.code, 0, connected.out);
    const id = String(JSON.parse(connected.out).result.agent);
    writeFileSync(path.join(work, 'card.yaml'), yaml('Read by m6.1?'));
    const asked = await command('ask', '--agent', id, path.join(work, 'card.yaml'), '--json');
    assert.equal(asked.code, 0, asked.out);
    const short = String(JSON.parse(asked.out).result.decision);
    const inbox = await f.pager(p.pagerId, p.phone), d = inbox.agents[0]?.open[0];
    assert.ok(d);
    const sent = await f.answer(inbox.agents[0]?.agent.agentId ?? '', p.phone, d.decisionId, { kind: 'option', number: 1 });
    const waited = await command('wait', '--agent', id, short);
    assert.equal(waited.code, 0, waited.out);
    assert.match(waited.out, /^Answered at .*: option A "Now"\./);
    const picked = (await f.pager(p.pagerId, p.phone)).agents[0]?.answered[0];
    assert.ok(picked?.collectedAt && Date.parse(picked.collectedAt) >= Date.parse(sent.sentAt), 'picked up when m6.1\'s wait read it');
    await pause(PICKUP_MS + 2_000);
    assert.equal((await f.pager(p.pagerId, p.phone)).agents[0]?.answered[0]?.warnedAt, undefined, 'never warned');
    assert.equal((await command('ack', '--agent', id, short, 'Carrying on.')).code, 0);

    // What this service sends the phone, read with the m6.1 contract's own schemas, as its app's mirror reads it.
    const reader = path.join(old.app, '..', 'contract', 'm6.1-reader.ts');
    writeFileSync(reader, 'export { Schema } from "effect";\nexport * from "./exchange.ts";\n');
    const m61 = await import(pathToFileURL(reader).href), { Schema } = m61;
    const wire = await f.request(`/api/pagers/${p.pagerId}`, { phone: p.phone });
    const before = Schema.decodeUnknownSync(m61.PagerInbox)(wire.value);
    assert.deepEqual([before.agents[0].answered[0].status, typeof before.agents[0].answered[0].collectedAt], ['acknowledged', 'string']);
    const agentFile = JSON.parse(readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8'));
    const status = await f.request(`/api/agents/${agentFile.agentId}`, { agent: agentFile.agentKey });
    Schema.decodeUnknownSync(m61.AgentStatus)(status.value);
  } finally { await f.stop(); }
});

// This command on a service from before it, as on prod until the service deploys first: the route to say it received
// the answer is no route there, which changes nothing, and that service picked the answer up when it was read.
test('B32.12 This command on the m6.1 service: its wait hands the agent the answer, and the service, which has no word for received, picked it up when it was read', { timeout: 600_000 }, async () => {
  const old = release('m6.1');
  const f = await fixture('cli-pickup-on-m6.1', { autoOffMs: 0, idleMs: 0 }, { app: old });
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-pickup-on-m6.1-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin;
  const op = await import('../src/commands.ts');
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'old service' }), 'agent');
    const short = field(await op.ask(id, card('On the old service?')), 'decision');
    const inbox = await f.pager(p.pagerId, p.phone), d = inbox.agents[0]?.open[0];
    assert.ok(d);
    await f.answer(inbox.agents[0]?.agent.agentId ?? '', p.phone, d.decisionId, { kind: 'option', number: 1 });
    const waited = await op.wait(id, short);
    assert.equal(waited.code, 0, waited.text);
    assert.match(waited.text, /^Answered at .*: option A "Now"\./);
    assert.ok((await f.pager(p.pagerId, p.phone)).agents[0]?.answered[0]?.collectedAt, 'the old service picked it up when it was read');
    assert.equal((await op.ack(id, short, 'Carrying on.')).code, 0);
  } finally { await f.stop(); }
});
