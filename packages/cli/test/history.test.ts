import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The history is one file per pager on each machine, and every agent on that pager appends to it from its own
// process. Past the cap each append also trims the file, so here several processes append at once across the cap.
// Reads take no lock, so a read can meet a line another agent is still writing, or one an append that failed left.
const home = mkdtempSync(path.join(tmpdir(), 'agentpager-history-'));
process.env.AGENTPAGER_HOME = home;
const store = await import('../src/store.ts');
const op = await import('../src/commands.ts');
const { newKeys } = await import('../src/seal.ts');
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
  assert.deepEqual(readdirSync(path.dirname(file)).filter(f => f.startsWith(pager)), [`${pager}.jsonl`]);
});

// A decision as ask records it, and each pager's file, written here as a test of its own.
const asked = (agent: string, n: number) => ({ at: `2026-11-08T10:0${n}:00.000Z`, event: 'asked' as const, agent, app: 'Codex', project: 'history', decision: `d_${n}${n}${n}${n}`, title: `Question ${n}?`, options: ['Yes', 'No'] });
const line = (e: object) => JSON.stringify(e) + '\n';
function historyFile(pager: string, text: string) {
  const at = path.join(home, 'history', `${pager}.jsonl`);
  mkdirSync(path.dirname(at), { recursive: true, mode: 0o700 });
  writeFileSync(at, text, { mode: 0o600 });
  return at;
}

test('A history that ends part way through a line still reads every whole line, and the next append starts a line of its own', () => {
  const pager = 'a'.repeat(32), id = 'ap-half';
  assert.deepEqual(store.readHistory(pager), [], 'no file is no history');
  // As a read meets it while another agent's append is under way, or as an append that failed leaves it.
  const whole = [asked(id, 1), asked(id, 2)], half = line(asked(id, 3)).slice(0, 40);
  const file = historyFile(pager, whole.map(line).join('') + half);
  assert.deepEqual(store.readHistory(pager), whole);
  // agentpager history shows both.
  const keys = newKeys();
  store.saveAgent({ id, server: 'http://127.0.0.1:9', pager, agentId: 'A'.repeat(32), agentKey: 'K'.repeat(32), privateKey: keys.privateKey, pagerKey: newKeys().publicKey, app: 'Codex', project: 'history', createdAt: whole[0].at, rulesShownAt: null, cardsSinceRules: 0, decisions: {} });
  const shown = op.history(id);
  assert.equal(shown.code, 0);
  assert.deepEqual(shown.text.split('\n').filter(l => l.startsWith('  Question')), ['  Question 2?', '  Question 1?']);
  // The next append isn't joined to the half line, so it reads too, and the half line stays as it was.
  store.appendHistory(pager, asked(id, 4));
  assert.deepEqual(store.readHistory(pager), [...whole, asked(id, 4)]);
  assert.equal(readFileSync(file, 'utf8'), whole.map(line).join('') + half + '\n' + line(asked(id, 4)));
});

test('A broken line inside the history is skipped, and the lines either side of it still read', () => {
  const pager = 'b'.repeat(32), before = asked('ap-mids', 1), after = asked('ap-mids', 2);
  // Part of a line, zero bytes as a crash can leave, and JSON that isn't an event.
  historyFile(pager, line(before) + '{"at":"2026-11-08T10:0\n' + '\0\0\0\n' + 'null\n[1]\n"asked"\n{"event":"asked"}\n\n' + line(after));
  assert.deepEqual(store.readHistory(pager), [before, after]);
});

test('B31.4 A trim past the cap keeps a broken line among the latest 1,000 as it is, and drops only the oldest', () => {
  const pager = 'c'.repeat(32);
  const lines = Array.from({ length: store.HISTORY_CAP }, (_, seq) => line({ at: '2026-11-08T10:00:00.000Z', event: 'asked', agent: 'ap-trim', decision: `d_${seq}`, seq }));
  lines[500] = '{"at":"2026-11\n';
  const file = historyFile(pager, lines.join(''));
  const next = { at: '2026-11-08T11:00:00.000Z', event: 'asked' as const, agent: 'ap-trim', decision: 'd_next', seq: store.HISTORY_CAP };
  store.appendHistory(pager, next);
  assert.equal(readFileSync(file, 'utf8'), [...lines.slice(1), line(next)].join(''));
  assert.equal(store.readHistory(pager).length, store.HISTORY_CAP - 1);
});
