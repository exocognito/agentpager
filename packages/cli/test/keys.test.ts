import { test } from 'node:test';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixture, assert } from '../../app/test/support.ts';
import { keyPair, seal, toBase64url } from '../../contract/envelope.ts';
import { encodePart } from '../../contract/parts.ts';
import { AnswerStatus } from '../../contract/exchange.ts';

// A service that isn't honest, in front of the real one: it passes every call, and can swap the pager's public key it
// gives, or the answer part it hands back, as a service that wanted to read or forge decisions could.
async function dishonest(target: string) {
  let key: string | null = null, answer: ((part: string) => string) | null = null;
  const seen: string[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    seen.push(`${req.method} ${req.url}`);
    const headers = Object.fromEntries(['content-type', 'authorization', 'x-agentpager-client', 'x-phone-key'].filter(k => req.headers[k]).map(k => [k, String(req.headers[k])]));
    const reply = await fetch(target + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    let body = await reply.text();
    if (key && /\/key$/.test(req.url ?? '') && reply.ok) body = JSON.stringify({ ...JSON.parse(body), publicKey: key });
    if (answer && /\/answer/.test(req.url ?? '') && req.method === 'GET' && reply.ok) {
      const value = JSON.parse(body);
      if (value.status === 'answered') body = JSON.stringify({ ...value, answer: { ...value.answer, answer: answer(value.answer.answer) } });
    }
    res.writeHead(reply.status, { 'content-type': 'application/json' });
    res.end(body);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  return {
    origin: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`, seen,
    swapKey: (k: string | null) => { key = k; }, swapAnswer: (f: ((part: string) => string) | null) => { answer = f; },
    close: () => new Promise(r => { server.closeAllConnections(); server.close(r); }),
  };
}
const field = (r: { json?: unknown }, key: string) => String(typeof r.json === 'object' && r.json !== null ? Reflect.get(r.json, key) : undefined);
const small = (title: string) => `title: ${title}\ndetail: Where to eat.\ncontext:\n  summary: Friday is booked.\noptions:\n  - {label: Sushi, title: Sushi, prioritizes: fish}\n  - {label: Pasta, title: Pasta, prioritizes: carbs}\nrecommendation: {option: B, why: Closer.}\n`;

test('I19.6 I19.7 A pager key that doesn\'t match the number is caught on the agent\'s machine: nothing is sent, and the agent is told to check the number and stop', { timeout: 180_000 }, async () => {
  const f = await fixture('cli-keys'), net = await dishonest(f.origin);
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-keys-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = net.origin; delete process.env.AGENTPAGER_PAGER;
  const op = await import('../src/commands.ts'), store = await import('../src/store.ts');
  try {
    const p = await f.makePager();
    // The service swaps the key: the command reads it, sees the number names another, and sends nothing else.
    net.swapKey(toBase64url(keyPair().publicKey));
    const refused = await op.connect({ number: p.number, app: 'Codex', project: 'keys' });
    assert.deepEqual(refused, { code: 2, text: `Not connected, and nothing was sent: the key this pager number names doesn't match the key ${new URL(net.origin).host} gave for it. Check the number with the one your owner gave you. If it is right, stop and tell your owner.` });
    assert.deepEqual(net.seen, [`GET /api/pagers/${p.pagerId}/key`], 'only the key was read; no connect went out');
    assert.deepEqual((await f.pager(p.pagerId, p.phone)).agents, [], 'no agent on the phone');
    assert.ok(!existsSync(path.join(home, 'agents')) || readdirSync(path.join(home, 'agents')).filter(n => n.endsWith('.json')).length === 0, 'no agent saved');

    // With the right key it connects, and pins it: every part is sealed to the key it checked, read once.
    net.swapKey(null);
    const c = await op.connect({ number: p.number, app: 'Codex', project: 'keys' });
    assert.equal(c.code, 0, c.text);
    const id = field(c, 'agent');
    assert.equal(store.loadAgent(id)?.pagerKey, p.publicKey, 'the key the number names, pinned');
    net.swapKey(toBase64url(keyPair().publicKey));
    const asked = await op.ask(id, { yaml: small('Pinned?'), dir: work });
    assert.equal(asked.code, 0, asked.text);
    assert.equal(net.seen.filter(s => s.endsWith('/key')).length, 2, 'the key was read only at connect');
    assert.deepEqual((await f.pager(p.pagerId, p.phone)).agents[0].open.map(d => d.title), ['Pinned?'], 'the phone opens it with its own key');
    // The private key is the agent's alone: never printed.
    const file = JSON.parse(readFileSync(path.join(home, 'agents', `${id}.json`), 'utf8'));
    for (const r of [c, asked, await op.status(id), op.agents()]) assert.ok(!JSON.stringify(r).includes(file.privateKey) && !JSON.stringify(r).includes(file.agentKey));
  } finally { await net.close(); await f.stop(); }
});

test('B30.2 An answer the service moves to another decision, or seals itself, is refused by the command', { timeout: 180_000 }, async () => {
  const f = await fixture('cli-moved'), net = await dishonest(f.origin);
  const home = mkdtempSync(path.join(tmpdir(), 'agentpager-moved-')), work = mkdtempSync(path.join(tmpdir(), 'agentpager-card-'));
  process.env.AGENTPAGER_HOME = home; process.env.AGENTPAGER_SERVER = net.origin; delete process.env.AGENTPAGER_PAGER;
  const op = await import('../src/commands.ts'), store = await import('../src/store.ts');
  try {
    const p = await f.makePager();
    const id = field(await op.connect({ number: p.number, app: 'Codex', project: 'moved' }), 'agent');
    const one = field(await op.ask(id, { yaml: small('One?'), dir: work }), 'decision');
    const two = field(await op.ask(id, { yaml: small('Two?'), dir: work }), 'decision');
    const a = store.loadAgent(id), ids = [a?.decisions[one]?.id ?? '', a?.decisions[two]?.id ?? ''];
    const agentId = a?.agentId ?? '';
    await f.answer(agentId, p.phone, ids[0], { kind: 'option', number: 1 });
    await f.answer(agentId, p.phone, ids[1], { kind: 'option', number: 2 });
    const first = await f.ok(AnswerStatus, `/api/agents/${agentId}/cards/${ids[0]}/answer`, { agent: a?.agentKey });
    const moved = first.status === 'answered' ? first.answer.answer : '';
    const unreadable = (short: string) => ({ code: 2, text: `An answer to ${short} arrived, but it can't be read as your owner's answer to that card, so it may not be theirs. Don't act on it: tell your owner.` });
    // The first decision's answer handed back for the second.
    net.swapAnswer(() => moved);
    assert.deepEqual(await op.wait(id, two), unreadable(two));
    // An answer the service sealed itself, to the pager's key, the only key it has.
    net.swapAnswer(() => seal(Buffer.from(p.publicKey, 'base64url'), 'answer', { pagerId: p.pagerId, decisionId: ids[1] }, encodePart('answer', { choice: { kind: 'option', number: 1 } })));
    assert.deepEqual(await op.wait(id, two), unreadable(two));
    // Neither was taken as the answer.
    assert.equal(store.loadAgent(id)?.decisions[two]?.answered, undefined);
    net.swapAnswer(null);
    assert.match((await op.wait(id, two)).text, /option B "Pasta"/);
    assert.match((await op.wait(id, one)).text, /option A "Sushi"/);
  } finally { await net.close(); await f.stop(); }
});
