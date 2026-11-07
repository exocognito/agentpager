import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { Either, ParseResult, Schema } from 'effect';
import { fixture, assert, token, until, C, emojiCard, asClient, openDecision, asQuestion } from './support.ts';
import { briefNames, briefsDir, loadBrief } from '../fixtures/briefs/load.ts';
import { decodePart, encodePart } from '../../contract/parts.ts';
import { fromBase64url, open, seal } from '../../contract/envelope.ts';
import { publicOf } from '../../cli/src/seal.ts';

// Decision briefs: an agent sends Markdown with lettered options and attachments, each sealed to the pager's key; the
// phone opens the decision and fetches and opens each attachment by its slot.

// The agent objects' stored databases, read after the server stops.
export function agentDatabases(persist: string) {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.sqlite')) files.push(p); } };
  walk(path.join(persist, 'v3', 'do'));
  return opened(files, "SELECT 1 FROM sqlite_master WHERE name='attachments_v3'");
}
// The databases a query finds a row in, opened; every other is closed again, so none is held while the server runs.
function opened(files: string[], query: string) {
  return files.flatMap(file => { const db = new DatabaseSync(file); if (db.prepare(query).get()) return [db]; db.close(); return []; });
}
const count = (db: DatabaseSync) => Number(db.prepare('SELECT count(*) AS n FROM attachments_v3').get()?.n);
const fileBytes = (name: string, file: string) => readFileSync(path.join(briefsDir, name, file));
test('briefs: the four canvas examples ask, read back as sent, answer, and go with the pager when it is deleted', { timeout: 180_000 }, async () => {
  const f = await fixture('briefs');
  try {
    const { p, a: s } = await f.connected('Claude Code', 'shop');
    const phone = p.phone, agentId = s.agent.agentId;
    const cards = `/api/agents/${agentId}/cards`;
    const asked = new Map<string, string>();
    for (const name of briefNames()) {
      const r = await f.ok(C.Asked, cards, { agent: s.agentKey, data: await f.sealed(s, asQuestion(loadBrief(name))) });
      asked.set(name, r.decisionId);
    }
    assert.deepEqual([...asked.keys()], ['D1-pricing', 'D2-checkout', 'D3-refunds', 'D4-branches']);

    const wire = await f.ok(C.PagerInbox, `/api/pagers/${p.pagerId}`, { phone });
    // The poll names each attachment's size by slot; its bytes never ride along with it, and nothing is readable.
    assert.ok(!JSON.stringify(wire).includes('base64') && !JSON.stringify(wire).includes('background.md'));
    const inbox = (await f.pager(p.pagerId, phone)).agents[0];
    await f.artifact('inbox.json', inbox);
    assert.equal(inbox.open.length, 4);
    for (const d of inbox.open) {
      const sent = loadBrief([...asked].find(([, id]) => id === d.decisionId)?.[0] ?? '');
      assert.equal(d.card.type, 'brief');
      assert.deepEqual(d.card, sent.card, 'the card reads back as sent');
    }
    const d1 = inbox.open.find(d => d.decisionId === asked.get('D1-pricing'));
    assert.deepEqual(d1?.attachments?.map(a => a.name), ['a-cards.png', 'b-table-phone.png', 'b-table.png', 'background.md', 'c-link.png']);

    // The phone reads each attachment's part by its slot and opens it byte for byte; nobody else can fetch it.
    const file = (decisionId: string, slot: string, headers: Record<string, string> = { 'x-phone-key': phone }) => fetch(`${f.origin}${cards}/${decisionId}/files/${slot}`, { headers: { ...asClient, ...headers } });
    const key = fromBase64url(p.privateKey) ?? new Uint8Array();
    for (const [name, decisionId] of asked) for (const [index, a] of (inbox.open.find(d => d.decisionId === decisionId)?.attachments ?? []).entries()) {
      const r = await file(decisionId, String(index));
      assert.equal(r.status, 200, `${name}/${a.name}`);
      const bytes = Buffer.from(open(key, 'attachment', { pagerId: p.pagerId, decisionId, index }, await r.text()));
      assert.ok(bytes.equals(fileBytes(name, a.name)), `${name}/${a.name} reads back byte for byte`);
      assert.equal(bytes.length, a.bytes);
    }
    const d2 = asked.get('D2-checkout') ?? '';
    assert.equal((await file(d2, '7')).status, 404);
    assert.equal((await file(d2, '0', { 'x-phone-key': token() })).status, 401);
    assert.equal((await file(d2, '0', { authorization: `Bearer ${s.agentKey}` })).status, 401);
    for (const slot of ['..%2Fpager', 'design.md', '8', '01', '-1', '1e0']) assert.equal((await file(d2, slot)).status, 400, slot);

    // Answers are by number: 3 is C.
    const receipt = await f.answer(agentId, phone, d2, { kind: 'option', number: 3 });
    const read = await f.read(s, d2);
    assert.equal(read.status, 'answered');
    if (read.status === 'answered') assert.deepEqual(read.answer.choice, { kind: 'option', number: 3 });
    await f.ack(s, d2, receipt.answerId, 'Holding timed-out orders and emailing when they settle.');

    // Deleting the pager takes the attachments with it.
    await f.request(`/api/pagers/${p.pagerId}/delete`, { method: 'POST', phone });
    assert.equal((await file(d2, '0')).status, 404);
    await f.stop();
    const stores = agentDatabases(f.persist);
    assert.ok(stores.length > 0, 'the agent object has an attachments table');
    for (const db of stores) { assert.equal(count(db), 0, 'no attachment parts after the delete'); db.close(); }
  } finally { await f.stop(); }
});

// The cases a brief is refused for. The service can't read a card, so it can't refuse one: the command refuses each
// before it leaves the machine (I22), and when an agent calls the service directly with one, the phone refuses it
// whole when it reads it (I4.9), as the phone's mirror of the same check does (packages/ios/AgentPagerCrypto, pinned
// to the same vectors).
test('I4.9 A broken card is refused by the command before it is sent, and by the phone when one is sent around the command', { timeout: 120_000 }, async () => {
  const f = await fixture('briefs-refused');
  try {
    const p = await f.makePager();
    const base: Record<string, unknown> = { ...loadBrief('D4-branches') };
    const baseCard: Record<string, unknown> = typeof base.card === 'object' && base.card !== null ? { ...base.card } : {};
    const card = (patch: Record<string, unknown>) => ({ ...base, card: { ...baseCard, ...patch } });
    const markdown = String((typeof base.card === 'object' && base.card !== null && 'markdown' in base.card) ? base.card.markdown : '');
    const png = Buffer.from(fileBytes('D1-pricing', 'a-cards.png')).toString('base64');
    // What the card part holds: the question, the brief and the attachments' names.
    const cases: [string, Record<string, unknown>, RegExp][] = [
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
      ['a brief with no Options section', card({ markdown: markdown.replace('## Options\n', '') }), /needs an "## Options" section/],
      ['an image naming a page', { ...base, card: { ...baseCard, markdown: markdown + '\n![Mock](notes.md)\n' }, attachments: [{ name: 'notes.md', type: 'text/markdown', text: '# Notes' }] }, /names a page, not an image/],
      ['an image named for another type', { ...base, card: { ...baseCard, markdown: markdown + '\n![Mock](a.jpg)\n' }, attachments: [{ name: 'a.jpg', type: 'image/png', base64: png }] }, /must end in \.png/],
      ['an emoji card', { ...emojiCard, requestId: undefined }, /card\.type: Expected "brief"/],
      ['an option with an emoji', card({ options: [{ number: 1, title: 'One', prioritizes: 'speed', emoji: '🚀' }, { number: 2, title: 'Two', prioritizes: 'safety' }] }), /emoji.*is unexpected/],
      ['a title over 100 characters', { ...base, title: 'x'.repeat(101) }, /title: a title may not exceed 100 characters/],
      ['a detail over 280 characters', { ...base, detail: 'x'.repeat(281) }, /detail: text may not exceed 280 characters/],
      ['an unknown field', { ...base, card: { ...baseCard, extra: 'dropped?' } }, /extra|is unexpected/],
    ];
    // In the words the command refuses it with: each field and what is wrong with it.
    const problems = (input: unknown) => {
      const r = Schema.decodeUnknownEither(C.QuestionInput, { onExcessProperty: 'error' })(input);
      return Either.isLeft(r) ? ParseResult.ArrayFormatter.formatErrorSync(r.left).map(i => `${i.path.map(String).join('.')}: ${i.message}`).join('; ') : '';
    };
    for (const [label, input, reason] of cases) {
      // A new agent each time, so the open decisions stay under their limit.
      const s = await f.connect(p.number, 'Claude Code', 'shop'), cards = `/api/agents/${s.agent.agentId}/cards`;
      const decision = (requestId: string) => C.decisionIdOf(s.agent.agentId, requestId);
      const { requestId: _, ...question } = input;
      // The command refuses it, with the reason.
      assert.match(problems(question), reason, `the command: ${label}`);
      // Sent around the command, sealed as a card part, the service takes it: it can't read it.
      const requestId = token(), decisionId = await decision(requestId);
      const { attachments, ...rest } = question;
      const listed = Array.isArray(attachments) ? attachments.map(x => ({ name: x?.name, type: x?.type })) : [];
      const part = { ...rest, ...(listed.length ? { attachments: listed } : {}), answerKey: publicOf(s.keys.privateKey) };
      const at = { pagerId: p.pagerId, decisionId }, to = fromBase64url(s.keys.pagerKey) ?? new Uint8Array();
      const sealed = seal(to, 'card', at, new TextEncoder().encode(JSON.stringify(part)));
      const preview = seal(to, 'decisionPreview', at, encodePart('decisionPreview', { title: 'Broken?', app: 'Claude Code', project: 'shop' }));
      const extra = listed.map((_, index) => seal(to, 'attachment', { ...at, index }, new TextEncoder().encode('x')));
      await f.ok(C.Asked, cards, { agent: s.agentKey, data: { requestId, digest: 'd'.repeat(43), card: sealed, preview, ...(extra.length ? { attachments: extra } : {}) } });
      // The phone opens it and refuses it whole: none of it is read.
      const wire = (await f.ok(C.PagerInbox, `/api/pagers/${p.pagerId}`, { phone: p.phone })).agents.flatMap(x => x.open).find(d => d.decisionId === decisionId);
      assert.ok(wire, label);
      assert.throws(() => openDecision(p.pagerId, wire), /invalid/, `the phone: ${label}`);
      assert.throws(() => decodePart('card', open(fromBase64url(p.privateKey) ?? new Uint8Array(), 'card', at, wire.card)), /PartInvalid|invalid/, label);
    }
    // What the command takes, the phone reads.
    assert.equal(problems(base), '');
  } finally { await f.stop(); }
});

// Every file of the local store, and its SQLite databases.
const storeFiles = (persist: string) => {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const q = path.join(dir, name); if (statSync(q).isDirectory()) walk(q); else files.push(q); } };
  walk(persist);
  return files;
};
const registryOf = (persist: string) => opened(storeFiles(path.join(persist, 'v3', 'do')).filter(q => q.endsWith('.sqlite')), "SELECT 1 FROM sqlite_master WHERE name='pagers_v2'")[0];
const holds = (file: string, marker: string) => [file, file + '-wal', file + '-shm'].some(q => { try { return readFileSync(q).includes(Buffer.from(marker)); } catch { return false; } });

// The release's exception (blueprint/milestones/M5-encrypt.md, Sam's answer 3): at the first start of this code, every
// agent stored before the switch is forgotten, with its decisions, attachments, answers, acknowledgements and digests,
// and no pager lists it; every pager keeps its key, number, switch, auto-off and push target, and what was stored
// since is untouched. Before the switch an agent's object had readable tables (agent, proposals, …) and the Registry
// listed it in pager_agents_v2: this puts two such agents back as the m4 code stored them, then starts this code on
// them, twice. One is called again; the other never is, so only the Registry's start reaches it.
test('the switch forgets every agent stored before it, keeps every pager, and leaves what came after alone', { timeout: 180_000 }, async () => {
  const f = await fixture('switch');
  try {
    const { p, a: before } = await f.connected('Codex', 'before the switch');
    const quiet = await f.connect(p.number, 'pi', 'before the switch, quiet');
    const old = await f.ask(before, 'Asked before the switch?');
    await f.answer(before.agent.agentId, p.phone, old.decisionId);
    const pushed = await f.request(`/api/pagers/${p.pagerId}/push`, { phone: p.phone, data: { token: 'ab'.repeat(32), environment: 'sandbox' } });
    assert.equal(pushed.status, 200);
    await f.settings(p.pagerId, p.phone, { autoOff: '30d' });
    const after = await f.connect(p.number, 'Claude Code', 'after the switch');
    const kept = await f.ask(after, 'Asked after the switch?');
    const keptReceipt = await f.answer(after.agent.agentId, p.phone, kept.decisionId);
    await f.ack(after, kept.decisionId, keptReceipt.answerId, 'Kept.');
    const seenBefore = await f.pager(p.pagerId, p.phone);
    const afterBefore = seenBefore.agents.find(x => x.agent.agentId === after.agent.agentId);
    await f.stop();

    // Both agents' objects back as the m4 code stored them: readable who asked, question, answer and attachment.
    const objects = new Map<string, string>();
    for (const [a, marker] of [[before, 'before'], [quiet, 'quiet']] as const) {
      const file = storeFiles(path.join(f.persist, 'v3', 'do')).filter(q => q.endsWith('.sqlite')).find(q => {
        const db = new DatabaseSync(q);
        try { return String(db.prepare("SELECT json FROM sqlite_master m, agent_v3 WHERE m.name='agent_v3'").get()?.json ?? '').includes(a.agent.agentId); } catch { return false; } finally { db.close(); }
      });
      assert.ok(file, `the ${marker} agent's object`);
      objects.set(marker, file);
      const db = new DatabaseSync(file);
      db.exec(`PRAGMA foreign_keys = OFF; DROP TABLE agent_v3; DROP TABLE warnings_v3; DROP TABLE collections_v3; DROP TABLE pickups_v3;
        DROP TABLE acknowledgements_v3; DROP TABLE answers_v3; DROP TABLE attachments_v3; DROP TABLE decisions_v3;
        CREATE TABLE agent (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
        CREATE TABLE proposals (id TEXT PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE answers (decision_id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, input TEXT NOT NULL, json TEXT NOT NULL);
        CREATE TABLE attachments (decision_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (decision_id, name));
        CREATE TABLE asks (decision_id TEXT PRIMARY KEY, question TEXT NOT NULL);`);
      db.prepare('INSERT INTO agent VALUES (1, ?)').run(JSON.stringify({ agentId: a.agent.agentId, pagerId: p.pagerId, app: `Codex-${marker}-the-switch`, project: 'before the switch' }));
      db.prepare('INSERT INTO proposals VALUES (?, ?)').run(old.decisionId, JSON.stringify({ decisionId: old.decisionId, title: `Asked ${marker} the switch, readable` }));
      db.prepare('INSERT INTO answers VALUES (?, ?, ?, ?)').run(old.decisionId, token(), `A note ${marker} the switch`, JSON.stringify({ choice: { kind: 'feedback', text: `A note ${marker} the switch` } }));
      db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?)').run(old.decisionId, 'notes.md', 'text/markdown', Buffer.from(`A page ${marker} the switch`));
      db.close();
    }
    const markers = (marker: string) => [`Codex-${marker}-the-switch`, `Asked ${marker} the switch, readable`, `A note ${marker} the switch`, `A page ${marker} the switch`];
    // The Registry back as it listed agents before the switch.
    const registry = registryOf(f.persist);
    assert.ok(registry);
    registry.exec('CREATE TABLE pager_agents_v2 (pager_id TEXT NOT NULL, agent_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (pager_id, agent_id));');
    for (const a of [before, quiet]) {
      registry.prepare('INSERT INTO pager_agents_v2 VALUES (?, ?, ?)').run(p.pagerId, a.agent.agentId, Date.now());
      registry.prepare('DELETE FROM pager_agents_v3 WHERE agent_id=?').run(a.agent.agentId);
    }
    const pagerRow = registry.prepare('SELECT * FROM pagers_v2 WHERE pager_id=?').get(p.pagerId);
    registry.close();
    for (const marker of ['before', 'quiet']) assert.ok(markers(marker).every(m => holds(objects.get(marker) ?? '', m)), 'readable before the switch');

    for (const round of [1, 2]) {
      await f.restart();
      const seen = await f.pager(p.pagerId, p.phone);
      // The pager is as it was: on, its auto-off, its key, and its number still connects.
      assert.deepEqual(seen.pager, seenBefore.pager, `round ${round}: the pager as it was`);
      assert.equal((await f.ok(C.PagerKey, `/api/pagers/${p.pagerId}/key`)).publicKey, p.publicKey);
      // The agents from before the switch are gone with everything they had; the one since is as it was.
      assert.deepEqual(seen.agents.map(x => x.agent.agentId), [after.agent.agentId], `round ${round}: only the agent since the switch`);
      assert.deepEqual(seen.agents[0], afterBefore, `round ${round}: untouched`);
      await f.refused(404, 'UnknownAgent', `/api/agents/${before.agent.agentId}`, { agent: before.agentKey });
      await f.refused(404, 'UnknownAgent', `/api/agents/${before.agent.agentId}/cards/${old.decisionId}/files/0`, { phone: p.phone });
      // The quiet one is reached by the Registry's start alone: its object holds nothing readable soon after.
      await until(async () => markers('quiet').some(m => holds(objects.get('quiet') ?? '', m)), held => !held, 20_000);
      await f.stop();
      for (const file of storeFiles(f.persist)) for (const m of [...markers('before'), ...markers('quiet')]) assert.ok(!readFileSync(file).includes(Buffer.from(m)), `${m} in ${path.relative(f.persist, file)}`);
      const reg = registryOf(f.persist);
      assert.ok(reg);
      assert.equal(reg.prepare("SELECT 1 FROM sqlite_master WHERE name='pager_agents_v2'").get(), undefined, 'the old list is gone');
      assert.deepEqual(reg.prepare('SELECT * FROM pagers_v2 WHERE pager_id=?').get(p.pagerId), pagerRow, 'the pager row is unchanged');
      assert.equal(Number(reg.prepare('SELECT count(*) AS n FROM erase_v2').get()?.n), 0, 'nothing left to forget');
      reg.close();
    }
    await f.restart();
    // A new agent connects with the number as before.
    const again = await f.connect(p.number, 'Codex', 'after the switch, again');
    assert.equal((await f.pager(p.pagerId, p.phone)).agents.length, 2);
    await f.ask(again, 'Still answerable?');
  } finally { await f.stop(); }
});
