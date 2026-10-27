import { test } from 'node:test';
import { assert, pause } from './support.ts';
import { read } from '../src/shared.ts';

// A stand-in pager object: each call gets the next reply in turn, and it keeps the paths it was asked.
function object(replies: Array<() => Response | Promise<Response>>) {
  const asked: string[] = [];
  return { asked, call: async (path: string) => { asked.push(path); return replies[asked.length - 1](); } };
}
const reset = () => { throw new Error('Durable Object reset because its code was updated.'); };
const internal = () => Response.json({ error: 'InternalError', message: 'Something went wrong on the server. Try again.' }, { status: 500 });
const pending = () => Response.json({ status: 'pending' });

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

test('an answer wait read again holds only for the seconds it had left', async () => {
  const left = object([reset, pending]);
  await read('/read/d1?wait=5', left.call);
  assert.deepEqual(left.asked, ['/read/d1?wait=5', '/read/d1?wait=4']);
  const none = object([async () => { await pause(200); return reset(); }, pending]);
  await read('/read/d1?wait=1', none.call);
  assert.deepEqual(none.asked, ['/read/d1?wait=1', '/read/d1'], 'with no time left it reads at once');
});

test('three tries at most, and an overloaded object is not asked again', async () => {
  const failing = object([internal, internal, internal, pending]);
  assert.equal((await read('/status', failing.call)).status, 500);
  assert.equal(failing.asked.length, 3);
  const gone = object([reset, reset, reset, pending]);
  await assert.rejects(read('/status', gone.call), /reset/);
  assert.equal(gone.asked.length, 3);
  const busy = object([() => { throw Object.assign(new Error('Durable Object is overloaded.'), { overloaded: true }); }, pending]);
  await assert.rejects(read('/status', busy.call), /overloaded/);
  assert.equal(busy.asked.length, 1);
});
