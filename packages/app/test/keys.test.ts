import { test } from 'node:test';
import { fixture, token } from './support.ts';

// I4: a wrong key is refused as unauthorized even when the input is also invalid. Each call below is sent with
// invalid input twice: with a wrong key it is Unauthorized, and with the right key the same input is InvalidInput.
test('a wrong key wins over invalid input', { timeout: 180_000 }, async () => {
  const f = await fixture('keys');
  try {
    const { p, a } = await f.connected('Claude Code', 'keys');
    const aid = a.agent.agentId, asked = await f.ask(a, 'Ship it?'), did = asked.decisionId;
    const agentCalls: Array<[string, string, { method?: string; data?: unknown }]> = [
      ['ask a blank title', `/api/agents/${aid}/cards`, { data: { title: '', card: { type: 'brief' } } }],
      ['ask with an unknown field', `/api/agents/${aid}/cards`, { data: { title: 'Ok?', bogus: 1 } }],
      ['read with a bad wait', `/api/agents/${aid}/cards/${did}/answer?wait=forever`, { method: 'GET' }],
      ['acknowledge without an answer id', `/api/agents/${aid}/cards/${did}/acknowledge`, { data: { nextSteps: 'Go.' } }],
      ['say it received an answer without its id', `/api/agents/${aid}/cards/${did}/received`, { data: {} }],
      ['say it received an answer of a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/received`, { data: { answerId: did } }],
      ['finish with a field', `/api/agents/${aid}/finish`, { data: { now: true } }],
      ['read a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/answer`, { method: 'GET' }],
      ['acknowledge a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/acknowledge`, { data: { answerId: did, nextSteps: 'Go.' } }],
    ];
    for (const [label, route, opts] of agentCalls) {
      await f.refused(401, 'Unauthorized', route, { ...opts, agent: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { ...opts, agent: a.agentKey }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    const phoneCalls: Array<[string, string, unknown]> = [
      ['answer with no choice', `/api/agents/${aid}/cards/${did}/answer`, { requestId: token() }],
      ['an unknown auto-off', `/api/pagers/${p.pagerId}/settings`, { autoOff: 'forever' }],
      ['a malformed device token', `/api/pagers/${p.pagerId}/push`, { token: 1 }],
      ['delete with a field', `/api/pagers/${p.pagerId}/delete`, { now: true }],
      ['answer a malformed decision id', `/api/agents/${aid}/cards/not-a-decision/answer`, { requestId: token(), choice: { kind: 'option', number: 1 } }],
    ];
    for (const [label, route, data] of phoneCalls) {
      await f.refused(401, 'Unauthorized', route, { data, phone: token() }).catch(e => { throw new Error(`${label}: ${e}`); });
      await f.refused(400, 'InvalidInput', route, { data, phone: p.phone }).catch(e => { throw new Error(`${label}, right key: ${e}`); });
    }
    // A malformed attachment name or decision id is refused only to the pager's own phone key.
    for (const route of [`/api/agents/${aid}/cards/${did}/files/..%2Fpager`, `/api/agents/${aid}/cards/not-a-decision/files/a.png`]) {
      await f.refused(401, 'Unauthorized', route, { phone: token() });
      await f.refused(400, 'InvalidInput', route, { phone: p.phone });
    }
    // A phone makes a pager only with a key.
    await f.refused(401, 'Unauthorized', '/api/pagers', { data: { autoOff: 'forever' } });
    await f.refused(400, 'InvalidInput', '/api/pagers', { data: { autoOff: 'forever' }, phone: token() });

  } finally { await f.stop(); }
});
