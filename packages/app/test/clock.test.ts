import { test } from 'node:test';
import { Schema } from 'effect';
import { fixture, assert, pause } from './support.ts';

// An agent's 30-day clock runs only while its pager is on (I17.6, blueprint/areas/1-pagers.md): turning the pager off,
// by the switch or by auto-off, pauses it, and turning it on resumes it where it was. Each test sets a short clock and
// crosses it in real time. An agent's status is no activity, so asking it every 100 ms finds when the agent is forgotten
// without moving the time: the agent was still there when the last status before the refusal was asked.

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Agent = Awaited<ReturnType<Fixture['connect']>>;
const ErrorTag = Schema.Struct({ error: Schema.String });
const tagOf = (value: unknown) => Schema.is(ErrorTag)(value) ? value.error : undefined;
const pauseUntil = (at: number) => pause(Math.max(0, at - Date.now()));
const status = (f: Fixture, a: Agent) => f.request(`/api/agents/${a.agent.agentId}`, { agent: a.agentKey });
// When the agent was last known (as a status was asked) and when it was refused as unknown, asking every 100 ms until `limit`.
async function forgotten(f: Fixture, a: Agent, limit: number) {
  let known = 0;
  while (Date.now() < limit) {
    const at = Date.now(), r = await status(f, a);
    if (r.status === 404 && tagOf(r.value) === 'UnknownAgent') return { known, refused: Date.now() };
    assert.equal(r.status, 200, JSON.stringify(r.value));
    known = at;
    await pause(100);
  }
  throw new Error(`${a.agent.project} was still known at the end`);
}
// Forgotten no sooner than `from` and no later than `to`, the earliest and latest its clock can run out as the server
// saw the turn-ons, which the test only knows to within a call.
function between(when: { known: number; refused: number }, from: number, to: number, what: string) {
  assert.ok(when.known >= from - 500, `${what}: last known ${from - when.known} ms before its clock could run out, so forgotten early`);
  assert.ok(when.refused <= to + 1_500, `${what}: refused ${when.refused - to} ms after its clock ran out`);
}

test('I17.6 Turning a pager off pauses its agents\' clocks however long it stays off, and turning it on resumes them; activity starts one again, and last activity stays as it was', { timeout: 180_000 }, async () => {
  const IDLE = 8_000, f = await fixture('clock-switch', { autoOffMs: 0, idleMs: IDLE });
  try {
    const p = await f.makePager();
    const paused = await f.connect(p.number, 'Codex', 'paused twice'), again = await f.connect(p.number, 'Codex', 'active again');
    await f.ask(paused, 'Kept while the pager is off?');
    await f.ask(again, 'Asked again after the pager is on?');
    const agentOf = async (a: Agent) => (await f.pager(p.pagerId, p.phone)).agents.find(x => x.agent.agentId === a.agent.agentId)?.agent;
    const lastActive = (await agentOf(paused))?.lastActivityAt ?? '', last = Date.parse(lastActive);
    // Off 2 s after its last activity, and kept off longer than its whole clock.
    await pauseUntil(last + 2_000);
    const off1 = Date.parse((await f.settings(p.pagerId, p.phone, { on: false })).pager.offSince ?? '');
    await pauseUntil(last + IDLE + 3_000);
    const whileOff = await f.pager(p.pagerId, p.phone);
    assert.equal(whileOff.pager.on, false);
    assert.deepEqual(whileOff.agents.map(x => x.agent.agentId), [paused.agent.agentId, again.agent.agentId], 'every agent kept while the pager is off');
    const known = await status(f, paused);
    assert.equal(known.status, 200, 'still known while off');
    // On again: 2 s of its clock used, 6 s left. The other agent asks again, so its clock starts again from then.
    const on1 = Date.now();
    await f.settings(p.pagerId, p.phone, { on: true });
    const on1Done = Date.now();
    await pause(1_000);
    await f.ask(again, 'Asked again once on?');
    const againLast = Date.parse((await agentOf(again))?.lastActivityAt ?? '');
    // Off a second time, 3 s.
    await pauseUntil(on1Done + 2_000);
    const off2 = Date.parse((await f.settings(p.pagerId, p.phone, { on: false })).pager.offSince ?? '');
    await pause(3_000);
    const on2 = Date.now();
    await f.settings(p.pagerId, p.phone, { on: true });
    const on2Done = Date.now();
    assert.equal((await agentOf(paused))?.lastActivityAt, lastActive, 'turning off and on leaves last activity as it was');

    // Each is forgotten once its pager has been on for its whole clock since its last activity: the paused agent after
    // both stretches off, the other after the second only.
    const [p1, a1] = await Promise.all([forgotten(f, paused, on2Done + 20_000), forgotten(f, again, on2Done + 20_000)]);
    between(p1, last + IDLE + (on1 - off1) + (on2 - off2), last + IDLE + (on1Done - off1) + (on2Done - off2), 'paused twice');
    between(a1, againLast + IDLE + (on2 - off2), againLast + IDLE + (on2Done - off2), 'active again');
    assert.deepEqual((await f.pager(p.pagerId, p.phone)).agents, [], 'and its pager stops listing them');
    await f.artifact('switch.json', { paused: { afterOn: p1.refused - on2Done }, again: { afterOn: a1.refused - on2Done } });
  } finally { await f.stop(); }
});

test('I17.6 Auto-off pauses the clock from the time it was due, however late it lands; an agent whose clock ran out before it is forgotten while the pager is on', { timeout: 180_000 }, async () => {
  const IDLE = 8_000, f = await fixture('clock-auto-off', { autoOffMs: 12_000, idleMs: IDLE });
  try {
    const p = await f.makePager('24h'), due = Date.parse(p.pager.offAt ?? '');
    const lastOf = async (a: Agent) => Date.parse((await f.pager(p.pagerId, p.phone)).agents.find(x => x.agent.agentId === a.agent.agentId)?.agent.lastActivityAt ?? '');
    // One agent whose clock runs out 3 s or more before the auto-off, and one whose clock would run out 3 s after it.
    const early = await f.connect(p.number, 'Codex', 'forgotten before the auto-off');
    await f.ask(early, 'Forgotten while on?');
    const earlyLast = await lastOf(early);
    assert.ok(earlyLast + IDLE < due - 2_000, 'the first agent\'s clock runs out well before the auto-off');
    await pauseUntil(due - 5_000);
    const late = await f.connect(p.number, 'Codex', 'paused by the auto-off');
    await f.ask(late, 'Paused by the auto-off?');
    const lateLast = await lastOf(late);
    // Nothing calls the pager until well after both: the auto-off lands only when the pager's own clock next looks,
    // at the late agent's old time, but counts from when it was due.
    await pauseUntil(lateLast + IDLE + 3_000);
    const seen = await f.pager(p.pagerId, p.phone);
    assert.deepEqual([seen.pager.on, seen.pager.offSince], [false, p.pager.offAt], 'off since it was due');
    assert.deepEqual(seen.agents.map(x => x.agent.agentId), [late.agent.agentId], 'the first forgotten while on; the other kept while off');
    // On again, never to turn off by itself: the late agent's clock resumes with what was left at the auto-off.
    const on = Date.now();
    await f.settings(p.pagerId, p.phone, { on: true, autoOff: 'never' });
    const onDone = Date.now();
    const when = await forgotten(f, late, onDone + 20_000);
    between(when, lateLast + IDLE + (on - due), lateLast + IDLE + (onDone - due), 'paused by the auto-off');
    await f.artifact('auto-off.json', { leftAtTheAutoOff: lateLast + IDLE - due, afterOn: when.refused - onDone });
  } finally { await f.stop(); }
});

test('I17.6 Turned off and on many times, by the switch and by auto-off, as its forget alarm comes and goes, an agent is forgotten once its pager has been on for its whole clock, never sooner', { timeout: 180_000 }, async () => {
  const IDLE = 4_000, f = await fixture('clock-toggles', { autoOffMs: 1_500, idleMs: IDLE });
  try {
    // Each stretch off is 300 ms. The switch's pager is on 300 ms between them; the auto-off's, 1.5 s.
    async function run(by: 'switch' | 'auto-off') {
      const p = await f.makePager(by === 'switch' ? 'never' : '24h');
      const a = await f.connect(p.number, 'Codex', by);
      await f.ask(a, `Kept through every ${by}?`);
      const last = Date.parse((await f.pager(p.pagerId, p.phone)).agents[0]?.agent.lastActivityAt ?? '');
      // Each stretch off: from when it turned off, and when the turn-on was asked and answered.
      const stretches: { since: number; on: number; onDone: number }[] = [];
      let offAt = Date.parse(p.pager.offAt ?? ''), known = 0;
      for (;;) {
        // While on: its status every 100 ms.
        const until = by === 'switch' ? Date.now() + 300 : offAt;
        let refused = 0;
        while (!refused && Date.now() < until) {
          const at = Date.now(), r = await status(f, a);
          if (r.status === 404 && tagOf(r.value) === 'UnknownAgent') refused = Date.now();
          else { assert.equal(r.status, 200, JSON.stringify(r.value)); known = at; await pause(100); }
        }
        // The agent was there when it was last known, so every stretch turned on before then came before it was
        // forgotten; one after may have come before or after.
        if (refused) {
          const before = stretches.filter(x => x.onDone <= known);
          return { by, stretches: stretches.length, when: { known, refused }, from: last + IDLE + before.reduce((n, x) => n + x.on - x.since, 0), to: last + IDLE + stretches.reduce((n, x) => n + x.onDone - x.since, 0) };
        }
        const since = by === 'switch' ? Date.parse((await f.settings(p.pagerId, p.phone, { on: false })).pager.offSince ?? '') : offAt;
        await pauseUntil(since + 300);
        const on = Date.now(), turned = await f.settings(p.pagerId, p.phone, { on: true });
        stretches.push({ since, on, onDone: Date.now() });
        offAt = Date.parse(turned.pager.offAt ?? '');
        assert.ok(stretches.length < 60, `${by}: still known after ${stretches.length} stretches off`);
      }
    }
    const runs = await Promise.all([run('switch'), run('auto-off')]);
    for (const r of runs) {
      assert.ok(r.stretches >= 2, `${r.by}: ${r.stretches} stretches off`);
      between(r.when, r.from, r.to, r.by);
    }
    await f.artifact('toggles.json', runs.map(r => ({ by: r.by, stretches: r.stretches, offMs: r.to - r.from, afterItsTime: r.when.refused - r.to })));
  } finally { await f.stop(); }
});
