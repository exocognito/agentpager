import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer as createHttp } from 'node:http';
import { createServer as createNet, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Asked, type Choice } from '../../contract/exchange.ts';
import { seal } from '../../contract/envelope.ts';
import { encodePart } from '../../contract/parts.ts';
import { newKeys } from '../src/seal.ts';

// What leaves this machine and what comes back is held to the server's own contract: a card the server would refuse
// is refused here, and a reply that isn't AgentPager's, or none at all, never reads as done or as "Nothing was sent".
const cli = fileURLToPath(new URL('..', import.meta.url));
const png = path.join(cli, '..', 'app', 'fixtures', 'briefs', 'D1-pricing', 'a-cards.png');
const home = mkdtempSync(path.join(tmpdir(), 'agentpager-decode-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
process.env.AGENTPAGER_HOME = home; delete process.env.AGENTPAGER_SERVER; delete process.env.AGENTPAGER_PAGER;
for (const v of ['CLAUDECODE', 'CODEX_SANDBOX', 'CODEX_HOME', 'CURSOR_TRACE_ID', 'PI_CODING_AGENT']) delete process.env[v];
const op = await import('../src/commands.ts');
const store = await import('../src/store.ts');
const { compile } = await import('../src/card.ts');
const { call } = await import('../src/client.ts');

const options = (first = 'Ship tonight') => `  - {label: Ship, title: ${first}, prioritizes: speed}\n  - {label: Wait, title: Ship Monday, prioritizes: sleep}\n`;
const small = (opts = options()) => `title: Ship tonight?\ndetail: The release.\ncontext:\n  summary: Ready.\noptions:\n${opts}recommendation: {option: B, why: Rested.}\n`;
// A pager as the phone makes one: the number names its id and its key's fingerprint.
const pagerKeys = newKeys(), pagerId = '0'.repeat(32), decisionId = 'D'.repeat(32);
const number = 'ap1_' + Buffer.concat([Buffer.alloc(16), createHash('sha256').update(Buffer.from(pagerKeys.publicKey, 'base64url')).digest().subarray(0, 8)]).toString('base64url');
// An agent file as connect writes it, for a server of the test's own, with keys of its own.
const agentKeys = new Map<string, string>();
const agent = (id: string, server: string) => {
  const own = newKeys();
  agentKeys.set(id, own.publicKey);
  store.saveAgent({ id, server, pager: pagerId, agentId: 'A'.repeat(32), agentKey: 'K'.repeat(32), privateKey: own.privateKey, pagerKey: pagerKeys.publicKey, app: 'Codex', project: 'decode', createdAt: new Date().toISOString(), rulesShownAt: new Date().toISOString(), cardsSinceRules: 0, decisions: {} });
  return id;
};
// The phone's answer, sealed to the agent's key for this decision.
const answerTo = (id: string, choice: Choice) => seal(new Uint8Array(Buffer.from(agentKeys.get(id) ?? '', 'base64url')), 'answer', { pagerId, decisionId }, encodePart('answer', { choice }));

// A server on a free port; closing it drops whatever it still holds open.
async function serve(server: Server) {
  const open = new Set<Socket>();
  server.on('connection', s => { open.add(s); s.on('close', () => open.delete(s)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`, close: () => { for (const s of open) s.destroy(); return new Promise(resolve => server.close(resolve)); } };
}

test('a card the server would refuse is refused here, in card.yaml words, before anything is sent', async () => {
  const long = compile({ yaml: small(options('Ship it tonight and watch it '.repeat(11))), dir: work });
  assert.deepEqual(long.ok ? [] : long.problems, ['options[0].title: text may not exceed 280 characters.']);
  copyFileSync(png, path.join(work, 'shot@2x.png'));
  writeFileSync(path.join(work, 'fake.png'), 'not an image');
  const attached = (name: string) => compile({ yaml: small().replace('summary: Ready.', `summary: "Ready. ![Shot](${name})"`) + `attachments: ["${name}"]\n`, dir: work });
  const badName = attached('shot@2x.png'), notPng = attached('fake.png');
  assert.deepEqual(badName.ok ? [] : badName.problems, ['Attachment shot@2x.png: an attachment name is 1 to 64 letters, digits, dots, dashes or underscores, such as background.md.']);
  assert.deepEqual(notPng.ok ? [] : notPng.problems, ['Attachment fake.png: "fake.png" is not a whole PNG file of at most 8192 pixels a side and 16777216 in all.']);
  assert.equal(compile({ yaml: small(), dir: work }).ok, true, 'a card the server takes still compiles');
  // A page within its characters but over its bytes, as one character of many combining marks makes it: a page is held
  // to a million bytes, so its encrypted part fits one stored row.
  writeFileSync(path.join(work, 'heavy.md'), '# Heavy\n\n' + ('a' + '\u0301'.repeat(40)).repeat(13_000));
  const heavy = compile({ yaml: small().replace('summary: Ready.', 'summary: "Ready. [More](heavy.md)"') + 'attachments: ["heavy.md"]\n', dir: work });
  assert.deepEqual(heavy.ok ? [] : heavy.problems, ['Attachment heavy.md is 1,053,009 bytes; a page may be at most 1,000,000. Split it, or cut it.']);

  // ask refuses it with nothing sent: this server counts every request.
  let requests = 0;
  const counting = await serve(createHttp((_, res) => { requests++; res.end(); }));
  try {
    writeFileSync(path.join(work, 'long.yaml'), small(options('x'.repeat(281))));
    const refused = await op.ask(agent('ap-card', counting.origin), { file: path.join(work, 'long.yaml') });
    assert.deepEqual([refused.code, refused.text, requests], [2, 'options[0].title: text may not exceed 280 characters.', 0]);
  } finally { await counting.close(); }
});

test('a 200 that isn\'t AgentPager\'s reply: exit 5, nothing saved, and never "Nothing was sent"', { timeout: 60_000 }, async () => {
  let requests = 0;
  const portal = await serve(createHttp((_, res) => { requests++; res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<html><body>Sign in to Hotel Wi-Fi</body></html>'); }));
  const odd = await serve(createHttp((_, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }));
  const unclear = (origin: string, type: string) => `The reply from ${origin} wasn't understood (HTTP 200, ${type}). A proxy or Wi-Fi sign-in page may have answered for it.\nThis may or may not have reached your owner.`;
  try {
    // The pager's key is read first, and a page that isn't AgentPager's answers that: only the pager's id went out.
    const agents = store.agentIds(), connected = await op.connect({ number, app: 'Codex', project: 'decode', server: portal.origin });
    assert.deepEqual([connected.code, connected.text], [5, `The reply from ${portal.origin} wasn't understood (HTTP 200, text/html). A proxy or Wi-Fi sign-in page may have answered for it.\nNot connected, and nothing reached your owner: try again.`]);
    assert.deepEqual(store.agentIds(), agents, 'no agent saved with an "undefined" key');

    const asked = await op.ask(agent('ap-wifi', portal.origin), { yaml: small(), dir: work });
    assert.deepEqual([asked.code, asked.text], [5, `${unclear(portal.origin, 'text/html')} Check with \`agentpager status --agent ap-wifi\` before trying again.\nAsking again with the same card is safe: your owner gets it once.`]);
    assert.deepEqual(store.loadAgent('ap-wifi')?.decisions, {}, 'no decision recorded as "undefined"');
    assert.equal(existsSync(path.join(home, 'history')), false, 'nothing in history');

    // Waiting forever ends on it instead of spinning as pending.
    const before = requests, waited = await op.wait('ap-wifi', decisionId, { forever: true });
    assert.deepEqual([waited.code, waited.text, requests - before], [5, `${unclear(portal.origin, 'text/html')} Check with \`agentpager status --agent ap-wifi\` before trying again.`, 1]);
    // JSON of the wrong shape is no better.
    const status = await op.status(agent('ap-odds', odd.origin));
    assert.deepEqual([status.code, status.text], [5, `${unclear(odd.origin, 'application/json')} Check with \`agentpager status --agent ap-odds\` before trying again.`]);
  } finally { await Promise.all([portal.close(), odd.close()]); }
});

test('sent, no reply: it may have reached the owner, and waiting forever still tries again', { timeout: 60_000 }, async () => {
  // Takes the request and never answers.
  const silent = await serve(createNet(s => { s.on('data', () => {}); }));
  // Takes the request, then drops the connection.
  const dropping = await serve(createNet(s => { s.on('data', () => s.resetAndDestroy()); }));
  // Gives the pager's key, then drops the connect.
  const keyed = await serve(createHttp((req, res) => {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ pagerId, publicKey: pagerKeys.publicKey })); return; }
    req.socket.resetAndDestroy();
  }));
  // Drops the first read, answers the next, and takes the command's word that it received the answer.
  let tries = 0;
  const received: unknown[] = [];
  const flaky = await serve(createHttp((req, res) => {
    if (req.method === 'POST' && req.url?.endsWith('/received')) {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => { received.push(JSON.parse(body)); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ decisionId, answerId: 'N'.repeat(32), collectedAt: new Date().toISOString() })); });
      return;
    }
    if (++tries === 1) { req.socket.resetAndDestroy(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'answered', answer: { answerId: 'N'.repeat(32), decisionId, requestId: 'R'.repeat(32), answer: answerTo('ap-wait', { kind: 'option', number: 1 }), sentAt: new Date().toISOString() } }));
  }));
  const closed = await serve(createNet());
  await closed.close();
  try {
    assert.deepEqual(await call(Asked, silent.origin, 'POST', '/api/agents/x/cards', { data: {}, timeoutMs: 300 }), { ok: false, status: 0, error: 'NoReply', message: 'timed out' });
    const asked = await op.ask(agent('ap-drop', dropping.origin), { yaml: small(), dir: work });
    assert.deepEqual([asked.code, asked.text], [5, `No reply from ${dropping.origin} (the connection closed).\nThis may or may not have reached your owner. Check with \`agentpager status --agent ap-drop\` before trying again.\nAsking again with the same card is safe: your owner gets it once.`]);
    const unkeyed = await op.connect({ number, app: 'Codex', project: 'decode', server: dropping.origin });
    assert.deepEqual([unkeyed.code, unkeyed.text], [5, `No reply from ${dropping.origin} (the connection closed).\nNot connected, and nothing reached your owner: try again.`]);
    const connected = await op.connect({ number, app: 'Codex', project: 'decode', server: keyed.origin });
    assert.deepEqual([connected.code, connected.text], [5, `No reply from ${keyed.origin} (the connection closed).\nThis may or may not have reached your owner. Connect again; their phone may show an extra agent from this try.`]);
    // Couldn't connect at all: nothing was sent, in today's words.
    const refused = await op.status(agent('ap-gone', closed.origin));
    assert.deepEqual([refused.code, refused.text], [5, `Can't reach ${closed.origin} (connection refused). Nothing was sent.\nIf this machine blocks outbound requests, add ${new URL(closed.origin).host} to its allow list and try again.`]);

    agent('ap-wait', flaky.origin);
    const waited = await op.wait('ap-wait', decisionId, { forever: true, seconds: 1 });
    assert.deepEqual([waited.code, tries, received], [0, 2, [{ answerId: 'N'.repeat(32) }]]);
    assert.match(waited.text, /^Answered at \d{1,2}:\d{2} [AP]M: option A "A"\./);
  } finally { await Promise.all([silent.close(), dropping.close(), keyed.close(), flaky.close()]); }
});

test('an agent file that can\'t be read is refused by its id, without its key; an older one still loads, and one from before the switch is told to connect again', async () => {
  const dir = path.join(home, 'agents'), file = (id: string) => path.join(dir, `${id}.json`);
  mkdirSync(dir, { recursive: true });
  const own = newKeys();
  const fields = { id: 'ap-keys', server: 'https://agentpager.me', pager: '0'.repeat(32), agentId: 'A'.repeat(32), agentKey: 'a-key-cut-SHORT', privateKey: own.privateKey, pagerKey: pagerKeys.publicKey, app: 'Codex', project: 'decode', createdAt: '2026-10-01T00:00:00.000Z', rulesShownAt: null, cardsSinceRules: 0, decisions: {} };
  // As the m4 command wrote it: no keys of its own, and its pager's key never checked.
  const { privateKey, pagerKey, ...m4 } = { ...fields, id: 'ap-m4go', agentKey: 'K'.repeat(32) };
  void privateKey; void pagerKey;
  writeFileSync(file('ap-m4go'), JSON.stringify(m4));
  writeFileSync(file('ap-junk'), '{"id": "ap-junk", ');
  writeFileSync(file('ap-keys'), JSON.stringify(fields));
  // From before decisions kept askedAt, with a field from a newer binary.
  writeFileSync(file('ap-olds'), JSON.stringify({ ...fields, id: 'ap-olds', agentKey: 'K'.repeat(32), sharedWith: [], decisions: { d_abcd: { id: decisionId, title: 'Old?', options: ['Yes', 'No'], answered: true } } }));

  assert.deepEqual(await op.status('ap-junk'), { code: 2, text: `Can't read agent ap-junk's file, ${file('ap-junk')} (not JSON). Connect again for a new agent.` });
  assert.equal(op.rules('ap-junk').code, 2);
  const keys = await op.ask('ap-keys', { yaml: small(), dir: work });
  assert.deepEqual(keys, { code: 2, text: `Can't read agent ap-keys's file, ${file('ap-keys')} (agentKey is missing or wrong). Connect again for a new agent.` });
  assert.ok(!keys.text.includes('SHORT'), 'the key is never printed');
  assert.equal(op.share('ap-olds').code, 0);
  assert.equal(op.rules('ap-olds').code, 0, 'loads, and its reminder clock is reset');
  assert.deepEqual(JSON.parse(readFileSync(file('ap-olds'), 'utf8')).sharedWith, [], 'a field it doesn\'t know survives the write');
  assert.equal(op.agents().text.split('\n').filter(row => row.startsWith('ap-olds  pager 00000000  decode · Codex')).length, 1, 'agents lists what it can read');
  assert.ok(!JSON.stringify(op.agents().json).includes(own.privateKey), 'its private key is never printed');
  const connectAgain = `Agent ap-m4go was connected before this version of agentpager, which encrypts every decision, so it can't ask or wait any more. Connect again with your owner's pager number for a new agent.`;
  for (const r of [await op.status('ap-m4go'), await op.ask('ap-m4go', { yaml: small(), dir: work }), await op.wait('ap-m4go', decisionId), op.rules('ap-m4go')]) assert.deepEqual(r, { code: 2, text: connectAgain });
  assert.ok(!connectAgain.includes('K'.repeat(32)));
});
