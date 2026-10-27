import { test } from 'node:test';
import { assert, pause } from './support.ts';
import { read } from '../src/shared.ts';

// A stand-in pager object: each call gets the next reply in turn, and it keeps the paths it was asked.
function object(replies: Array<() => Response | Promise<Response>>) {
  const asked: string[] = [];
  return { asked, call: async (path: string) => { asked.push(path); return replies[asked.length - 1](); } };
}
// What Cloudflare throws to the caller when an object restarts.
const reset = () => { throw Object.assign(new Error('Durable Object reset because its code was updated.'), { retryable: true }); };
const internal = () => Response.json({ error: 'InternalError', message: 'Something went wrong on the server. Try again.' }, { status: 500 });
const pending = () => Response.json({ status: 'pending' });
async function timed<A>(run: () => Promise<A>) { const start = Date.now(); const value = await run(); return { value, ms: Date.now() - start }; }

test('a read the pager object drops is sent again', async () => {
  const o = object([reset, pending]);
  const response = await read('/read/d1', o.call);
  assert.deepEqual([response.status, await response.json()], [200, { status: 'pending' }]);
  assert.deepEqual(o.asked, ['/read/d1', '/read/d1']);
});

test('a 500 is read again; a refusal is not', async () => {
  const again = object([internal, pending]);
  assert.equal((await read('/inbox', again.call)).status, 200);
  assert.equal(again.asked.length, 2);
  const refused = object([() => Response.json({ error: 'Unauthorized' }, { status: 401 })]);
  assert.equal((await read('/inbox', refused.call)).status, 401);
  assert.equal(refused.asked.length, 1);
});

test('an answer wait read again still answers within its wait', async () => {
  const left = object([reset, pending]);
  await read('/read/d1?wait=5', left.call);
  assert.deepEqual(left.asked, ['/read/d1?wait=5', '/read/d1?wait=3'], 'it pauses 1 s, then holds the whole seconds left');
  // It fails 500 ms into a 1 s wait: it pauses only for the 500 ms left, then reads at once.
  const late = object([async () => { await pause(500); return reset(); }, pending]);
  const a = await timed(() => read('/read/d1?wait=1', late.call));
  assert.deepEqual(late.asked, ['/read/d1?wait=1', '/read/d1']);
  assert.ok(a.ms < 1300, `answered after ${a.ms} ms`);
  // It fails at the end of its wait: no pause at all.
  const end = object([async () => { await pause(1000); return reset(); }, internal, pending]);
  const b = await timed(() => read('/read/d1?wait=1', end.call));
  assert.deepEqual(end.asked, ['/read/d1?wait=1', '/read/d1', '/read/d1']);
  assert.ok(b.ms < 1300, `answered after ${b.ms} ms`);
});

test('three tries at most; an error not marked retryable, or an overloaded object, is not asked again', async () => {
  const failing = object([internal, internal, internal, pending]);
  assert.equal((await read('/status', failing.call)).status, 500);
  assert.equal(failing.asked.length, 3);
  const gone = object([reset, reset, reset, pending]);
  await assert.rejects(read('/status', gone.call), /reset/);
  assert.equal(gone.asked.length, 3);
  const broken = object([() => { throw new Error('Something else failed.'); }, pending]);
  await assert.rejects(read('/status', broken.call), /Something else/);
  assert.equal(broken.asked.length, 1);
  const busy = object([() => { throw Object.assign(new Error('Durable Object is overloaded.'), { retryable: true, overloaded: true }); }, pending]);
  await assert.rejects(read('/status', busy.call), /overloaded/);
  assert.equal(busy.asked.length, 1);
});
