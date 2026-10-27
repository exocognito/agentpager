import { test } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fixture, assert } from './support.ts';
import { questionBody } from '../src/push.ts';
import type { Card } from '../../blueprint/design/schemas/exchange.ts';

// Agents can no longer ask emoji cards, but one asked before that stays readable, answerable and acknowledged
// until its pager ends.
const legacy: Card = { type: 'generic', recommended: 2, options: [{ number: 1, emoji: '🚀', title: 'First plan', detail: 'First complete detail' }, { number: 2, emoji: '🛠️', title: 'Second plan' }] };

// The pagers' stored databases, read and changed while the server is stopped.
function pagerDatabases(persist: string) {
  const files: string[] = [];
  const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.sqlite')) files.push(p); } };
  walk(path.join(persist, 'v3', 'do'));
  return files.map(file => new DatabaseSync(file)).filter(db => db.prepare("SELECT 1 FROM sqlite_master WHERE name='proposals'").get());
}

test('emoji cards asked before they were refused stay readable, answerable and acknowledged', { timeout: 180_000 }, async () => {
  const f = await fixture('legacy-emoji-cards');
  try {
    const { s, phone } = await f.paired('Claude Code · legacy');
    const asked = await f.ask(s, 'Ship it?');

    // As if asked before the refusal: the stored proposal (immutable, so replaced) holds an emoji card, and the
    // server restarts on it.
    await f.stop();
    const [db] = pagerDatabases(f.persist);
    const stored = JSON.parse(String(db.prepare('SELECT json FROM proposals WHERE id=?').get(asked.decisionId)?.json));
    db.prepare('DELETE FROM proposals WHERE id=?').run(asked.decisionId);
    db.prepare('INSERT INTO proposals VALUES (?, ?)').run(asked.decisionId, JSON.stringify({ ...stored, card: legacy }));
    db.close();
    await f.restart();

    const open = (await f.inbox(s.session.sessionId, phone)).open.find(d => d.decisionId === asked.decisionId);
    assert.deepEqual(open?.card, legacy, 'the phone reads the emoji card as asked');
    const receipt = await f.answer(s.session.sessionId, phone, asked.decisionId, { kind: 'option', number: 2 });
    const read = await f.read(s, asked.decisionId);
    if (read.status !== 'answered') throw new Error('the answer did not reach the agent');
    assert.deepEqual([read.answer.answerId, read.answer.choice], [receipt.answerId, { kind: 'option', number: 2 }]);
    const ack = await f.ack(s, asked.decisionId, receipt.answerId, 'Shipping the second plan.');
    const answered = (await f.inbox(s.session.sessionId, phone)).answered.find(d => d.decisionId === asked.decisionId);
    assert.equal(answered?.acknowledgement?.acknowledgedAt, ack.acknowledgedAt);
    // Its alert names the recommended option by its emoji.
    assert.equal(questionBody({ title: 'Ship it?', card: legacy }), 'Ship it?\nRecommended: 🛠️ Second plan');
  } finally { await f.stop(); }
});
