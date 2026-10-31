import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import * as C from './contract.ts';
import { AttachmentName, attachmentInfo, base64Bytes } from '../../blueprint/design/ui/components/cards/brief/schema.ts';
import { body, decode, emptyBody, iso, json, refusal, sameDigest, sha256, token } from './shared.ts';
import { clocks, forward, type Env } from './env.ts';
import { alert, pickupBody, PushTarget, questionBody, type Alert } from './push.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
// One agent: what connected to a pager with its number. Its key and its pager's phone key are stored only as SHA-256
// digests. It has no lifetime: it lasts until its pager is deleted or housekeeping forgets it (clocks.idleMs).
const Meta = Schema.Struct({
  agentId: C.Token, pagerId: C.PagerId, app: C.Label, project: C.Label, machine: Schema.optional(C.Label),
  createdAt: C.Timestamp, finishedAt: Schema.NullOr(C.Timestamp), lastActivityAt: C.Timestamp,
  agentHash: Digest, phoneHash: Digest,
});
type Meta = typeof Meta.Type;
const Open = Schema.Struct({ agentId: C.Token, pagerId: C.PagerId, phoneHash: Digest, app: C.Label, project: C.Label, machine: Schema.optional(C.Label) });
const PagerState = Schema.Struct({ state: Schema.Literal('on', 'off', 'gone'), push: Schema.optional(Schema.NullOr(PushTarget)) });
type PagerState = typeof PagerState.Type;
// Alerts are never delivered later than this.
const ALERT_EXPIRY_MS = 24 * 3_600_000;
// A warning that couldn't be sent (the Registry unreachable) is tried again this much later.
const WARN_RETRY_MS = 60_000;

async function keyDigest(value: string | null | undefined) { return value && Schema.is(C.Token)(value) ? sha256(value) : null; }
const agentDigest = (request: Request) => keyDigest(request.headers.get(C.AGENT_AUTH_HEADER)?.replace(/^Bearer /, ''));
const phoneDigest = (request: Request) => keyDigest(request.headers.get(C.PHONE_AUTH_HEADER));
const registry = (env: Env, path: string, data: unknown) => forward(env.REGISTRY, 'registry', path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export class Agent {
  constructor(private ctx: DurableObjectState, private env: Env) { this.schema(); }
  private schema() {
    this.tx(() => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS agent (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS answers (decision_id TEXT PRIMARY KEY REFERENCES proposals(id), request_id TEXT NOT NULL UNIQUE, input TEXT NOT NULL, json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS acknowledgements (decision_id TEXT PRIMARY KEY REFERENCES answers(decision_id), json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attachments (decision_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, data BLOB NOT NULL, PRIMARY KEY (decision_id, name));
        CREATE TABLE IF NOT EXISTS pickups (decision_id TEXT PRIMARY KEY REFERENCES answers(decision_id), due INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS collections (decision_id TEXT PRIMARY KEY REFERENCES answers(decision_id), at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS warnings (decision_id TEXT PRIMARY KEY REFERENCES answers(decision_id), at TEXT NOT NULL);`);
      // Decisions asked before 31 Oct 2026 were stored with "kind": "card" and an emoji on each option, for phones from
      // before briefs. Neither is in the contract now, so each is rewritten once without them.
      if (this.ctx.storage.sql.exec("SELECT 1 FROM proposals WHERE json_type(json, '$.kind') IS NOT NULL LIMIT 1").toArray().length) {
        const emoji = Array.from({ length: C.OPTIONS_MAX }, (_, i) => `'$.card.options[${i}].emoji'`).join(', ');
        this.ctx.storage.sql.exec(`DROP TRIGGER IF EXISTS proposal_immutable;
          UPDATE proposals SET json = json_remove(json, '$.kind', ${emoji}) WHERE json_type(json, '$.kind') IS NOT NULL;`);
      }
      this.ctx.storage.sql.exec(`CREATE TRIGGER IF NOT EXISTS proposal_immutable BEFORE UPDATE ON proposals BEGIN SELECT RAISE(ABORT,'immutable proposal'); END;
        CREATE TRIGGER IF NOT EXISTS answer_immutable BEFORE UPDATE ON answers BEGIN SELECT RAISE(ABORT,'immutable answer'); END;
        CREATE TRIGGER IF NOT EXISTS acknowledgement_immutable BEFORE UPDATE ON acknowledgements BEGIN SELECT RAISE(ABORT,'immutable acknowledgement'); END;
        CREATE TRIGGER IF NOT EXISTS attachment_immutable BEFORE UPDATE ON attachments BEGIN SELECT RAISE(ABORT,'immutable attachment'); END;
        CREATE TRIGGER IF NOT EXISTS collection_immutable BEFORE UPDATE ON collections BEGIN SELECT RAISE(ABORT,'immutable collection'); END;
        CREATE TRIGGER IF NOT EXISTS warning_immutable BEFORE UPDATE ON warnings BEGIN SELECT RAISE(ABORT,'immutable warning'); END;
        CREATE TRIGGER IF NOT EXISTS attachments_go_with_proposal AFTER DELETE ON proposals BEGIN DELETE FROM attachments WHERE decision_id = OLD.id; END;`);
    });
  }
  private meta(): Meta | null {
    const raw = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM agent WHERE id=1').toArray()[0]?.json;
    return raw ? decode(Meta, JSON.parse(raw)) : null;
  }
  private save(m: Meta) { decode(Meta, m); this.ctx.storage.sql.exec('INSERT INTO agent VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json', JSON.stringify(m)); }
  private tx<A>(run: () => A): A { return this.ctx.storage.transactionSync(run); }
  // Everything goes at once: decisions, attachments, answers, acknowledgements and the keys' digests.
  private async forget() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.schema();
  }

  // The one alarm serves both clocks: the next answer due a warning, else housekeeping.
  private afterwards = async () => {
    const m = this.meta();
    if (!m) { await this.ctx.storage.deleteAlarm(); return; }
    const due = this.ctx.storage.sql.exec<{ due: number | null }>('SELECT min(due) AS due FROM pickups').toArray()[0]?.due ?? null;
    const next = Math.min(Date.parse(m.lastActivityAt) + clocks.idleMs, due ?? Infinity);
    if (await this.ctx.storage.getAlarm() !== next) await this.ctx.storage.setAlarm(next);
  };
  // Housekeeping: an agent idle for clocks.idleMs is forgotten, and its pager stops listing it.
  async alarm() {
    const m = this.meta();
    if (m && Date.now() < Date.parse(m.lastActivityAt) + clocks.idleMs) {
      // Housekeeping stays armed whatever happens to a warning. One that fails stays queued, due again a minute
      // later, so a request in between doesn't bring it forward.
      try { await this.warn(m); } catch (error) {
        console.error('Agent warning failed', error instanceof Error ? error.message : 'unknown');
        const now = Date.now();
        this.ctx.storage.sql.exec('UPDATE pickups SET due = ? WHERE due <= ?', now + WARN_RETRY_MS, now);
      }
      await this.afterwards();
      return;
    }
    if (m) {
      try { await registry(this.env, '/forget', { pagerId: m.pagerId, agentId: m.agentId }); }
      catch { /* The pager lists it until it is deleted; reading it then answers UnknownAgent, which the phone skips. */ }
    }
    await this.forget();
  }

  // An answer no agent has collected clocks.pickupMs after Send: the owner hears once, by an alert while the pager is on
  // and on the decision row, that AgentPager can't reach the agent. Each answer is queued for this when it is stored,
  // so answers from before the warning existed never get one. An unreachable Registry leaves the queue as it was.
  private async warn(m: Meta) {
    const due = () => this.ctx.storage.sql.exec<{ decision_id: string }>('SELECT decision_id FROM pickups WHERE due <= ?', Date.now()).toArray().map(r => r.decision_id);
    if (!due().length) return;
    let s: PagerState;
    try { s = await this.pagerState(m); } catch (error) { if (error instanceof C.Refusal) return; throw error; }
    // Read again: an agent may have collected one while the pager's state was asked, and collecting dequeues it.
    // While the pager is off no agent can read an answer, so there is nothing to warn about.
    const on = s.state === 'on';
    const warned = this.tx(() => {
      const ids = due(), at = iso();
      for (const id of ids) {
        this.ctx.storage.sql.exec('DELETE FROM pickups WHERE decision_id=?', id);
        if (on) this.ctx.storage.sql.exec('INSERT OR IGNORE INTO warnings VALUES (?, ?)', id, at);
      }
      return on ? ids : [];
    });
    for (const id of warned) await this.alertPhone(m, s.push ?? null, id, 'warning', pickupBody(m, this.decision(id).title));
  }

  private openCount() { return this.ctx.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM proposals WHERE id NOT IN (SELECT decision_id FROM answers)').toArray()[0].n; }
  private summary(m: Meta): C.Agent {
    return decode(C.Agent, { agentId: m.agentId, app: m.app, project: m.project, ...(m.machine ? { machine: m.machine } : {}), createdAt: m.createdAt, finishedAt: m.finishedAt, lastActivityAt: m.lastActivityAt, openCount: this.openCount() });
  }
  private agent(digest: string | null): Meta {
    const m = this.meta(); if (!m) throw C.refuse.unknownAgent();
    if (!sameDigest(digest, m.agentHash)) throw C.refuse.unauthorized();
    return m;
  }
  private phone(digest: string | null): Meta {
    const m = this.meta(); if (!m) throw C.refuse.unknownAgent();
    if (!sameDigest(digest, m.phoneHash)) throw C.refuse.unauthorized();
    return m;
  }
  // The pager's state, asked of the Registry on every call that sends something. A deleted pager takes its agents
  // with it: one that missed being told forgets itself here.
  private async pagerState(m: Meta, by: 'agent' | 'phone' | 'connect' = 'agent'): Promise<PagerState> {
    const reply = await registry(this.env, '/state', { pagerId: m.pagerId });
    if (!reply.ok) throw new Error(`Registry refused the pager state: ${reply.status}`);
    const s = decode(PagerState, await reply.json());
    if (s.state === 'gone') { await this.forget(); throw by === 'agent' ? C.refuse.pagerDeleted() : by === 'phone' ? C.refuse.unknownPager() : C.refuse.numberInvalid(); }
    return s;
  }
  // Off means nothing gets through and nothing is queued.
  private async on(m: Meta, by: 'agent' | 'phone' = 'agent') {
    const s = await this.pagerState(m, by);
    if (s.state === 'off') throw C.refuse.pagerOff();
    return s.push ?? null;
  }
  private decision(id: string): C.Decision {
    const raw = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM proposals WHERE id=?', id).toArray()[0];
    if (!raw) throw C.refuse.unknownDecision();
    const proposal = decode(C.Decision, JSON.parse(raw.json));
    const answer = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM answers WHERE decision_id=?', id).toArray()[0];
    if (!answer) return proposal;
    const a = decode(C.Answer, JSON.parse(answer.json));
    const ack = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM acknowledgements WHERE decision_id=?', id).toArray()[0];
    const at = (table: 'collections' | 'warnings') => this.ctx.storage.sql.exec<{ at: string }>(`SELECT at FROM ${table} WHERE decision_id=?`, id).toArray()[0]?.at;
    const collectedAt = at('collections'), warnedAt = at('warnings');
    return decode(C.Decision, { ...proposal, status: a.choice.kind === 'feedback' ? 'feedback' : ack ? 'acknowledged' : 'answered', answer: a, ...(collectedAt ? { collectedAt } : {}), ...(warnedAt ? { warnedAt } : {}), ...(ack ? { acknowledgement: decode(C.Acknowledgement, JSON.parse(ack.json)) } : {}) });
  }
  private touch(m: Meta) { this.save({ ...m, lastActivityAt: iso() }); }
  // An alert goes to the pager's phone when it gave a token. Apple's refusal of a token drops it.
  private async alertPhone(m: Meta, to: PushTarget | null, decisionId: string, kind: 'decision' | 'acknowledgement' | 'warning', text: string) {
    if (!to) return;
    const a: Alert = { title: `${m.app} · ${m.project}`, body: text, timeSensitive: kind === 'decision', expiresAt: iso(Date.now() + ALERT_EXPIRY_MS), collapseId: decisionId, thread: m.pagerId, data: { kind, pagerId: m.pagerId, agentId: m.agentId, decisionId } };
    if (await alert(this.env, to, a) !== 'gone') return;
    try { await registry(this.env, '/push-gone', { pagerId: m.pagerId, token: to.token }); }
    catch (error) { console.error('Dropping a gone device token failed', error instanceof Error ? error.message : 'unknown'); }
  }

  async fetch(request: Request): Promise<Response> {
    let response: Response;
    try { response = await this.handle(request); } catch (error) { response = refusal(error); }
    try { await this.afterwards(); } catch (error) { console.error('Agent housekeeping failed', error instanceof Error ? error.message : 'unknown'); }
    return response;
  }
  // Each call that carries a key checks it before reading its input: a wrong key is refused as unauthorized even when
  // the input is also invalid (I4). A call that sends something then checks its pager's state, last before writing.
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), [action, param] = url.pathname.split('/').filter(Boolean);
    // From the Worker, once the Registry has checked the number and recorded the agent on its pager.
    if (action === 'open') {
      const input = decode(Open, await body(request));
      const agentKey = token(), now = iso();
      const m: Meta = { agentId: input.agentId, pagerId: input.pagerId, app: input.app, project: input.project, ...(input.machine ? { machine: input.machine } : {}), createdAt: now, finishedAt: null, lastActivityAt: now, agentHash: await sha256(agentKey), phoneHash: input.phoneHash };
      this.tx(() => { if (this.meta()) throw C.refuse.invalid('This agent already exists.'); this.save(m); });
      // A pager deleted while this agent was connecting may have queued its erasure before it existed: checked once
      // it does, a gone pager erases it here.
      await this.pagerState(m, 'connect');
      const message = `Connected as a new agent on your owner's pager (${m.app}, project ${m.project}). Your owner's phone shows you as a new agent. Use this agentId and agentKey for every question in this piece of work; connecting again adds another agent.`;
      return json(decode(C.Connected, { agent: this.summary(m), agentKey, message }));
    }
    // From the Worker, once the Registry has deleted the pager.
    if (action === 'forget') { await this.forget(); return json({ ok: true }); }
    if (action === 'status') {
      const digest = await agentDigest(request);
      const m = this.tx(() => this.agent(digest)), s = await this.pagerState(m);
      return json(decode(C.AgentStatus, { agent: this.summary(m), pager: { on: s.state === 'on' } }));
    }
    if (action === 'ask') {
      const digest = await agentDigest(request);
      const m = this.tx(() => { const m = this.agent(digest); if (m.finishedAt) throw C.refuse.finished(); return m; });
      const question = decode(C.QuestionInput, await body(request));
      // Checked last before the write, so the switch is read as late as it can be.
      const push = await this.on(m);
      const asked = this.tx(() => {
        const m = this.agent(digest);
        if (this.openCount() >= C.MAX_OPEN_DECISIONS) throw C.refuse.tooMany();
        // The decision keeps each attachment's name, type and size; the bytes live in their own table.
        const { attachments, ...asked } = question;
        const d: C.Decision = { ...asked, ...(attachments ? { attachments: attachments.map(attachmentInfo) } : {}), decisionId: token(), status: 'open', askedAt: iso() };
        decode(C.Decision, d);
        this.ctx.storage.sql.exec('INSERT INTO proposals VALUES (?, ?)', d.decisionId, JSON.stringify(d));
        for (const a of attachments ?? []) {
          const bytes = 'text' in a ? new TextEncoder().encode(a.text) : base64Bytes(a.base64);
          if (!bytes) throw new Error('An attachment passed its schema but did not decode');
          this.ctx.storage.sql.exec('INSERT INTO attachments VALUES (?, ?, ?, ?)', d.decisionId, a.name, a.type, bytes.buffer);
        }
        this.touch(m); return { m, decisionId: d.decisionId };
      });
      await this.alertPhone(asked.m, push, asked.decisionId, 'decision', questionBody(question));
      return json({ decisionId: asked.decisionId });
    }
    if (action === 'read') {
      const digest = await agentDigest(request);
      const m = this.tx(() => this.agent(digest));
      const id = decode(C.Token, param), wait = url.searchParams.get('wait');
      const seconds = wait === null ? 0 : decode(Schema.Number.pipe(Schema.int(), Schema.between(1, C.ANSWER_WAIT_MAX_SECONDS)), Number(wait));
      await this.on(m);
      const until = Date.now() + seconds * 1000;
      for (;;) {
        const d = this.tx(() => { this.agent(digest); return this.decision(id); });
        // The pager may have been turned off during the wait: the answer is delivered only while it is on.
        if (d.answer) {
          await this.on(this.tx(() => this.agent(digest)));
          // Collected: the owner gets no warning for it, and the phone still waits for the acknowledgement (I6).
          this.tx(() => {
            this.ctx.storage.sql.exec('INSERT OR IGNORE INTO collections VALUES (?, ?)', id, iso());
            this.ctx.storage.sql.exec('DELETE FROM pickups WHERE decision_id=?', id);
          });
          return json({ status: 'answered', answer: d.answer });
        }
        if (Date.now() >= until) return json({ status: 'pending' });
        await new Promise(r => setTimeout(r, Math.min(100, until - Date.now())));
      }
    }
    if (action === 'ack') {
      const digest = await agentDigest(request);
      const m = this.tx(() => this.agent(digest));
      const id = decode(C.Token, param), input = decode(C.AcknowledgementInput, await body(request));
      const push = await this.on(m);
      const done = this.tx(() => {
        const m = this.agent(digest), d = this.decision(id);
        if (!d.answer) throw C.refuse.notAnswered();
        if (d.answer.answerId !== input.answerId) throw C.refuse.answerMismatch();
        if (d.acknowledgement) throw C.refuse.alreadyAcknowledged();
        const ack = decode(C.Acknowledgement, { ...input, decisionId: id, acknowledgedAt: iso() });
        this.ctx.storage.sql.exec('INSERT INTO acknowledgements VALUES (?, ?)', id, JSON.stringify(ack));
        this.touch(m); return { m, ack };
      });
      await this.alertPhone(done.m, push, id, 'acknowledgement', done.ack.nextSteps);
      return json(done.ack);
    }
    // Finishing tells the phone this agent is done; its decisions stay, and it asks nothing more.
    if (action === 'finish') {
      const digest = await agentDigest(request);
      const m = this.tx(() => this.agent(digest));
      await emptyBody(request);
      await this.on(m);
      return json(this.tx(() => {
        const m = this.agent(digest), finishedAt = m.finishedAt ?? iso();
        if (!m.finishedAt) this.save({ ...m, finishedAt, lastActivityAt: finishedAt });
        return { finishedAt };
      }));
    }
    // The phone reads everything while its pager is off: open decisions in ask order, answered ones newest first.
    if (action === 'inbox') {
      const digest = await phoneDigest(request);
      return json(this.tx(() => {
        const m = this.phone(digest);
        const all = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM proposals ORDER BY rowid').toArray().map(r => this.decision(r.id));
        const answered = all.filter(d => d.answer).sort((a, b) => Date.parse(b.answer?.sentAt ?? '') - Date.parse(a.answer?.sentAt ?? ''));
        return decode(C.AgentInbox, { agent: this.summary(m), open: all.filter(d => !d.answer), answered });
      }));
    }
    // One attachment of a decision, for the phone: its bytes, with the type the agent declared and the schema checked.
    if (action === 'file') {
      const digest = await phoneDigest(request);
      // Readable while the pager is off, never once it is deleted.
      await this.pagerState(this.tx(() => this.phone(digest)), 'phone');
      const id = decode(C.Token, param), name = decode(AttachmentName, url.pathname.split('/').filter(Boolean)[2] ?? '');
      const file = this.tx(() => {
        this.phone(digest);
        this.decision(id);
        const row = this.ctx.storage.sql.exec<{ type: string; data: ArrayBuffer }>('SELECT type, data FROM attachments WHERE decision_id=? AND name=?', id, name).toArray()[0];
        if (!row) throw C.refuse.unknownFile();
        return row;
      });
      return new Response(file.data, { headers: { 'content-type': file.type === 'text/markdown' ? 'text/markdown; charset=utf-8' : file.type } });
    }
    if (action === 'answer') {
      const digest = await phoneDigest(request);
      const m = this.tx(() => this.phone(digest));
      const id = decode(C.Token, param), input = decode(C.AnswerInput, await body(request));
      await this.on(m, 'phone');
      const canonical = JSON.stringify({ requestId: input.requestId, choice: input.choice.kind === 'option' ? { kind: 'option', number: input.choice.number } : { kind: 'feedback', text: input.choice.text } });
      return json(this.tx(() => {
        const m = this.phone(digest), d = this.decision(id);
        const stored = this.ctx.storage.sql.exec<{ input: string; request_id: string }>('SELECT input, request_id FROM answers WHERE decision_id=?', id).toArray()[0];
        if (d.answer && stored) {
          const receipt = decode(C.Receipt, { decisionId: id, answerId: d.answer.answerId, sentAt: d.answer.sentAt });
          if (stored.request_id === input.requestId && stored.input === canonical) return receipt;
          throw C.refuse.alreadyAnswered(receipt);
        }
        if (this.ctx.storage.sql.exec('SELECT 1 FROM answers WHERE request_id=?', input.requestId).toArray().length) throw C.refuse.invalid('requestId already belongs to another decision.');
        if (!C.acceptsChoice(d.card, input.choice)) throw C.refuse.invalid('Choose an option offered on this card.');
        const sentAt = iso();
        const answer = decode(C.Answer, { answerId: token(), decisionId: id, choice: input.choice, sentAt });
        decode(C.Decision, { ...d, status: input.choice.kind === 'feedback' ? 'feedback' : 'answered', answer });
        this.ctx.storage.sql.exec('INSERT INTO answers VALUES (?, ?, ?, ?)', id, input.requestId, canonical, JSON.stringify(answer));
        this.ctx.storage.sql.exec('INSERT INTO pickups VALUES (?, ?)', id, Date.parse(sentAt) + clocks.pickupMs);
        this.touch(m);
        return decode(C.Receipt, { decisionId: id, answerId: answer.answerId, sentAt });
      }));
    }
    throw C.refuse.notFound();
  }
}
