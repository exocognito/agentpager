import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { createHash, generateKeyPairSync, randomBytes, verify } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import * as http from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import * as https from 'node:https';
import assert from 'node:assert/strict';
import { Schema } from 'effect';
import * as C from '../src/contract.ts';
import { decode, token } from '../src/shared.ts';
import { fromBase64url, keyPair, open, seal, toBase64url } from '../../contract/envelope.ts';
import { decodePart, encodePart, type AcknowledgementPreview, type CardPart, type DecisionPreview, type IdentityPart } from '../../contract/parts.ts';
import { AlertPayload, PREVIEW_KINDS } from '../../contract/alerts.ts';
import { askDigest, newKeys, sealAcknowledgement, sealAsk, sealIdentity, type Keys, type Question } from '../../cli/src/seal.ts';
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
// Every client of the API names itself (C.CLIENT_HEADER); the tests do too.
export const CLIENT = C.clientVersion('tests', 'local');
export const asClient = { [C.CLIENT_HEADER]: CLIENT };
// A question as the command holds it to the contract before sealing it (QuestionInput), with a request id of its own.
export function asQuestion(value: Record<string, unknown>): { requestId: string } & Question {
  const { requestId, ...q } = value;
  return { requestId: typeof requestId === 'string' ? requestId : token(), ...Schema.decodeUnknownSync(C.QuestionInput)(q) };
}
// A brief's short form: every card an agent asks is a brief, with a request id of its own.
export function question(title = 'Which plan?', detail?: string) {
  return { requestId: token(), title, ...(detail ? { detail } : {}), card: { type: 'brief' as const, recommended: 2, options: [{ number: 1, title: 'First plan', label: 'First', prioritizes: 'speed' }, { number: 2, title: 'Second plan', label: 'Second', prioritizes: 'safety' }], markdown: '## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Tradeoffs\n|       | A First        | B Second       |\n|-------|----------------|----------------|\n| Speed | :green[Fast]   | :yellow[Slower] |\n\n## Recommendation: B\n**Why:** It is safer.\n' } };
}
// An emoji card, as agents sent before briefs; the contract has no such card.
export const emojiCard = { requestId: token(), title: 'Which plan?', card: { type: 'generic', options: [{ number: 1, emoji: '🚀', title: 'One' }, { number: 2, emoji: '🛠️', title: 'Two' }] } };

// The phone's keys for each pager the tests made, by pager id, and each answer it sent, by request id: the app keeps
// its own answers, since only the agent can open what it sends.
const phoneKeys = new Map<string, string>(), pagerPublic = new Map<string, string>();
// What the phone makes for a new pager: a Curve25519 key pair, a 16-byte pager id, and the number naming both
// (I19, blueprint/areas/6-privacy.md). The private key is the phone's, and opens what is sealed to the pager.
export function pagerKeys() {
  const k = keyPair(), publicKey = toBase64url(k.publicKey), privateKey = toBase64url(k.privateKey);
  const id = randomBytes(16), fingerprint = createHash('sha256').update(k.publicKey).digest().subarray(0, 8);
  phoneKeys.set(id.toString('hex'), privateKey); pagerPublic.set(id.toString('hex'), publicKey);
  return { pagerId: id.toString('hex'), publicKey, privateKey, number: 'ap1_' + Buffer.concat([id, fingerprint]).toString('base64url') };
}
// What the tests' phone reads, once it has opened every part with the pager's private key, as the app does.
export type Readable = {
  pager: C.Pager;
  agents: { agent: ReadAgent; open: ReadDecision[]; answered: ReadDecision[] }[];
};
export type ReadAgent = { agentId: string; app: string; project: string; machine?: string; createdAt: string; finishedAt: string | null; lastActivityAt: string; openCount: number };
export type ReadDecision = {
  decisionId: string; status: C.DecisionStatus; title: string; detail?: string; card: CardPart['card'];
  attachments?: { name: string; type: string; bytes: number }[]; answerKey: string; askedAt: string;
  answer?: { answerId: string; decisionId: string; choice?: C.Choice; sentAt: string }; collectedAt?: string; warnedAt?: string;
  acknowledgement?: { decisionId: string; answerId: string; nextSteps: string; acknowledgedAt: string };
};
// An agent as the tests play it, through the command's own sealing (packages/cli/src/seal.ts): its keys and identity.
export type AgentCreds = { agent: { agentId: string }; agentKey: string; keys: Keys; identity: IdentityPart };
const raw32 = (key: string) => { const b = fromBase64url(key); if (!b || b.length !== 32) throw new Error('not a key'); return b; };
const sentAnswers = new Map<string, C.Choice>();
// Who each test agent is on which pager, and what it asked, for the parts that name them.
const agentPagers = new Map<string, string>();
const titles = new Map<string, string>();
export function openIdentity(pagerId: string, identity: string): IdentityPart {
  return decodePart('identity', open(raw32(phoneKeys.get(pagerId) ?? ''), 'identity', { pagerId }, identity));
}
export function openDecision(pagerId: string, d: C.Decision): ReadDecision {
  const key = raw32(phoneKeys.get(pagerId) ?? ''), at = { pagerId, decisionId: d.decisionId };
  const card = decodePart('card', open(key, 'card', at, d.card));
  const choice = d.answer && sentAnswers.get(d.answer.requestId);
  return {
    decisionId: d.decisionId, status: d.status, title: card.title, ...(card.detail === undefined ? {} : { detail: card.detail }), card: card.card,
    ...(card.attachments ? { attachments: card.attachments.map((a, i) => ({ ...a, bytes: d.attachments[i]?.bytes ?? 0 })) } : {}), answerKey: card.answerKey, askedAt: d.askedAt,
    ...(d.answer ? { answer: { answerId: d.answer.answerId, decisionId: d.decisionId, ...(choice ? { choice } : {}), sentAt: d.answer.sentAt } } : {}),
    ...(d.collectedAt ? { collectedAt: d.collectedAt } : {}), ...(d.warnedAt ? { warnedAt: d.warnedAt } : {}),
    ...(d.acknowledgement ? { acknowledgement: { decisionId: d.decisionId, answerId: d.acknowledgement.answerId, nextSteps: decodePart('acknowledgement', open(key, 'acknowledgement', at, d.acknowledgement.acknowledgement)).nextSteps, acknowledgedAt: d.acknowledgement.acknowledgedAt } } : {}),
  };
}
export function readable(inbox: C.PagerInbox): Readable {
  const pagerId = inbox.pager.pagerId;
  return {
    pager: inbox.pager,
    agents: inbox.agents.map(x => ({
      agent: { agentId: x.agent.agentId, ...openIdentity(pagerId, x.agent.identity), createdAt: x.agent.createdAt, finishedAt: x.agent.finishedAt, lastActivityAt: x.agent.lastActivityAt, openCount: x.agent.openCount },
      open: x.open.map(d => openDecision(pagerId, d)), answered: x.answered.map(d => openDecision(pagerId, d)),
    })),
  };
}
// A question sealed as the command seals it: the card, its attachments in slot order and the alert's preview, bound
// to the decision its request id names, with the digest that tells it apart.
export async function sealQuestion(a: AgentCreds, q: { requestId: string } & Question) {
  const { requestId, ...brief } = q, decisionId = await C.decisionIdOf(a.agent.agentId, requestId);
  titles.set(decisionId, brief.title);
  return { requestId, digest: askDigest(a.keys, brief), ...sealAsk(a.keys, a.identity, brief, decisionId) };
}
// The phone's answer, sealed to the key inside the card it answers, and kept so the phone can read its own answer.
export function sealAnswer(card: { answerKey: string }, pagerId: string, decisionId: string, choice: C.Choice, requestId = token()) {
  sentAnswers.set(requestId, choice);
  return { requestId, answer: seal(raw32(card.answerKey), 'answer', { pagerId, decisionId }, encodePart('answer', { choice })) };
}
export function openAnswer(a: AgentCreds, decisionId: string, part: string): C.Choice {
  return decodePart('answer', open(raw32(a.keys.privateKey), 'answer', { pagerId: a.keys.pager, decisionId }, part)).choice;
}

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

  // Each request names its client as CLIENT, unless `client` names another, or is null for none, as before the header.
  async function request(route: string, opts: { method?: string; data?: unknown; agent?: string; phone?: string; raw?: string; client?: string | null } = {}) {
    const client = opts.client === undefined ? CLIENT : opts.client;
    const r = await fetch(origin + route, { method: opts.method || (opts.data !== undefined || opts.raw !== undefined ? 'POST' : 'GET'), headers: { ...(opts.agent ? { authorization: `Bearer ${opts.agent}` } : {}), ...(opts.phone ? { 'x-phone-key': opts.phone } : {}), ...(client === null ? {} : { [C.CLIENT_HEADER]: client }), 'content-type': 'application/json' }, body: opts.raw ?? (opts.data === undefined ? undefined : JSON.stringify(opts.data)) });
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
  // The phone makes a pager; it holds the number, the phone key and the pager's private key.
  async function makePager(autoOff: C.AutoOff = 'never', phone = token()) {
    const keys = pagerKeys();
    const made = await ok(C.PagerReply, '/api/pagers', { phone, data: { number: keys.number, publicKey: keys.publicKey, autoOff } });
    return { ...keys, phone, pager: made.pager };
  }
  // A connect's body as the command sends it, for a test that sends it itself: the identity sealed to the key of the
  // pager the number names when the tests made it, and to a stranger's key otherwise.
  function connectBody(number: string, app = 'Codex', project = 'acceptance') {
    const pagerId = /^ap1_[A-Za-z0-9_-]{32}$/.test(number) ? Buffer.from(number.slice(4), 'base64url').subarray(0, 16).toString('hex') : '0'.repeat(32);
    const to = pagerPublic.get(pagerId) ?? toBase64url(keyPair().publicKey);
    return { number, identity: sealIdentity({ pager: pagerId, pagerKey: to, privateKey: newKeys().privateKey }, { app, project }) };
  }
  // An agent connects as the command does: it reads the pager's key, checks it against the number, makes its own keys
  // and seals who asked, the project and the computer to the pager.
  async function connect(number: string, app = 'Codex', project = 'acceptance', machine?: string): Promise<AgentCreds & { agent: ReadAgent; message: string }> {
    const pagerId = Buffer.from(number.slice(4), 'base64url').subarray(0, 16).toString('hex');
    const key = await ok(C.PagerKey, `/api/pagers/${pagerId}/key`);
    assert.equal(createHash('sha256').update(raw32(key.publicKey)).digest().subarray(0, 8).toString('base64url'), Buffer.from(number.slice(4), 'base64url').subarray(16, 24).toString('base64url'), 'the key the number names');
    const own = newKeys(), keys = { pager: pagerId, pagerKey: key.publicKey, privateKey: own.privateKey };
    const identity: IdentityPart = { app, project, ...(machine ? { machine } : {}) };
    const c = await ok(C.Connected, '/api/agents', { data: { number, identity: sealIdentity(keys, identity) } });
    agentPagers.set(c.agent.agentId, pagerId);
    return { ...c, agent: { ...c.agent, ...openIdentity(pagerId, c.agent.identity) }, keys, identity };
  }
  // A pager on a fresh phone, and one agent connected to it.
  async function connected(app?: string, project?: string) {
    const p = await makePager();
    return { p, a: await connect(p.number, app, project) };
  }
  const pager = async (pagerId: string, phone: string) => readable(await ok(C.PagerInbox, `/api/pagers/${pagerId}`, { phone }));
  const settings = (pagerId: string, phone: string, data: { on?: boolean; autoOff?: C.AutoOff }) => ok(C.PagerReply, `/api/pagers/${pagerId}/settings`, { phone, data });
  const sealed = sealQuestion;
  const ask = async (a: AgentCreds, title = 'Which plan?') => ok(C.Asked, `/api/agents/${a.agent.agentId}/cards`, { agent: a.agentKey, data: await sealQuestion(a, question(title)) });
  // The phone answers what it reads: it opens the card for the key to seal to.
  async function sealedAnswer(agentId: string, phone: string, decisionId: string, choice: C.Choice = { kind: 'option', number: 2 }, requestId = token()) {
    // An agent the command connected: its pager is whichever of this phone's lists it.
    let pagerId = agentPagers.get(agentId);
    for (const id of pagerId ? [] : phoneKeys.keys()) {
      const r = await request(`/api/pagers/${id}`, { phone });
      if (r.status === 200 && JSON.stringify(r.value).includes(agentId)) { pagerId = id; agentPagers.set(agentId, id); break; }
    }
    const d = (await pager(pagerId ?? '', phone)).agents.flatMap(x => [...x.open, ...x.answered]).find(x => x.decisionId === decisionId);
    if (!d) throw new Error(`the phone doesn't see ${decisionId}`);
    return sealAnswer(d, pagerId ?? "", decisionId, choice, requestId);
  }
  const answer = async (agentId: string, phone: string, decisionId: string, choice: C.Choice = { kind: 'option', number: 2 }, requestId = token()) =>
    ok(C.Receipt, `/api/agents/${agentId}/cards/${decisionId}/answer`, { phone, data: await sealedAnswer(agentId, phone, decisionId, choice, requestId) });
  // The agent reads its answer and opens it with its own key.
  async function read(a: AgentCreds, decisionId: string, wait?: number) {
    const r = await ok(C.AnswerStatus, `/api/agents/${a.agent.agentId}/cards/${decisionId}/answer${wait ? `?wait=${wait}` : ''}`, { agent: a.agentKey });
    return r.status === 'pending' ? r : { status: 'answered' as const, answer: { ...r.answer, choice: openAnswer(a, decisionId, r.answer.answer) } };
  }
  const sealedAck = (a: AgentCreds, decisionId: string, answerId: string, nextSteps = 'Received. Carrying on.') =>
    ({ answerId, ...sealAcknowledgement(a.keys, a.identity, decisionId, nextSteps, titles.get(decisionId) ?? 'this decision') });
  async function ack(a: AgentCreds, decisionId: string, answerId: string, nextSteps = 'Received. Carrying on.') {
    const r = await ok(C.Acknowledgement, `/api/agents/${a.agent.agentId}/cards/${decisionId}/acknowledge`, { agent: a.agentKey, data: sealedAck(a, decisionId, answerId, nextSteps) });
    return { ...r, nextSteps };
  }
  async function artifact(file: string, value: unknown) { await writeFile(path.join(evidence, file), typeof value === 'string' ? value : JSON.stringify(value, null, 2)); }
  return { origin, evidence, persist, stop, restart, request, ok, refused, makePager, connectBody, connect, connected, pager, settings, sealed, ask, answer, sealedAnswer, read, ack, sealedAck, artifact, clocks };
}

// A stand-in for Apple's push service: it records each alert, checks the provider token and that the payload is the
// contract's (packages/contract/alerts.ts), and answers each device token as `replies` says (200 unless set). Each
// delivery keeps its body as it came, for a test to scan.
export type Delivery = { device: string; headers: Record<string, string>; payload: AlertPayload; raw: string };
export async function apple() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const deliveries: Delivery[] = [], replies = new Map<string, { status: number; reason: string }>();
  const server = createHttpServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      const [head, claims, signature] = (req.headers.authorization ?? '').replace(/^bearer /, '').split('.');
      const genuine = !!signature && verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
      const header = JSON.parse(Buffer.from(head ?? '', 'base64url').toString() || '{}'), claim = JSON.parse(Buffer.from(claims ?? '', 'base64url').toString() || '{}');
      if (!genuine || header.alg !== 'ES256' || header.kid !== 'KEY1234567' || claim.iss !== 'TEAM123456') { res.writeHead(403); res.end(JSON.stringify({ reason: 'InvalidProviderToken' })); return; }
      const device = (req.url ?? '').replace('/3/device/', '');
      deliveries.push({ device, headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])), payload: decode(AlertPayload, JSON.parse(raw)), raw });
      const reply = replies.get(device) ?? { status: 200, reason: '' };
      res.writeHead(reply.status); res.end(reply.status === 200 ? '' : JSON.stringify({ reason: reply.reason }));
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  // The key as it sits in the vault: one line, its breaks turned to spaces.
  process.env.APNS_KEY_P8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, ' ');
  process.env.APNS_KEY_ID = 'KEY1234567'; process.env.APNS_TEAM_ID = 'TEAM123456'; process.env.APNS_TOPIC = 'me.agentpager.app.dev';
  process.env.APNS_ORIGIN = `http://127.0.0.1:${address.port}`;
  return { replies, all: () => deliveries, sent: (to: string) => deliveries.filter(d => d.device === to), close: () => server.close() };
}
export const device = () => Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const Ok = Schema.Struct({ ok: Schema.Literal(true) });
export const registered = (f: Awaited<ReturnType<typeof fixture>>) => (pagerId: string, phone: string, deviceToken: string) => f.ok(Ok, `/api/pagers/${pagerId}/push`, { phone, data: { token: deviceToken, environment: 'sandbox' } });
// What the phone's alert extension reads from an alert: its preview, opened with the pager's key.
export function openPreview(p: AlertPayload): DecisionPreview | AcknowledgementPreview {
  const kind = PREVIEW_KINDS[p.kind];
  return decodePart(kind, open(raw32(phoneKeys.get(p.pagerId) ?? ''), kind, { pagerId: p.pagerId, decisionId: p.decisionId }, p.preview));
}
