import { test } from 'node:test';
import { assert } from './support.ts';
import { Waits, type Clock, type Look } from '../src/wake.ts';

// A clock the test moves, which counts the timers still set: a wait that ends must leave none.
function clock() {
  let now = 0;
  const timers = new Set<{ at: number; run: () => void }>();
  const c: Clock = { now: () => now, after: (ms, run) => { const t = { at: now + ms, run }; timers.add(t); return () => { timers.delete(t); }; } };
  return {
    c, timers: () => timers.size, now: () => now,
    // Moves time on by ms, running each timer that comes due, in order, and what each one's run starts.
    async tick(ms: number) {
      const to = now + ms;
      for (;;) {
        const next = [...timers].sort((x, y) => x.at - y.at)[0];
        if (!next || next.at > to) break;
        timers.delete(next); now = next.at; next.run(); await settle();
      }
      now = to; await settle();
    },
  };
}
const settle = () => new Promise(r => setImmediate(r));
// A look that counts how often it ran, and finds what `found` holds once it holds something.
function looks<A>(lookBy: () => number | null = () => null) {
  const l = { count: 0, found: undefined as A | undefined, throws: undefined as Error | undefined, look: (): Look<A> => {
    l.count++;
    if (l.throws) throw l.throws;
    return l.found === undefined ? { lookBy: lookBy() } : { found: l.found };
  } };
  return l;
}
const on = (agentId: string, decisionId: string) => ({ agentId, decisionId });

test('a held wait looks only as it starts, at each wake that reaches it and at its times, and leaves no timer or entry behind', async () => {
  const t = clock(), waits = new Waits(t.c);
  // Nothing comes: it looks as it starts, then at its time, and gives null.
  const quiet = looks<string>(), q = waits.hold(on('a', 'd1'), 2_000, quiet.look);
  assert.deepEqual([quiet.count, waits.size, t.timers()], [1, 1, 1]);
  await t.tick(1_999);
  assert.equal(quiet.count, 1, 'no look between its start and its time');
  await t.tick(1);
  assert.equal(await q, null);
  assert.deepEqual([quiet.count, waits.size, t.timers()], [2, 0, 0]);

  // Already there: found at once, never held.
  const there = looks<string>(); there.found = 'answer';
  assert.equal(await waits.hold(on('a', 'd1'), t.now() + 2_000, there.look), 'answer');
  assert.deepEqual([there.count, waits.size, t.timers()], [1, 0, 0]);

  // A wake for another decision, another agent's same decision, or another agent doesn't reach it; one for its own
  // decision, its agent or every wait does, and it looks again. A look that finds nothing new sleeps again, with its
  // time unchanged.
  const w = looks<string>(), held = waits.hold(on('a', 'd1'), t.now() + 10_000, w.look), ends = t.now() + 10_000;
  waits.wake({ agentId: 'a', decisionId: 'd2' }); waits.wake({ agentId: 'b', decisionId: 'd1' }); waits.wake({ agentId: 'b' });
  await settle();
  assert.equal(w.count, 1, 'not reached');
  waits.wake({ agentId: 'a', decisionId: 'd1' }); await settle();
  waits.wake({ agentId: 'a' }); await settle();
  waits.wake('all'); await settle();
  assert.deepEqual([w.count, waits.size, t.timers()], [4, 1, 1], 'each wake that reached it looked once, and it sleeps again');
  await t.tick(3_000);
  w.found = 'answer';
  waits.wake({ agentId: 'a', decisionId: 'd1' });
  assert.equal(await held, 'answer');
  assert.deepEqual([w.count, waits.size, t.timers()], [5, 0, 0]);
  assert.ok(t.now() < ends);

  // The time its look names, such as its pager's auto-off, comes before its own: it looks then.
  let offAt: number | null = t.now() + 1_000;
  const timed = looks<string>(() => offAt), off = waits.hold(on('a', 'd1'), t.now() + 5_000, timed.look);
  await t.tick(999);
  assert.equal(timed.count, 1);
  // That time passes, and the look names none: it sleeps until its own time.
  offAt = null;
  await t.tick(1);
  assert.equal(timed.count, 2, 'it looked at the time its look named');
  // A wake while it sleeps; the look throws, as one does for a pager turned off: the wait ends with what it threw.
  timed.throws = new Error('turned off');
  waits.wake('all');
  await assert.rejects(off, /turned off/);
  assert.deepEqual([timed.count, waits.size, t.timers()], [3, 0, 0]);

  // A time the look names that has already passed, or comes after the wait's own, is no time to look: it looks once
  // at its own time, never in a loop.
  const late = looks<string>(() => t.now() - 1), past = waits.hold(on('a', 'd1'), t.now() + 1_000, late.look);
  const after = looks<string>(() => t.now() + 60_000), beyond = waits.hold(on('a', 'd2'), t.now() + 1_000, after.look);
  await t.tick(1_000);
  assert.deepEqual([await past, await beyond, late.count, after.count, waits.size, t.timers()], [null, null, 2, 2, 0, 0]);

  // A look that throws as it starts is never held.
  const refused = looks<string>(); refused.throws = new Error('unknown agent');
  await assert.rejects(waits.hold(on('a', 'd1'), t.now() + 1_000, refused.look), /unknown agent/);
  assert.deepEqual([waits.size, t.timers()], [0, 0]);
});

test('a wake reaches every wait it names: two on one decision, all of an agent\'s, every wait; many waits end with nothing held', async () => {
  const t = clock(), waits = new Waits(t.c);
  // Two waits on one decision: one wake, both find the answer.
  const first = looks<string>(), second = looks<string>();
  const both = [waits.hold(on('a', 'd1'), 10_000, first.look), waits.hold(on('a', 'd1'), 10_000, second.look)];
  const other = looks<string>(), elsewhere = waits.hold(on('a', 'd2'), 10_000, other.look);
  first.found = second.found = 'answer';
  waits.wake({ agentId: 'a', decisionId: 'd1' });
  assert.deepEqual(await Promise.all(both), ['answer', 'answer']);
  assert.deepEqual([first.count, second.count, other.count, waits.size, t.timers()], [2, 2, 1, 1, 1]);
  // An agent's wake reaches all of its decisions.
  other.found = 'closed';
  waits.wake({ agentId: 'a' });
  assert.equal(await elsewhere, 'closed');
  assert.deepEqual([waits.size, t.timers()], [0, 0]);

  // Many waits, on many agents' decisions: each wake for one decision reaches only its waits, and every wait ends,
  // by its answer, by a wake for all, or at its time, with nothing held after.
  const many = Array.from({ length: 600 }, (_, n) => ({ n, l: looks<number>() }));
  const holds = Promise.allSettled(many.map(({ n, l }) => waits.hold(on(`agent${n % 60}`, `d${n % 10}`), t.now() + 30_000, l.look)));
  assert.deepEqual([waits.size, t.timers()], [600, 600]);
  for (const m of many.slice(0, 10)) m.l.found = m.n;
  waits.wake({ agentId: 'agent0', decisionId: 'd0' });
  await settle();
  // agent0's d0 is held by n = 0, 60, 120 ...: only those looked, and only n = 0 had its answer.
  assert.deepEqual(many.filter(m => m.l.count > 1).map(m => m.n), [0, 60, 120, 180, 240, 300, 360, 420, 480, 540]);
  assert.equal(waits.size, 599);
  for (const m of many.slice(1, 10)) waits.wake({ agentId: `agent${m.n % 60}`, decisionId: `d${m.n % 10}` });
  await settle();
  assert.equal(waits.size, 590);
  // The pager turns off: every wait ends refused, at once.
  for (const m of many.slice(10, 300)) m.l.throws = new Error('off');
  waits.wake('all');
  await settle();
  assert.equal(waits.size, 300);
  await t.tick(30_000);
  const ended = await holds;
  assert.deepEqual(ended.slice(0, 10).map(e => e.status === 'fulfilled' && e.value), many.slice(0, 10).map(m => m.n));
  assert.ok(ended.slice(10, 300).every(e => e.status === 'rejected'));
  assert.ok(ended.slice(300).every(e => e.status === 'fulfilled' && e.value === null), 'the rest are pending at their time');
  assert.deepEqual([waits.size, t.timers()], [0, 0]);
});
