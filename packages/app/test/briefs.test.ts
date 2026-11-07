import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fixture, assert, token, C, emojiCard, asClient } from './support.ts';
import { briefNames, briefsDir, loadBrief } from '../fixtures/briefs/load.ts';

// Decision briefs: an agent sends Markdown with lettered options and attachments; the phone reads the decision
// and fetches each attachment by name. The Frame's refusals are whole, with the reason.

// The agent objects' stored databases, read after the server stops.
function agentDatabases(persist: string) {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.sqlite')) files.push(p); } };
  walk(path.join(persist, 'v3', 'do'));
  return files.map(file => new DatabaseSync(file)).filter(db => db.prepare("SELECT 1 FROM sqlite_master WHERE name='attachments'").get());
}
const count = (db: DatabaseSync) => Number(db.prepare('SELECT count(*) AS n FROM attachments').get()?.n);
test('briefs: the four canvas examples ask, read back as sent, answer, and go with the pager when it is deleted', { timeout: 180_000 }, async () => {
  const f = await fixture('briefs');
  try {
    const { p, a: s } = await f.connected('Claude Code', 'shop');
    const phone = p.phone, agentId = s.agent.agentId;
    const cards = `/api/agents/${agentId}/cards`;
    const asked = new Map<string, string>();
    for (const name of briefNames()) {
      const r = await f.ok(C.Asked, cards, { agent: s.agentKey, data: { requestId: token(), ...loadBrief(name) } });
      asked.set(name, r.decisionId);
    }
    assert.deepEqual([...asked.keys()], ['D1-pricing', 'D2-checkout', 'D3-refunds', 'D4-branches']);

    const inbox = (await f.pager(p.pagerId, phone)).agents[0];
    await f.artifact('inbox.json', inbox);
    assert.equal(inbox.open.length, 4);
    for (const d of inbox.open) {
      const sent = loadBrief([...asked].find(([, id]) => id === d.decisionId)?.[0] ?? '');
      assert.equal(d.card.type, 'brief');
      assert.deepEqual(d.card, sent.card, 'the card reads back as sent');
      // The inbox names each attachment; its bytes never ride along with the poll.
      assert.ok(!JSON.stringify(d).includes('base64'));
    }
    const d1 = inbox.open.find(d => d.decisionId === asked.get('D1-pricing'));
    assert.deepEqual(d1?.attachments?.map(a => a.name), ['a-cards.png', 'b-table-phone.png', 'b-table.png', 'background.md', 'c-link.png']);

    // The phone reads each attachment byte for byte, with its type; nobody else can.
    const file = (decisionId: string, name: string, headers: Record<string, string> = { 'x-phone-key': phone }) => fetch(`${f.origin}${cards}/${decisionId}/files/${name}`, { headers: { ...asClient, ...headers } });
    for (const [name, decisionId] of asked) for (const a of inbox.open.find(d => d.decisionId === decisionId)?.attachments ?? []) {
      const r = await file(decisionId, a.name);
      assert.equal(r.status, 200, `${name}/${a.name}`);
      assert.equal(r.headers.get('content-type')?.split(';')[0], a.type);
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.ok(bytes.equals(readFileSync(path.join(briefsDir, name, a.name))), `${name}/${a.name} reads back byte for byte`);
      assert.equal(bytes.length, a.bytes);
    }
    const d2 = asked.get('D2-checkout') ?? '';
    assert.equal((await file(d2, 'nope.md')).status, 404);
    assert.equal((await file(d2, 'design.md', { 'x-phone-key': token() })).status, 401);
    assert.equal((await file(d2, 'design.md', { authorization: `Bearer ${s.agentKey}` })).status, 401);
    assert.equal((await file(d2, '..%2Fpager')).status, 400);

    // Answers are by number: 3 is C.
    const receipt = await f.answer(agentId, phone, d2, { kind: 'option', number: 3 });
    const read = await f.read(s, d2);
    assert.equal(read.status, 'answered');
    if (read.status === 'answered') assert.deepEqual(read.answer.choice, { kind: 'option', number: 3 });
    await f.ack(s, d2, receipt.answerId, 'Holding timed-out orders and emailing when they settle.');

    // Deleting the pager takes the attachments with it.
    await f.request(`/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone });
    assert.equal((await file(d2, 'design.md')).status, 404);
    await f.stop();
    const stores = agentDatabases(f.persist);
    assert.ok(stores.length > 0, 'the agent object has an attachments table');
    for (const db of stores) { assert.equal(count(db), 0, 'no attachment bytes after the delete'); db.close(); }
  } finally { await f.stop(); }
});

test('briefs: refused whole, with a reason that says what to fix', { timeout: 120_000 }, async () => {
  const f = await fixture('briefs-refused');
  try {
    const { p, a: s } = await f.connected('Claude Code', 'shop');
    const cards = `/api/agents/${s.agent.agentId}/cards`;
    const base: Record<string, unknown> = { requestId: token(), ...loadBrief('D4-branches') };
    const card = (patch: Record<string, unknown>) => ({ ...base, card: { ...(typeof base.card === 'object' ? base.card : {}), ...patch } });
    const markdown = String((typeof base.card === 'object' && base.card !== null && 'markdown' in base.card) ? base.card.markdown : '');
    const png = Buffer.from(readFileSync(path.join(briefsDir, 'D1-pricing', 'a-cards.png'))).toString('base64');
    const cases: [string, unknown, RegExp][] = [
      ['recommendation names another option', card({ markdown: markdown.replace('## Recommendation: A', '## Recommendation: B') }), /does not match card\.recommended/],
      ['recommendation without recommended', card({ recommended: undefined }), /set card\.recommended/],
      ['an option block for a letter that is no option', card({ markdown: markdown + '\n:::option C\nThird\n:::\n' }), /names no option/],
      ['a tradeoffs column for a letter that is no option', card({ markdown: markdown.replace('| B Keep             |', '| C Keep             |') }), /Tradeoffs column/],
      ['HTML outside code', card({ markdown: markdown + '\n<img src=x onerror=alert(1)>\n' }), /HTML is not allowed/],
      ['a link to a missing attachment', card({ markdown: markdown + '\n[Read more background](background.md)\n' }), /neither an attachment nor an https link/],
      ['a remote image', card({ markdown: markdown + '\n![Mock](https://example.com/a.png)\n' }), /is not an attachment/],
      ['a container left open', card({ markdown: markdown + '\n:::smallprint\n- one\n' }), /never closed/],
      ['five options', card({ options: [1, 2, 3, 4, 5].map(number => ({ number, title: `Option ${number}`, prioritizes: 'speed' })) }), /between 1 and 4|at most 4|maxItems|4 items/i],
      ['a label too long for its tile', card({ options: [{ number: 1, title: 'Delete them', label: 'Delete every one of them now', prioritizes: 'a clean list' }, { number: 2, title: 'Keep them', prioritizes: 'links' }] }), /label may not exceed 20/],
      ['an image that is not what it says', { ...base, card: { ...card({}).card, markdown: markdown + '\n![Mock](a.png)\n' }, attachments: [{ name: 'a.png', type: 'image/png', base64: Buffer.from('GIF89a not a png').toString('base64') }] }, /is not a whole PNG file/],
      ['a brief with no Options section', card({ markdown: markdown.replace('## Options\n', '') }), /needs an "## Options" section/],
      ['an image naming a page', { ...base, card: { ...card({}).card, markdown: markdown + '\n![Mock](notes.md)\n' }, attachments: [{ name: 'notes.md', type: 'text/markdown', text: '# Notes' }] }, /names a page, not an image/],
      ['an image named for another type', { ...base, card: { ...card({}).card, markdown: markdown + '\n![Mock](a.jpg)\n' }, attachments: [{ name: 'a.jpg', type: 'image/png', base64: png }] }, /must end in \.png/],
      ['an emoji card', emojiCard, /card\.type: Expected "brief"/],
      ['an option with an emoji', card({ options: [{ number: 1, title: 'One', prioritizes: 'speed', emoji: '🚀' }, { number: 2, title: 'Two', prioritizes: 'safety' }] }), /emoji.*is unexpected/],
      ['a title over 100 characters', { ...base, title: 'x'.repeat(101) }, /title: a title may not exceed 100 characters/],
      ['a detail over 280 characters', { ...base, detail: 'x'.repeat(281) }, /detail: text may not exceed 280 characters/],
      ['an unknown field', { ...base, card: { ...card({}).card, extra: 'dropped?' } }, /extra|is unexpected/],
    ];
    for (const [label, data, reason] of cases) {
      const e = await f.refused(400, 'InvalidInput', cards, { agent: s.agentKey, data });
      assert.match(e.reason ?? '', reason, `${label}: ${e.reason}`);
    }
    await f.refused(401, 'Unauthorized', cards, { agent: token(), data: emojiCard });
    const inbox = (await f.pager(p.pagerId, p.phone)).agents[0];
    assert.equal(inbox.open.length, 0, 'nothing refused was stored');

  } finally { await f.stop(); }
});

// Decisions asked before 31 Oct 2026 were stored with "kind": "card" and each option's keycap as emoji. The first
// time an agent's object starts on this code it rewrites them without either, and they stay immutable after.
test('briefs: a decision stored with kind and keycaps reads back without them', { timeout: 120_000 }, async () => {
  const f = await fixture('legacy-decisions');
  try {
    const { p, a } = await f.connected();
    const open = await f.ask(a, 'Still open?'), answered = await f.ask(a, 'Answered?');
    await f.answer(a.agent.agentId, p.phone, answered.decisionId);
    const before = (await f.pager(p.pagerId, p.phone)).agents[0];
    await f.stop();
    const keycaps = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    for (const db of agentDatabases(f.persist)) {
      db.exec('DROP TRIGGER proposal_immutable');
      for (const row of db.prepare('SELECT id, json FROM proposals').all()) {
        const d = JSON.parse(String(row.json));
        const legacy = { decisionId: d.decisionId, kind: 'card', ...d, card: { ...d.card, options: d.card.options.map((o: { number: number }) => ({ ...o, emoji: keycaps[o.number - 1] })) } };
        db.prepare('UPDATE proposals SET json=? WHERE id=?').run(JSON.stringify(legacy), String(row.id));
      }
      db.exec("CREATE TRIGGER proposal_immutable BEFORE UPDATE ON proposals BEGIN SELECT RAISE(ABORT,'immutable proposal'); END;");
      assert.ok(String(db.prepare('SELECT json FROM proposals LIMIT 1').get()?.json).includes('"kind":"card"'));
      db.close();
    }
    await f.restart();
    const after = (await f.pager(p.pagerId, p.phone)).agents[0];
    assert.deepEqual([after.open, after.answered], [before.open, before.answered], 'the decisions read as they did before the old shape was put back');
    assert.deepEqual([...after.open, ...after.answered].map(d => d.decisionId).sort(), [open.decisionId, answered.decisionId].sort());
    await f.stop();
    for (const db of agentDatabases(f.persist)) {
      for (const row of db.prepare('SELECT json FROM proposals').all()) {
        const json = String(row.json);
        assert.ok(!json.includes('"kind"') && !json.includes('"emoji"'), json);
      }
      assert.throws(() => db.prepare("UPDATE proposals SET json='{}'").run(), /immutable proposal/);
      db.close();
    }
  } finally { await f.stop(); }
});
