import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
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
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_THREAD_ID', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'AGENTPAGER_PAGER']) delete process.env[v];
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

// The two steps an adapter takes instead of one wait (store.ts › Waiting): a wait that picks nothing up, and pickup once
// the agent has the answer. Run from source as the adapters run the command, for its flags and its JSON.
test('B32.12 An adapter\'s wait with --no-pickup hands over the answer but picks nothing up, so the owner is still warned, and pickup picks it up once the agent has it, saying in its JSON what happened; the record counts only the agent\'s own reads', { timeout: 240_000 }, async () => {
  const f = await fixture('cli-pickup-adapter', { autoOffMs: 0, idleMs: 0, pickupMs: PICKUP_MS });
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-pickup-adapter-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin;
  const op = await import('../src/commands.ts'), store = await import('../src/store.ts');
  const main = fileURLToPath(new URL('../src/main.ts', import.meta.url));
  const command = async (...args: string[]) => {
    const r = await run([process.execPath, '--experimental-strip-types', main, ...args, '--json'], { AGENTPAGER_HOME: home, AGENTPAGER_SERVER: f.origin }).done;
    const reply = JSON.parse(r.out);
    return { exit: r.code, code: reply.code, text: String(reply.text), status: typeof reply.result === 'object' && reply.result !== null ? Reflect.get(reply.result, 'status') : undefined };
  };
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'pi', project: 'adapter' }), 'agent');
    const [held, acked, closed] = [field(await op.ask(id, card('Held, then picked up?')), 'decision'), field(await op.ask(id, card('Acknowledged first?')), 'decision'), field(await op.ask(id, card('Closed first?')), 'decision')];
    const read = async (title: string) => { const x = (await f.pager(p.pagerId, p.phone)).agents[0]; return [...(x?.open ?? []), ...(x?.answered ?? [])].find(y => y.title === title); };
    const agentId = (await f.pager(p.pagerId, p.phone)).agents[0]?.agent.agentId ?? '';
    const listed = (d: string) => JSON.parse(readFileSync(path.join(home, 'waiting', `${id}.json`), 'utf8')).decisions.find((x: { decision: string }) => x.decision === d);
    const state = (d: string) => listed(d)?.state;
    const historyHas = (d: string) => readFileSync(path.join(home, 'history', `${p.pagerId}.jsonl`), 'utf8').split('\n').filter(Boolean).some(l => { const e = JSON.parse(l); return e.event === 'answered' && e.decision === d; });

    // Before the answer: a held wait without --forever replies pending, and there is nothing to pick up.
    assert.deepEqual(await command('wait', '--agent', id, '--no-pickup', held, '--seconds', '1'), { exit: 0, code: 0, text: `Pending. Your owner hasn't answered "Held, then picked up?" yet.\nKeep waiting: agentpager wait --agent ${id} ${held}`, status: 'pending' });
    assert.deepEqual(await command('pickup', '--agent', id, held), { exit: 2, code: 2, text: 'Nothing to pick up: your owner hasn\'t answered "Held, then picked up?" yet.', status: 'pending' });

    // Answered: the held wait has it, word for word as any wait, and picks nothing up, here or on the service.
    const sent = await f.answer(agentId, p.phone, (await read('Held, then picked up?'))?.decisionId ?? '', { kind: 'option', number: 2 });
    const got = await command('wait', '--agent', id, held, '--no-pickup');
    assert.deepEqual([got.exit, got.status], [0, 'answered']);
    assert.match(got.text, new RegExp(`^Answered at .*: option B "Later"\\.\\nDo it, then confirm: agentpager ack --agent ${id} ${held} "<what happens next>"$`));
    assert.equal(state(held), 'waiting', 'still waiting here');
    assert.equal(historyHas(held), false, 'and not in the history');
    const warned = await until(() => read('Held, then picked up?'), d => d?.warnedAt !== undefined, 30_000);
    assert.equal(warned?.collectedAt, undefined, 'never picked up, so the owner is warned');
    assert.ok(warned?.warnedAt && Date.parse(warned.warnedAt) - Date.parse(sent.sentAt) >= PICKUP_MS);

    // Once the agent has it, pickup: the service and this machine count it as received; saying it again is the same.
    assert.deepEqual(await command('pickup', '--agent', id, held), { exit: 0, code: 0, text: `Picked up: the service knows your agent has the answer to ${held}.`, status: 'picked-up' });
    const picked = await read('Held, then picked up?');
    assert.ok(picked?.collectedAt && Date.parse(picked.collectedAt) >= Date.parse(warned?.warnedAt ?? ''));
    assert.equal(state(held), 'answered');
    assert.equal(historyHas(held), true);
    assert.equal((await command('pickup', '--agent', id, held)).status, 'picked-up');
    assert.equal((await read('Held, then picked up?'))?.collectedAt, picked?.collectedAt, 'when it was first picked up');
    // The record counts only the agent's own reads: neither step of an adapter is one, and each wait of the agent's is.
    assert.equal(listed(held).reads, undefined, 'an adapter\'s wait and pickup aren\'t the agent\'s reads');
    assert.equal((await command('wait', '--agent', id, held, '--no-pickup')).status, 'answered');
    assert.equal(listed(held).reads, undefined);
    assert.equal((await command('wait', '--agent', id, held)).status, 'answered');
    assert.deepEqual([listed(held).state, listed(held).reads], ['answered', 1]);
    assert.equal((await op.wait(id, held)).code, 0);
    assert.equal(listed(held).reads, 2);

    // Acknowledged first: the acknowledgement picked it up.
    await f.answer(agentId, p.phone, (await read('Acknowledged first?'))?.decisionId ?? '', { kind: 'option', number: 1 });
    assert.equal((await command('wait', '--agent', id, acked, '--no-pickup')).status, 'answered');
    assert.equal((await op.ack(id, acked, 'Going now.')).code, 0);
    assert.deepEqual(await command('pickup', '--agent', id, acked), { exit: 0, code: 0, text: `Already acknowledged: ${acked} was picked up when you acknowledged it.`, status: 'acknowledged' });

    // Closed unanswered, as the agent finishes: nothing to pick up, and the held wait says so too.
    assert.equal((await op.finish(id)).code, 0);
    assert.deepEqual([(await command('pickup', '--agent', id, closed)).exit, (await command('pickup', '--agent', id, closed)).status], [2, 'closed']);
    assert.deepEqual([(await command('wait', '--agent', id, closed, '--no-pickup', '--forever')).exit, (await command('wait', '--agent', id, closed, '--no-pickup')).status], [2, 'closed']);

    // The service failing (here a stand-in replies 503 to everything), and then away: try again, from both steps.
    const failing = createServer((_q, res) => { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'Unavailable', message: 'Down for a moment.' })); });
    await new Promise<void>(res => failing.listen(0, '127.0.0.1', res));
    const address = failing.address(), real = store.loadAgent(id)?.server ?? '';
    store.updateAgent(id, x => { x.server = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`; });
    try {
      for (const step of [['pickup', '--agent', id, held], ['wait', '--agent', id, held, '--no-pickup']]) {
        const r = await command(...step);
        assert.deepEqual([r.exit, r.status], [5, 'try-again'], `${step[0]} with the server failing`);
      }
    } finally { store.updateAgent(id, x => { x.server = real; }); await new Promise(res => failing.close(res)); }
    await f.stop();
    const away = await command('pickup', '--agent', id, held);
    assert.deepEqual([away.exit, away.status], [5, 'try-again']);
    assert.equal((await command('pickup', '--agent', 'ap-zzzz', held)).exit, 6);
  } finally { await f.stop(); }
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
    // An adapter's two steps there: the old service picked it up when the held wait read it, and pickup says so.
    const adapted = field(await op.ask(id, card('An adapter on the old service?')), 'decision');
    const open = (await f.pager(p.pagerId, p.phone)).agents[0]?.open[0];
    await f.answer(inbox.agents[0]?.agent.agentId ?? '', p.phone, open?.decisionId ?? '', { kind: 'option', number: 2 });
    assert.match((await op.wait(id, adapted, { noPickup: true })).text, /^Answered at .*: option B "Later"\./);
    assert.equal(field(await op.pickup(id, adapted), 'status'), 'picked-up');
  } finally { await f.stop(); }
});
