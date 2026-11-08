import { test } from 'node:test';
import { readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { Schema } from 'effect';
import { fixture, assert, C, decode } from './support.ts';

const Refused = Schema.Struct({ error: Schema.Literal('AlreadyAnswered'), message: Schema.String, receipt: C.Receipt });

// I5 with encrypted answers: the phone seals its answer once, at Send, and resends that same part with the same request
// id after a lost reply. Only that is the same request.
test('I5.1 I5.2 I5.3 The phone\'s resend of an answer, the same request and the same sealed part, gets the stored receipt; any other send is refused, and nothing stored changes', { timeout: 120_000 }, async () => {
  const f = await fixture('answers');
  try {
    const { p, a } = await f.connected('Codex', 'answers');
    const asked = await f.ask(a, 'Answered once?'), route = `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/answer`;
    const first = await f.sealedAnswer(a.agent.agentId, p.phone, asked.decisionId, { kind: 'option', number: 1 });
    const receipt = await f.ok(C.Receipt, route, { phone: p.phone, data: first });
    // Sent again, as the phone does after a lost reply: the same receipt.
    assert.deepEqual(await f.ok(C.Receipt, route, { phone: p.phone, data: first }), receipt);
    // The same option sealed again, the same request id with another part, or another option: refused, with the receipt.
    const again = await f.sealedAnswer(a.agent.agentId, p.phone, asked.decisionId, { kind: 'option', number: 1 });
    const other = await f.sealedAnswer(a.agent.agentId, p.phone, asked.decisionId, { kind: 'option', number: 2 });
    for (const data of [again, { requestId: first.requestId, answer: other.answer }, other]) {
      const r = await f.request(route, { phone: p.phone, data });
      assert.equal(r.status, 409, JSON.stringify(r.value));
      assert.deepEqual(decode(Refused, r.value).receipt, receipt);
    }
    // A request id already spent on another decision is refused too.
    const second = await f.ask(a, 'Another?');
    await f.refused(400, 'InvalidInput', `/api/agents/${a.agent.agentId}/cards/${second.decisionId}/answer`, { phone: p.phone, data: { ...(await f.sealedAnswer(a.agent.agentId, p.phone, second.decisionId)), requestId: first.requestId } });
    // The agent reads the first answer, as first sent; only the first acknowledgement counts.
    const read = await f.read(a, asked.decisionId);
    assert.deepEqual(read.status === 'answered' && [read.answer.answerId, read.answer.choice], [receipt.answerId, { kind: 'option', number: 1 }]);
    await f.ack(a, asked.decisionId, receipt.answerId, 'First.');
    await f.refused(409, 'AlreadyAcknowledged', `/api/agents/${a.agent.agentId}/cards/${asked.decisionId}/acknowledge`, { agent: a.agentKey, data: f.sealedAck(a, asked.decisionId, receipt.answerId, 'Second.') });
    const seen = (await f.pager(p.pagerId, p.phone)).agents[0].answered.find(d => d.decisionId === asked.decisionId);
    assert.deepEqual([seen?.answer?.choice, seen?.acknowledgement?.nextSteps], [{ kind: 'option', number: 1 }, 'First.']);
    await f.stop();
    // Below the service, the stored parts refuse to change.
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const q = path.join(dir, name); if (statSync(q).isDirectory()) walk(q); else if (q.endsWith('.sqlite')) files.push(q); } };
    walk(path.join(f.persist, 'v3', 'do'));
    let checked = 0;
    for (const file of files) {
      const db = new DatabaseSync(file);
      if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='answers_v4'").get()) {
        for (const [table, column] of [['decisions_v4', 'card'], ['answers_v4', 'part'], ['acknowledgements_v4', 'part']]) {
          assert.throws(() => db.prepare(`UPDATE ${table} SET ${column}='x'`).run(), /immutable/, table);
        }
        checked++;
      }
      db.close();
    }
    assert.ok(checked > 0);
  } finally { await f.stop(); }
});
