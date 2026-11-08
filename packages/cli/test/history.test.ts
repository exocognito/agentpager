import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The history is one file per pager on each machine, and every agent on that pager appends to it from its own
// process. Past the cap each append also trims the file, so here several processes append at once across the cap.
const home = mkdtempSync(path.join(tmpdir(), 'agentpager-history-'));
process.env.AGENTPAGER_HOME = home;
const store = await import('../src/store.ts');
const pager = 'f'.repeat(32), file = path.join(home, 'history', `${pager}.jsonl`);

// One writer: loads the command's store, says it's ready, waits for the go file, then appends its lines in order, a
// millisecond apart, so the writers take turns.
const writer = `
  import { existsSync } from 'node:fs';
  const store = await import(process.env.STORE_URL);
  const pause = new Int32Array(new SharedArrayBuffer(4));
  process.stdout.write('ready\\n');
  while (!existsSync(process.env.GO)) Atomics.wait(pause, 0, 0, 1);
  for (let seq = 0; seq < Number(process.env.COUNT); seq++) {
    store.appendHistory(process.env.PAGER, { at: new Date().toISOString(), event: 'asked', agent: process.env.WRITER, decision: 'd_' + seq, seq });
    Atomics.wait(pause, 0, 0, 1);
  }
`;

test('B31.4 Agents appending at once past the cap keep the latest 1,000 lines, none lost or doubled, each in its order', { timeout: 120_000 }, async () => {
  const seeds = store.HISTORY_CAP - 10, writers = ['ap-wa2a', 'ap-wb2b', 'ap-wc2c', 'ap-wd2d'], count = 50;
  for (let seq = 0; seq < seeds; seq++) store.appendHistory(pager, { at: new Date().toISOString(), event: 'asked', agent: 'ap-seed', decision: `d_${seq}`, seq });

  const go = path.join(home, 'go');
  let ready = 0, start = () => {};
  const allReady = new Promise<void>(resolve => { start = resolve; });
  const runs = writers.map(w => new Promise<void>((resolve, reject) => {
    const env = { ...process.env, STORE_URL: pathToFileURL(path.resolve(import.meta.dirname, '../src/store.ts')).href, GO: go, COUNT: String(count), WRITER: w, PAGER: pager };
    const child = spawn(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', writer], { env });
    let err = '';
    child.stdout.on('data', d => { if (String(d).includes('ready') && ++ready === writers.length) start(); });
    child.stderr.on('data', d => { err += d; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${w} exited ${code}: ${err}`)));
  }));
  await allReady;
  writeFileSync(go, '');
  await Promise.all(runs);

  const raw = readFileSync(file, 'utf8');
  assert.ok(raw.endsWith('\n'));
  const lines: { agent: string; seq: number }[] = raw.split('\n').slice(0, -1).map(l => JSON.parse(l));
  assert.equal(lines.length, store.HISTORY_CAP);
  // Every writer's line is there once, in the order it wrote them; the oldest seeds make room, and the rest stay in order.
  for (const w of writers) assert.deepEqual(lines.filter(l => l.agent === w).map(l => l.seq), Array.from({ length: count }, (_, i) => i), w);
  const dropped = seeds + writers.length * count - store.HISTORY_CAP;
  assert.deepEqual(lines.filter(l => l.agent === 'ap-seed').map(l => l.seq), Array.from({ length: seeds - dropped }, (_, i) => dropped + i));
  assert.equal(store.readHistory(pager).length, store.HISTORY_CAP);
  // Still readable only by this user, and nothing left beside it: no lock, no half-written copy.
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(path.dirname(file)), [`${pager}.jsonl`]);
});
