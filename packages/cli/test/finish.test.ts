import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixture, assert, pause, release } from '../../app/test/support.ts';
import { Schema as Now } from 'effect';
import { AgentStatus, DECISION_CLOSED_MESSAGE, Finished, PagerInbox } from '../../contract/exchange.ts';

// Finishing closes an agent's open decisions (B25.13 and B32.11, blueprint/areas/2-agents.md), end to end: the real
// local service, and both this command and the m5 release's, whose words for it closed.test.ts checks against
// replies of its own. A wait with no end, held as its agent finishes, stops with the agent told why.

const cli = fileURLToPath(new URL('..', import.meta.url)), main = path.join(cli, 'src', 'main.ts');
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);
const card = (title: string) => `title: ${title}\ndetail: Before the release.\ncontext:\n  summary: Both are ready.\noptions:\n  - {label: Now, title: Now, prioritizes: speed}\n  - {label: Later, title: Later, prioritizes: safety}\nrecommendation: {option: A, why: Ready.}\n`;
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT', 'AGENTPAGER_PAGER']) delete process.env[v];

// A command run to its end, or killed at its time limit: its exit code, everything it printed, and when it ended.
function run(argv: string[], env: Record<string, string>, limitMs = 90_000): { done: Promise<{ code: number | null; out: string; at: number }>; ended: () => boolean } {
  let ended = false;
  const done = new Promise<{ code: number | null; out: string; at: number }>(resolve => {
    const [command = '', ...args] = argv;
    const child = spawn(command, args, { env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { out += chunk; });
    const limit = setTimeout(() => child.kill('SIGKILL'), limitMs);
    child.on('close', code => { clearTimeout(limit); ended = true; resolve({ code, out, at: Date.now() }); });
  });
  return { done, ended: () => ended };
}

test('B32.11 B25.13 A wait with no end stops as its agent finishes, telling it the decision closed unanswered; the answer sent before stays, to collect and acknowledge', { timeout: 240_000 }, async () => {
  const f = await fixture('cli-finish');
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-finish-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-finish-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin;
  const op = await import('../src/commands.ts');
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'finishing' }), 'agent');
    const open = field(await op.ask(id, { yaml: card('Ship tonight?'), dir: work }), 'decision'), sent = field(await op.ask(id, { yaml: card('Keep the cache?'), dir: work }), 'decision');
    const asked = (await f.pager(p.pagerId, p.phone)).agents[0], idOf = (title: string) => asked?.open.find(d => d.title === title)?.decisionId ?? '';
    await f.answer(asked?.agent.agentId ?? '', p.phone, idOf('Keep the cache?'), { kind: 'option', number: 2 });

    const waiting = run([process.execPath, '--experimental-strip-types', main, 'wait', '--agent', id, open, '--forever'], { AGENTPAGER_HOME: home, AGENTPAGER_SERVER: f.origin });
    await pause(2_000);
    assert.equal(waiting.ended(), false, 'the wait with no end holds');
    const at = Date.now(), finished = await op.finish(id);
    const head = `Finished. Your owner's phone shows ${id} as finished; it asks nothing more. Its decisions stay on the phone.`;
    assert.deepEqual([finished.code, finished.text], [0, `${head}\nFinishing closed its open decision unanswered: ${open}. Your owner can't answer it now, and a wait for it ends.`]);
    const waited = await waiting.done;
    assert.deepEqual([waited.code, waited.out], [2, `Closed unanswered. "Ship tonight?" (${open}) closed when agent ${id} finished, before your owner answered it, so no answer will come.\nDon't wait for it again. To ask about new work, connect again.\n`]);
    assert.ok(waited.at - at < 2_000, `the wait stopped ${waited.at - at} ms after the finish`);
    assert.deepEqual((await op.finish(id)).text, finished.text, 'finishing again names the same one');

    // The answer sent before is still there to collect and acknowledge; its status lists the one that closed, and
    // counts nothing open.
    assert.match((await op.wait(id, sent)).text, /^Answered at .*: option B "Later"\./);
    const status = await op.status(id);
    assert.equal(status.text, [`Agent ${id} · Codex · finishing`, 'Pager: on', 'Open decisions: 0', `Answered, not yet acknowledged: ${sent}`, `Closed unanswered when this agent finished: ${open}`].join('\n'));
    assert.equal((await op.ack(id, sent, 'Later, then.')).code, 0);
    const acked = await op.ack(id, open, 'Shipping.');
    assert.deepEqual([acked.code, acked.text], [2, `Closed unanswered. "Ship tonight?" (${open}) closed when agent ${id} finished, before your owner answered it, so no answer will come.\nThere is no answer to acknowledge. To ask about new work, connect again.`]);
    const history = op.history(id).text;
    assert.ok(history.includes('Options: Now / Later → closed unanswered when its agent finished'), history);
    assert.ok(history.includes('Options: Now / Later → option B "Later"\n  Next: Later, then.'), history);
  } finally { await f.stop(); }
});

// The m5 command, built from its tag, as Sam's machines run it until they update (Sam's answer 4a, 7 Nov 2026,
// blueprint/milestones/M6-tidy.md), and the m5 contract, which its command and app read with.
test('The m5 command on this service: its wait with no end stops as its agent finishes, in the service\'s words; status and finish read as before, and every reply decodes with the m5 contract', { timeout: 600_000 }, async () => {
  const m5 = release('m5');
  const f = await fixture('cli-finish-m5');
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-finish-m5-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-finish-m5-card-'));
  const env = { AGENTPAGER_HOME: home };
  const m5Command = async (...args: string[]) => { const r = await run([m5.binary, ...args], env).done; return { code: r.code, out: r.out }; };
  try {
    const p = await f.makePager();
    const connected = await m5Command('connect', p.number, '--app', 'Codex', '--project', 'm5', '--server', f.origin, '--json');
    assert.equal(connected.code, 0, connected.out);
    const id = String(JSON.parse(connected.out).result.agent);
    writeFileSync(path.join(work, 'card.yaml'), card('Ship tonight?'));
    const asked = await m5Command('ask', '--agent', id, path.join(work, 'card.yaml'), '--json');
    assert.equal(asked.code, 0, asked.out);
    const open = String(JSON.parse(asked.out).result.decision);

    const waiting = run([m5.binary, 'wait', '--agent', id, open, '--forever'], env);
    await pause(2_000);
    assert.equal(waiting.ended(), false, 'm5\'s wait with no end holds');
    const at = Date.now(), finished = await m5Command('finish', '--agent', id);
    assert.deepEqual(finished, { code: 0, out: `Finished. Your owner's phone shows ${id} as finished; it asks nothing more. Its decisions stay on the phone.\n` });
    const waited = await waiting.done;
    assert.deepEqual([waited.code, waited.out], [2, DECISION_CLOSED_MESSAGE + '\n']);
    assert.ok(waited.at - at < 2_000, `m5's wait stopped ${waited.at - at} ms after the finish`);
    assert.deepEqual(await m5Command('status', '--agent', id), { code: 0, out: [`Agent ${id} · Codex · m5`, 'Pager: on', `Open decisions: 0 (${open})`, 'Answered, not yet acknowledged: none', ''].join('\n') });
    assert.deepEqual(await m5Command('ack', '--agent', id, open, 'Shipping.'), { code: 2, out: DECISION_CLOSED_MESSAGE + '\n' });

    // What this service sends about a closed decision, read with the m5 contract's own schemas, as its command and
    // app read: the decision is open to them, and what they don't know is dropped.
    const reader = path.join(m5.app, '..', 'contract', 'm5-reader.ts');
    writeFileSync(reader, 'export { Schema } from "effect";\nexport * from "./exchange.ts";\n');
    const old = await import(pathToFileURL(reader).href), { Schema } = old;
    const inbox = await f.request(`/api/pagers/${p.pagerId}`, { phone: p.phone }), agentId = Now.decodeUnknownSync(PagerInbox)(inbox.value).agents[0]?.agent.agentId ?? '';
    const read = Schema.decodeUnknownSync(old.PagerInbox)(inbox.value);
    assert.deepEqual(read.agents[0].open.map((d: { status: string }) => d.status), ['open']);
    assert.equal('closed' in read.agents[0].open[0], false);
    assert.equal(read.agents[0].agent.openCount, 0);
    const agentFile = JSON.parse(readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8'));
    const status = await f.request(`/api/agents/${agentId}`, { agent: agentFile.agentKey }), again = await f.request(`/api/agents/${agentId}/finish`, { method: 'POST', agent: agentFile.agentKey });
    assert.deepEqual([Now.decodeUnknownSync(AgentStatus)(status.value).closed?.map(c => c.decisionId).length, Now.decodeUnknownSync(Finished)(again.value).closed?.length], [1, 1], 'this service lists what closed');
    assert.equal('closed' in Schema.decodeUnknownSync(old.AgentStatus)(status.value), false);
    assert.equal('closed' in Schema.decodeUnknownSync(old.Finished)(again.value), false);
  } finally { await f.stop(); }
});
