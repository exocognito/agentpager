import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { Schema } from 'effect';
import * as C from '../src/contract.ts';
import { decode, token } from '../src/shared.ts';
export { token, C, decode, assert };

export const app = fileURLToPath(new URL('..', import.meta.url));
export const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
export const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export async function until<A>(fn: () => Promise<A>, accepts: (a: A) => boolean, ms = 20_000): Promise<A> {
  const stop = Date.now() + ms; let error: unknown;
  do { try { const result = await fn(); if (accepts(result)) return result; } catch (e) { error = e; } await pause(100); } while (Date.now() < stop);
  throw new Error(`Condition timed out: ${String(error ?? '')}`);
}
async function port() { const s = createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const address = s.address(); if (!address || typeof address === 'string') throw new Error('port'); const p = address.port; await new Promise<void>(r => s.close(() => r())); return p; }

export const ErrorBody = Schema.Struct({ error: Schema.String, message: Schema.String, reason: Schema.optional(Schema.String), triesLeft: Schema.optional(Schema.Number), endReason: Schema.optional(C.EndReason), endedAt: Schema.optional(C.Timestamp), name: Schema.optional(Schema.NullOr(Schema.String)), limit: Schema.optional(Schema.Number) });
export type ErrorBody = typeof ErrorBody.Type;
// A brief's short form: every card an agent asks is a brief.
export function question(title = 'Which plan?', detail?: string) {
  return { title, ...(detail ? { detail } : {}), card: { type: 'brief', recommended: 2, options: [{ number: 1, title: 'First plan', label: 'First', prioritizes: 'speed' }, { number: 2, title: 'Second plan', label: 'Second', prioritizes: 'safety' }], markdown: '## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Tradeoffs\n|       | A First        | B Second       |\n|-------|----------------|----------------|\n| Speed | :green[Fast]   | :yellow[Slower] |\n\n## Recommendation: B\n**Why:** It is safer.\n' } };
}
// An emoji card, as agents sent before briefs; the server refuses them now.
export const emojiCard = { title: 'Which plan?', card: { type: 'generic', options: [{ number: 1, emoji: '🚀', title: 'One' }, { number: 2, emoji: '🛠️', title: 'Two' }] } };

// Each test file starts its own workerd with the shortest local lifetimes its cases need.
export async function fixture(name: string, lifetimes = { windowMs: 60_000, lifetimeMs: 120_000, retainMs: 60_000 }) {
  const evidence = path.join(process.env.BLUEPRINT_EVIDENCE_DIR || path.join(tmpdir(), 'agentpager-evidence'), name);
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(path.join(tmpdir(), `agentpager-${name}-`));
  const serverPort = await port(), inspector = await port();
  const origin = `http://127.0.0.1:${serverPort}`;
  const persist = path.join(directory, 'persist');
  let child: ChildProcess | undefined;
  const log = createWriteStream(path.join(evidence, 'server.log'));
  async function launch() {
    child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: app, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(serverPort), AGENTPAGER_INSPECTOR_PORT: String(inspector), AGENTPAGER_PERSIST: persist, AGENTPAGER_BUILD_DIR: path.join(directory, 'build'), AGENTPAGER_UNPAIRED_MS: String(lifetimes.windowMs), AGENTPAGER_SESSION_MS: String(lifetimes.lifetimeMs), AGENTPAGER_RETAIN_MS: String(lifetimes.retainMs) } });
    child.stdout?.pipe(log, { end: false }); child.stderr?.pipe(log, { end: false });
    try { await until(async () => (await fetch(origin + '/start')).status, s => s === 200, 90_000); } catch (e) { await stop(); throw e; }
  }
  async function stop() {
    const pid = child?.pid; if (!pid) return;
    const gone = () => { try { process.kill(-pid, 0); return false; } catch { return true; } };
    process.kill(-pid, 'SIGTERM');
    for (let n = 0; n < 100 && !gone(); n++) await pause(100);
    if (!gone()) process.kill(-pid, 'SIGKILL');
    for (let n = 0; n < 30 && !gone(); n++) await pause(100);
    assert.ok(gone(), 'started process group is gone'); child = undefined;
  }
  // Stops the server and starts it again on the same port and data, as a deploy does.
  async function restart() { await stop(); await launch(); }
  await launch();

  async function request(route: string, opts: { method?: string; data?: unknown; agent?: string; phone?: string; raw?: string } = {}) {
    const r = await fetch(origin + route, { method: opts.method || (opts.data !== undefined || opts.raw !== undefined ? 'POST' : 'GET'), headers: { ...(opts.agent ? { authorization: `Bearer ${opts.agent}` } : {}), ...(opts.phone ? { 'x-phone-key': opts.phone } : {}), 'content-type': 'application/json' }, body: opts.raw ?? (opts.data === undefined ? undefined : JSON.stringify(opts.data)) });
    assert.equal(r.headers.get('x-agentpager-build'), sha, `candidate build on ${route}`);
    const value: unknown = await r.json();
    return { status: r.status, value };
  }
  async function ok<A, I>(schema: Schema.Schema<A, I>, route: string, opts: Parameters<typeof request>[1] = {}) {
    const r = await request(route, opts); assert.equal(r.status, 200, `${route}: ${JSON.stringify(r.value)}`); return decode(schema, r.value);
  }
  async function refused(status: number, tag: string, route: string, opts: Parameters<typeof request>[1] = {}): Promise<ErrorBody> {
    const r = await request(route, opts); assert.equal(r.status, status, `${route}: ${JSON.stringify(r.value)}`);
    const e = decode(ErrorBody, r.value); assert.equal(e.error, tag); assert.ok(e.message.length > 10, 'a plain message'); return e;
  }
  const create = (name = 'Agent · acceptance', lifetime?: C.Lifetime) => ok(C.Created, '/api/sessions', { data: { name, ...(lifetime ? { lifetime } : {}) } });
  const phoneCreate = (phone: string, lifetime?: C.Lifetime) => ok(C.PhoneCreated, '/api/pagers', { phone, data: lifetime ? { lifetime } : {} });
  const join = (code: string, name = 'Codex · acceptance') => ok(C.Joined, `/api/start/${code}/join`, { data: { name } });
  const info = (code: string) => ok(C.StartInfo, `/api/start/${code}`);
  const pair = (code: string, phone: string, emojis: ReadonlyArray<string>) => ok(C.SessionReply, `/api/start/${code}/pair`, { phone, data: { code: emojis } });
  const inbox = (sessionId: string, phone: string) => ok(C.PhoneInbox, `/api/sessions/${sessionId}/cards`, { phone });
  const ask = (s: { session: { sessionId: string }; agentKey: string }, title = 'Which plan?') => ok(C.Asked, `/api/sessions/${s.session.sessionId}/cards`, { agent: s.agentKey, data: question(title) });
  const answer = (sessionId: string, phone: string, decisionId: string, choice: unknown = { kind: 'option', number: 2 }, requestId = token()) => ok(C.Receipt, `/api/sessions/${sessionId}/cards/${decisionId}/answer`, { phone, data: { requestId, choice } });
  const read = (s: { session: { sessionId: string }; agentKey: string }, decisionId: string, wait?: number) => ok(C.AnswerStatus, `/api/sessions/${s.session.sessionId}/cards/${decisionId}/answer${wait ? `?wait=${wait}` : ''}`, { agent: s.agentKey });
  const ack = (s: { session: { sessionId: string }; agentKey: string }, decisionId: string, answerId: string, nextSteps = 'Received. Carrying on.') => ok(C.Acknowledgement, `/api/sessions/${s.session.sessionId}/cards/${decisionId}/acknowledge`, { agent: s.agentKey, data: { answerId, nextSteps } });
  // An agent-made pager, paired by a fresh phone key.
  async function paired(name?: string, lifetime?: C.Lifetime) {
    const s = await create(name, lifetime), phone = token();
    const p = await pair(s.link.code, phone, s.pairingCode.emojis);
    return { s, phone, session: p.session };
  }
  async function artifact(file: string, value: unknown) { await writeFile(path.join(evidence, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2)); }
  return { origin, evidence, persist, stop, restart, request, ok, refused, create, phoneCreate, join, info, pair, inbox, ask, answer, read, ack, paired, artifact, lifetimes };
}
// Three emojis from the palette that are not the code at some position.
export function wrongCode(palette: ReadonlyArray<{ emoji: string }>, right: ReadonlyArray<string>) {
  const other = palette.find(p => p.emoji !== right[0]);
  if (!other) throw new Error('palette has one emoji');
  return [other.emoji, right[1], right[2]];
}
