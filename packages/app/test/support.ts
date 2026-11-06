import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import * as http from 'node:http';
import * as https from 'node:https';
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
// One request with a Host header of the test's choosing: the local Worker builds its URL from that header, as a
// deployed one does from the hostname it was reached by. HTTPS accepts the local server's self-signed certificate.
// Each request has a connection of its own, since a refusal may leave the body it didn't read on the connection.
export function raw(url: string, opts: { method?: string; host?: string; body?: string } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  const u = new URL(url), client = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(u, { method: opts.method ?? 'GET', agent: false, headers: { ...(opts.host ? { host: opts.host } : {}), ...(opts.body ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(opts.body)) } : {}) }, rejectUnauthorized: false }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject); req.end(opts.body);
  });
}
async function port() { const s = createServer(); await new Promise<void>(r => s.listen(0, '127.0.0.1', r)); const address = s.address(); if (!address || typeof address === 'string') throw new Error('port'); const p = address.port; await new Promise<void>(r => s.close(() => r())); return p; }

export const ErrorBody = Schema.Struct({ error: Schema.String, message: Schema.String, reason: Schema.optional(Schema.String), limit: Schema.optional(Schema.Number) });
export type ErrorBody = typeof ErrorBody.Type;
// A brief's short form: every card an agent asks is a brief.
export function question(title = 'Which plan?', detail?: string) {
  return { title, ...(detail ? { detail } : {}), card: { type: 'brief', recommended: 2, options: [{ number: 1, title: 'First plan', label: 'First', prioritizes: 'speed' }, { number: 2, title: 'Second plan', label: 'Second', prioritizes: 'safety' }], markdown: '## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Tradeoffs\n|       | A First        | B Second       |\n|-------|----------------|----------------|\n| Speed | :green[Fast]   | :yellow[Slower] |\n\n## Recommendation: B\n**Why:** It is safer.\n' } };
}
// An emoji card, as agents sent before briefs; the contract has no such card.
export const emojiCard = { title: 'Which plan?', card: { type: 'generic', options: [{ number: 1, emoji: '🚀', title: 'One' }, { number: 2, emoji: '🛠️', title: 'Two' }] } };

// What the phone makes for a new pager: a Curve25519 key pair, a 16-byte pager id, and the number naming both
// (I19, blueprint/areas/6-privacy.md).
export function pagerKeys() {
  const publicKey = String(generateKeyPairSync('x25519').publicKey.export({ format: 'jwk' }).x);
  const id = randomBytes(16), fingerprint = createHash('sha256').update(Buffer.from(publicKey, 'base64url')).digest().subarray(0, 8);
  return { pagerId: id.toString('hex'), publicKey, number: 'ap1_' + Buffer.concat([id, fingerprint]).toString('base64url') };
}
export type AgentCreds = { agent: { agentId: string }; agentKey: string };

// Each test file starts its own workerd. Zero is the production clock; a test that crosses auto-off or housekeeping
// in real time sets a short one.
// `https` serves it over HTTPS, with a self-signed certificate.
export async function fixture(name: string, clocks: { autoOffMs: number; idleMs: number; pickupMs?: number } = { autoOffMs: 0, idleMs: 0 }, serving: { https?: boolean } = {}) {
  const evidence = path.join(process.env.BLUEPRINT_EVIDENCE_DIR || path.join(tmpdir(), 'agentpager-evidence'), name);
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(path.join(tmpdir(), `agentpager-${name}-`));
  const serverPort = await port(), inspector = await port();
  const origin = `${serving.https ? 'https' : 'http'}://127.0.0.1:${serverPort}`;
  const persist = path.join(directory, 'persist');
  let child: ChildProcess | undefined;
  const log = createWriteStream(path.join(evidence, 'server.log'));
  async function launch() {
    child = spawn(process.execPath, ['scripts/start.mjs'], { cwd: app, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(serverPort), AGENTPAGER_INSPECTOR_PORT: String(inspector), AGENTPAGER_PERSIST: persist, AGENTPAGER_BUILD_DIR: path.join(directory, 'build'), AGENTPAGER_AUTO_OFF_MS: String(clocks.autoOffMs), AGENTPAGER_IDLE_MS: String(clocks.idleMs), AGENTPAGER_PICKUP_MS: String(clocks.pickupMs ?? 0), ...(serving.https ? { AGENTPAGER_LOCAL_PROTOCOL: 'https' } : {}) } });
    child.stdout?.pipe(log, { end: false }); child.stderr?.pipe(log, { end: false });
    try { await until(async () => (await raw(origin + '/start')).status, s => s === 200, 90_000); } catch (e) { await stop(); throw e; }
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
  // The phone makes a pager; it holds the number and the phone key.
  async function makePager(autoOff: C.AutoOff = 'never', phone = token()) {
    const keys = pagerKeys();
    const made = await ok(C.PagerReply, '/api/pagers', { phone, data: { number: keys.number, publicKey: keys.publicKey, autoOff } });
    return { ...keys, phone, pager: made.pager };
  }
  const connect = (number: string, app = 'Codex', project = 'acceptance', machine?: string) => ok(C.Connected, '/api/agents', { data: { number, app, project, ...(machine ? { machine } : {}) } });
  // A pager on a fresh phone, and one agent connected to it.
  async function connected(app?: string, project?: string) {
    const p = await makePager();
    return { p, a: await connect(p.number, app, project) };
  }
  const pager = (pagerId: string, phone: string) => ok(C.PagerInbox, `/api/pagers/${pagerId}`, { phone });
  const settings = (pagerId: string, phone: string, data: { on?: boolean; autoOff?: C.AutoOff }) => ok(C.PagerReply, `/api/pagers/${pagerId}/settings`, { phone, data });
  const ask = (a: AgentCreds, title = 'Which plan?') => ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: question(title) });
  const answer = (agentId: string, phone: string, decisionId: string, choice: unknown = { kind: 'option', number: 2 }, requestId = token()) => ok(C.Receipt, `/api/agents/${agentId}/cards/${decisionId}/answer`, { phone, data: { requestId, choice } });
  const read = (a: AgentCreds, decisionId: string, wait?: number) => ok(C.AnswerStatus, `/api/agents/${a.agent.agentId}/cards/${decisionId}/answer${wait ? `?wait=${wait}` : ''}`, { agent: a.agentKey });
  const ack = (a: AgentCreds, decisionId: string, answerId: string, nextSteps = 'Received. Carrying on.') => ok(C.Acknowledgement, `/api/agents/${a.agent.agentId}/cards/${decisionId}/acknowledge`, { agent: a.agentKey, data: { answerId, nextSteps } });
  async function artifact(file: string, value: unknown) { await writeFile(path.join(evidence, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2)); }
  return { origin, evidence, persist, stop, restart, request, ok, refused, makePager, connect, connected, pager, settings, ask, answer, read, ack, artifact, clocks };
}
