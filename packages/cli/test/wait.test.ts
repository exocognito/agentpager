import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixture, assert, pause } from '../../app/test/support.ts';
import { harness, self } from '../src/detect.ts';
import type { Result } from '../src/commands.ts';

// A field of a command's --json result, read without a cast.
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);

// How to wait follows the harness that waits (B33, blueprint/areas/2-agents.md). Only a positive identification
// changes the words; every other agent keeps the ones cli.test.ts checks.
test('harness: Claude Code and Claude Desktop only when positively identified', () => {
  for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT']) delete process.env[v];
  assert.equal(harness(), null, 'a shell with no marker');
  process.env.CLAUDECODE = '1';
  assert.equal(harness(), 'claude-code', 'Claude Code\'s shell');
  process.env.CODEX_HOME = '/tmp/codex';
  assert.equal(harness(), null, 'Codex started from a Claude Code shell');
  delete process.env.CODEX_HOME;
  const clients: [string, string | null][] = [['claude-code', 'claude-code'], ['local-agent-mode-agentpager', 'claude-desktop'], ['claude-ai', null], ['codex-mcp-client', null], ['cursor-vscode', null], ['pi', null], ['', null]];
  for (const [client, h] of clients) assert.equal(harness(client), h, `MCP client "${client}", whatever the environment`);
  delete process.env.CLAUDECODE;
});

test('waiting words: Claude Code in the background, a Claude Desktop chat in its turn, and waiting forever outlasts a restart', { timeout: 240_000 }, async () => {
  const f = await fixture('cli-wait');
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-cli-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = f.origin; delete process.env.AGENTPAGER_PAGER;
  for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT']) delete process.env[v];
  const op = await import('../src/commands.ts');
  const store = await import('../src/store.ts');
  const card = (title: string) => ({ object: { title, detail: 'A test.', context: { summary: 'Ready.' }, options: [{ label: 'Now', title: 'Now', prioritizes: 'speed' }, { label: 'Later', title: 'Later', prioritizes: 'rest' }], recommendation: { option: 'A', why: 'Ready.' } } });
  const decision = (r: Result) => field(r, 'decision');
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Claude Code', project: 'wake' }), 'agent');

    // A harness the binary identifies names itself, whatever app the agent passes; any other keeps what it passed.
    const q = await f.makePager();
    const named = async (app: string, mcpClient: string) => store.loadAgent(field(await op.connect({ number: q.number, app, project: 'wake', mcpClient }), 'agent'))?.app;
    assert.equal(await named('Claude', 'local-agent-mode-agentpager'), 'Claude Desktop');
    assert.equal(await named('Claude', 'codex-mcp-client'), 'Claude');

    // Claude Code, from its shell: start the forever wait as a background command; it ends with the answer.
    process.env.CLAUDECODE = '1';
    const fromCode = await op.ask(id, card('From Claude Code?'));
    const d1 = decision(fromCode);
    const background = `run \`${self()} wait --agent ${id} ${d1} --forever\` as a background command, then carry on or end your turn. It ends when your owner answers, and you get the answer then.`;
    assert.ok(fromCode.text.endsWith(`\nDecision ${d1}. Wait for the answer in the background: ${background}`), fromCode.text);
    assert.equal((await op.wait(id, d1, { seconds: 1 })).text, `Pending. Your owner hasn't answered "From Claude Code?" yet.\nKeep waiting in the background: ${background}`);
    // The same agent seen through Codex, by its environment or its MCP client, gets everyone's words.
    const everyone = `Pending. Your owner hasn't answered "From Claude Code?" yet.\nKeep waiting: agentpager wait --agent ${id} ${d1}`;
    process.env.CODEX_HOME = '/tmp/codex';
    assert.equal((await op.wait(id, d1, { seconds: 1 })).text, everyone);
    delete process.env.CODEX_HOME;
    assert.equal((await op.wait(id, d1, { seconds: 1, client: 'codex-mcp-client' })).text, everyone);
    delete process.env.CLAUDECODE;

    // A Claude Desktop chat: stay in the turn, check between other work, ride out a dropped link to the Mac.
    const desk = 'local-agent-mode-agentpager';
    const fromDesk = await op.ask(id, card('From Claude Desktop?'), desk);
    const d2 = decision(fromDesk);
    const relink = 'If a wait call fails or the wait tool disappears, the link to this computer dropped; it comes back by itself within seconds: run sleep 10 in your shell, then call wait again, up to 10 times.';
    assert.ok(fromDesk.text.endsWith([
      `\nDecision ${d2}. Don't end your turn until it's answered: the answer reaches you only while you're working.`,
      `Other work that doesn't need it? Do it, and call the agentpager wait tool (agent ${id}, decision ${d2}) with seconds 1 between steps.`,
      'Nothing else to do? Call wait without seconds (it holds 50 s), again and again, until it returns the answer.',
      relink,
    ].join('\n')), fromDesk.text);
    assert.equal((await op.wait(id, d2, { seconds: 1, client: desk })).text, [
      'Pending. Your owner hasn\'t answered "From Claude Desktop?" yet.',
      'Carry on with your other work and check again after your next step. When you run out of work, call wait without seconds and keep calling it. Don\'t end your turn.',
      relink,
    ].join('\n'));
    const agentFile = store.loadAgent(id);
    assert.ok(agentFile);
    assert.equal(op.pending(agentFile, { short: d2, title: 'From Claude Desktop?' }, false, 'claude-desktop').text, [
      'Pending. Your owner hasn\'t answered "From Claude Desktop?" yet.',
      'Call wait again now, and keep calling it until it returns the answer. Don\'t end your turn.',
      relink,
    ].join('\n'));
    // Two hours after asking, by the binary's own record, the chat stops; the answer stays for a later wait.
    store.updateAgent(id, x => { x.decisions[d2].askedAt = new Date(Date.now() - op.DESKTOP_WAIT_MS).toISOString(); });
    assert.equal((await op.wait(id, d2, { seconds: 1, client: desk })).text, [
      'Pending. Your owner hasn\'t answered "From Claude Desktop?" in 2 hours.',
      'Stop waiting: end your turn and tell your owner you stopped waiting for this decision. Their answer stays on the',
      `server; call wait (agent ${id}, decision ${d2}) for it when you're next working.`,
    ].join('\n'));

    // Waiting forever outlasts the server going away and coming back, as a sleeping Mac or a deploy would see it.
    const forever = op.wait(id, d1, { forever: true, seconds: 1 });
    await f.stop(); await pause(1500); await f.restart();
    const inbox = await f.pager(p.pagerId, p.phone);
    const agentId = inbox.agents[0]?.agent.agentId ?? '', decisionId = inbox.agents.flatMap(a => a.open).find(x => x.title === 'From Claude Code?')?.decisionId ?? '';
    await f.answer(agentId, p.phone, decisionId, { kind: 'option', number: 2 });
    assert.match((await forever).text, new RegExp(`^Answered at \\d{1,2}:\\d{2} [AP]M: option B "Later"\\.\\nDo it, then confirm: agentpager ack --agent ${id} ${d1} "<what happens next>"$`));
  } finally { await f.stop(); }
});
