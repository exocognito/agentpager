import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import * as C from './contract.ts';
import { AttachmentIndex } from '../../contract/parts.ts';
import { body, decode, emptyBody, iso, json, refusal, sameDigest, sha256, token } from './shared.ts';
import { clocks, forward, type Env } from './env.ts';
import { alert, PushTarget, type Alert } from './push.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
// One agent: what connected to a pager with its number. Its key and its pager's phone key are stored only as SHA-256
// digests. Who asked, its project and its computer are its identity, an encrypted part only the phone opens. It has no
// lifetime: it lasts until its pager is deleted or housekeeping forgets it (clocks.idleMs).
const Meta = Schema.Struct({
  agentId: C.Token, pagerId: C.PagerId, identity: C.Sealed('identity'),
  createdAt: C.Timestamp, finishedAt: Schema.NullOr(C.Timestamp), lastActivityAt: C.Timestamp,
  agentHash: Digest, phoneHash: Digest,
});
type Meta = typeof Meta.Type;
const Open = Schema.Struct({ agentId: C.Token, pagerId: C.PagerId, phoneHash: Digest, identity: C.Sealed('identity') });
const PagerState = Schema.Struct({ state: Schema.Literal('on', 'off', 'gone'), push: Schema.optional(Schema.NullOr(PushTarget)) });
type PagerState = typeof PagerState.Type;
// Alerts are never delivered later than this.
const ALERT_EXPIRY_MS = 24 * 3_600_000;
// A warning that couldn't be sent (the Registry unreachable) is tried again this much later.
const WARN_RETRY_MS = 60_000;
// What an agent stored before the encryption switch (M5), readable: its tables. An object that still has any of them
// forgets everything at its first start on this code, before it serves anything (the release's exception,
// blueprint/milestones/M5-encrypt.md). Nothing stored since is in them, so this never touches it, and runs once.
const PRE_SWITCH_TABLES = ['agent', 'proposals', 'answers', 'acknowledgements', 'attachments', 'asks', 'pickups', 'collections', 'warnings'];

type DecisionRow = { id: string; card: string; asked_at: string };
type AnswerRow = { answer_id: string; request_id: string; part: string; sent_at: string };

async function keyDigest(value: string | null | undefined) { return value && Schema.is(C.Token)(value) ? sha256(value) : null; }
const agentDigest = (request: Request) => keyDigest(request.headers.get(C.AGENT_AUTH_HEADER)?.replace(/^Bearer /, ''));
const phoneDigest = (request: Request) => keyDigest(request.headers.get(C.PHONE_AUTH_HEADER));
const registry = (env: Env, path: string, data: unknown) => forward(env.REGISTRY, 'registry', path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
const Slot = Schema.String.pipe(Schema.pattern(/^[0-9]$/), Schema.compose(Schema.NumberFromString), Schema.compose(AttachmentIndex));

export class Agent {
  constructor(private ctx: DurableObjectState, private env: Env) {
    void ctx.blockConcurrencyWhile(async () => {
      const names = PRE_SWITCH_TABLES.map(n => `'${n}'`).join(', ');
      if (ctx.storage.sql.exec(`SELECT 1 FROM sqlite_master WHERE type='table' AND name IN (${names}) LIMIT 1`).toArray().length) {
        await ctx.storage.deleteAlarm();
        await ctx.storage.deleteAll();
      }
      this.schema();
    });
  }
  // What one agent stores, all of it written once and never changed:
  //   agent_v3            the agent (Meta), with its identity part
  //   decisions_v3        each decision: its card part, its alert's preview part, and the digest its agent sent with it
  //                       (C.AskDigest), so asking the same card again with that request id finds it
  //   attachments_v3      each attachment's part, by its slot in the card's list
  //   answers_v3          the answer part, with the phone's request id, so its resend is the same request (I5)
  //   acknowledgements_v3 the acknowledgement part
  //   pickups_v3, collections_v3, warnings_v3   when an answer is due its not-picked-up warning, was collected, was warned
  private schema() {
    this.tx(() => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS agent_v3 (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS decisions_v3 (id TEXT PRIMARY KEY, card TEXT NOT NULL, preview TEXT NOT NULL, digest TEXT NOT NULL, asked_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attachments_v3 (decision_id TEXT NOT NULL REFERENCES decisions_v3(id), slot INTEGER NOT NULL, part TEXT NOT NULL, PRIMARY KEY (decision_id, slot));
        CREATE TABLE IF NOT EXISTS answers_v3 (decision_id TEXT PRIMARY KEY REFERENCES decisions_v3(id), request_id TEXT NOT NULL UNIQUE, answer_id TEXT NOT NULL, part TEXT NOT NULL, sent_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS acknowledgements_v3 (decision_id TEXT PRIMARY KEY REFERENCES answers_v3(decision_id), part TEXT NOT NULL, acknowledged_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS pickups_v3 (decision_id TEXT PRIMARY KEY REFERENCES answers_v3(decision_id), due INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS collections_v3 (decision_id TEXT PRIMARY KEY REFERENCES answers_v3(decision_id), at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS warnings_v3 (decision_id TEXT PRIMARY KEY REFERENCES answers_v3(decision_id), at TEXT NOT NULL);
        CREATE TRIGGER IF NOT EXISTS decision_immutable BEFORE UPDATE ON decisions_v3 BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
        CREATE TRIGGER IF NOT EXISTS attachment_immutable BEFORE UPDATE ON attachments_v3 BEGIN SELECT RAISE(ABORT,'immutable attachment'); END;
        CREATE TRIGGER IF NOT EXISTS answer_immutable BEFORE UPDATE ON answers_v3 BEGIN SELECT RAISE(ABORT,'immutable answer'); END;
        CREATE TRIGGER IF NOT EXISTS acknowledgement_immutable BEFORE UPDATE ON acknowledgements_v3 BEGIN SELECT RAISE(ABORT,'immutable acknowledgement'); END;
        CREATE TRIGGER IF NOT EXISTS collection_immutable BEFORE UPDATE ON collections_v3 BEGIN SELECT RAISE(ABORT,'immutable collection'); END;
        CREATE TRIGGER IF NOT EXISTS warning_immutable BEFORE UPDATE ON warnings_v3 BEGIN SELECT RAISE(ABORT,'immutable warning'); END;`);
    });
  }
  private meta(): Meta | null {
    const raw = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM agent_v3 WHERE id=1').toArray()[0]?.json;
    return raw ? decode(Meta, JSON.parse(raw)) : null;
  }
  private save(m: Meta) { decode(Meta, m); this.ctx.storage.sql.exec('INSERT INTO agent_v3 VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json', JSON.stringify(m)); }
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
    const due = this.ctx.storage.sql.exec<{ due: number | null }>('SELECT min(due) AS due FROM pickups_v3').toArray()[0]?.due ?? null;
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
        this.ctx.storage.sql.exec('UPDATE pickups_v3 SET due = ? WHERE due <= ?', now + WARN_RETRY_MS, now);
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
  // and on the decision row, that AgentPager can't reach the agent. The alert resends the decision's preview, which
  // names who asked, its computer, its project and the question; the phone words it as the warning. An unreachable
  // Registry leaves the queue as it was.
  private async warn(m: Meta) {
    const due = () => this.ctx.storage.sql.exec<{ decision_id: string }>('SELECT decision_id FROM pickups_v3 WHERE due <= ?', Date.now()).toArray().map(r => r.decision_id);
    if (!due().length) return;
    let s: PagerState;
    try { s = await this.pagerState(m); } catch (error) { if (error instanceof C.Refusal) return; throw error; }
    // Read again: an agent may have collected one while the pager's state was asked, and collecting dequeues it.
    // While the pager is off no agent can read an answer, so there is nothing to warn about.
    const on = s.state === 'on';
    const warned = this.tx(() => {
      const ids = due(), at = iso();
      for (const id of ids) {
        this.ctx.storage.sql.exec('DELETE FROM pickups_v3 WHERE decision_id=?', id);
        if (on) this.ctx.storage.sql.exec('INSERT OR IGNORE INTO warnings_v3 VALUES (?, ?)', id, at);
      }
      return on ? ids : [];
    });
    for (const id of warned) await this.alertPhone(m, s.push ?? null, id, 'warning', this.preview(id));
  }

  private openCount() { return this.ctx.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM decisions_v3 WHERE id NOT IN (SELECT decision_id FROM answers_v3)').toArray()[0].n; }
  private summary(m: Meta): C.Agent {
    return decode(C.Agent, { agentId: m.agentId, identity: m.identity, createdAt: m.createdAt, finishedAt: m.finishedAt, lastActivityAt: m.lastActivityAt, openCount: this.openCount() });
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
  private preview(id: string) {
    const row = this.ctx.storage.sql.exec<{ preview: string }>('SELECT preview FROM decisions_v3 WHERE id=?', id).toArray()[0];
    if (!row) throw C.refuse.unknownDecision();
    return row.preview;
  }
  // A decision as the phone and the agent read it: its parts as stored, and what the service knows of them.
  private decision(id: string): C.Decision {
    const d = this.ctx.storage.sql.exec<DecisionRow>('SELECT id, card, asked_at FROM decisions_v3 WHERE id=?', id).toArray()[0];
    if (!d) throw C.refuse.unknownDecision();
    const attachments = this.ctx.storage.sql.exec<{ part: string }>('SELECT part FROM attachments_v3 WHERE decision_id=? ORDER BY slot', id).toArray().map(r => ({ bytes: C.sealedBytes(r.part) }));
    const asked = { decisionId: id, card: d.card, attachments, askedAt: d.asked_at };
    const a = this.ctx.storage.sql.exec<AnswerRow>('SELECT answer_id, request_id, part, sent_at FROM answers_v3 WHERE decision_id=?', id).toArray()[0];
    if (!a) return decode(C.Decision, { ...asked, status: 'open' });
    const answer: C.Answer = { answerId: a.answer_id, decisionId: id, requestId: a.request_id, answer: a.part, sentAt: a.sent_at };
    const ack = this.ctx.storage.sql.exec<{ part: string; acknowledged_at: string }>('SELECT part, acknowledged_at FROM acknowledgements_v3 WHERE decision_id=?', id).toArray()[0];
    const at = (table: 'collections_v3' | 'warnings_v3') => this.ctx.storage.sql.exec<{ at: string }>(`SELECT at FROM ${table} WHERE decision_id=?`, id).toArray()[0]?.at;
    const collectedAt = at('collections_v3'), warnedAt = at('warnings_v3');
    return decode(C.Decision, {
      ...asked, status: ack ? 'acknowledged' : 'answered', answer, ...(collectedAt ? { collectedAt } : {}), ...(warnedAt ? { warnedAt } : {}),
      ...(ack ? { acknowledgement: { decisionId: id, answerId: a.answer_id, acknowledgement: ack.part, acknowledgedAt: ack.acknowledged_at } } : {}),
    });
  }
  private touch(m: Meta) { this.save({ ...m, lastActivityAt: iso() }); }
  // An alert goes to the pager's phone when it gave a token, with the preview the agent sealed. Apple's refusal of a
  // token drops it.
  private async alertPhone(m: Meta, to: PushTarget | null, decisionId: string, kind: Alert['kind'], preview: string) {
    if (!to) return;
    const a: Alert = { kind, preview, expiresAt: iso(Date.now() + ALERT_EXPIRY_MS), collapseId: decisionId, pagerId: m.pagerId, agentId: m.agentId, decisionId };
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
    const url = new URL(request.url), [action, param, slot] = url.pathname.split('/').filter(Boolean);
    // From the Worker, once the Registry has checked the number and recorded the agent on its pager.
    if (action === 'open') {
      const input = decode(Open, await body(request));
      const agentKey = token(), now = iso();
      const m: Meta = { agentId: input.agentId, pagerId: input.pagerId, identity: input.identity, createdAt: now, finishedAt: null, lastActivityAt: now, agentHash: await sha256(agentKey), phoneHash: input.phoneHash };
      this.tx(() => { if (this.meta()) throw C.refuse.invalid('This agent already exists.'); this.save(m); });
      // A pager deleted while this agent was connecting may have queued its erasure before it existed: checked once
      // it does, a gone pager erases it here.
      await this.pagerState(m, 'connect');
      const message = 'Connected as a new agent on your owner\'s pager. Your owner\'s phone shows you as a new agent. Use this agentId and agentKey for every question in this piece of work; connecting again adds another agent.';
      return json(decode(C.Connected, { agent: this.summary(m), agentKey, message }));
    }
    // From the Worker, once the Registry has deleted the pager, or from the Registry at the encryption switch.
    if (action === 'forget') { await this.forget(); return json({ ok: true }); }
    if (action === 'status') {
      const digest = await agentDigest(request);
      const m = this.tx(() => this.agent(digest)), s = await this.pagerState(m);
      return json(decode(C.AgentStatus, { agent: this.summary(m), pager: { on: s.state === 'on' } }));
    }
    if (action === 'ask') {
      const digest = await agentDigest(request);
      const m = this.tx(() => { const m = this.agent(digest); if (m.finishedAt) throw C.refuse.finished(); return m; });
      const input = decode(C.AskInput, await body(request));
      // The decision's id comes from this agent's id and the request id, so it is this agent's alone, and its parts are
      // bound to it: the command sealed them for this id.
      const decisionId = await C.decisionIdOf(m.agentId, input.requestId);
      // Checked last before the write, so the switch is read as late as it can be.
      const push = await this.on(m);
      const asked = this.tx(() => {
        const m = this.agent(digest);
        // The same card again (its reply was lost) finds its decision, which stays as first stored: nothing is stored
        // and no alert goes, even when this agent's open decisions are now at their limit. Another card is refused.
        const known = this.ctx.storage.sql.exec<{ digest: string }>('SELECT digest FROM decisions_v3 WHERE id=?', decisionId).toArray()[0];
        if (known?.digest === input.digest) return { m, again: true };
        if (known) throw C.refuse.requestIdTaken();
        if (this.openCount() >= C.MAX_OPEN_DECISIONS) throw C.refuse.tooMany();
        this.ctx.storage.sql.exec('INSERT INTO decisions_v3 VALUES (?, ?, ?, ?, ?)', decisionId, input.card, input.preview, input.digest, iso());
        (input.attachments ?? []).forEach((part, slot) => this.ctx.storage.sql.exec('INSERT INTO attachments_v3 VALUES (?, ?, ?)', decisionId, slot, part));
        this.touch(m); return { m, again: false };
      });
      if (!asked.again) await this.alertPhone(asked.m, push, decisionId, 'decision', input.preview);
      return json(decode(C.Asked, { decisionId }));
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
            this.ctx.storage.sql.exec('INSERT OR IGNORE INTO collections_v3 VALUES (?, ?)', id, iso());
            this.ctx.storage.sql.exec('DELETE FROM pickups_v3 WHERE decision_id=?', id);
          });
          return json(decode(C.AnswerStatus, { status: 'answered', answer: d.answer }));
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
        const acknowledgedAt = iso();
        this.ctx.storage.sql.exec('INSERT INTO acknowledgements_v3 VALUES (?, ?, ?)', id, input.acknowledgement, acknowledgedAt);
        this.touch(m);
        return { m, ack: decode(C.Acknowledgement, { decisionId: id, answerId: input.answerId, acknowledgement: input.acknowledgement, acknowledgedAt }) };
      });
      await this.alertPhone(done.m, push, id, 'acknowledgement', input.preview);
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
        const all = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM decisions_v3 ORDER BY rowid').toArray().map(r => this.decision(r.id));
        const answered = all.filter(d => d.answer).sort((a, b) => Date.parse(b.answer?.sentAt ?? '') - Date.parse(a.answer?.sentAt ?? ''));
        return decode(C.AgentInbox, { agent: this.summary(m), open: all.filter(d => !d.answer), answered });
      }));
    }
    // One attachment of a decision, for the phone: its encrypted part, by its slot in the card's list.
    if (action === 'file') {
      const digest = await phoneDigest(request);
      // Readable while the pager is off, never once it is deleted.
      await this.pagerState(this.tx(() => this.phone(digest)), 'phone');
      const id = decode(C.Token, param), at = decode(Slot, slot ?? '');
      const part = this.tx(() => {
        this.phone(digest);
        this.decision(id);
        const row = this.ctx.storage.sql.exec<{ part: string }>('SELECT part FROM attachments_v3 WHERE decision_id=? AND slot=?', id, at).toArray()[0];
        if (!row) throw C.refuse.unknownFile();
        return row.part;
      });
      return new Response(part, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (action === 'answer') {
      const digest = await phoneDigest(request);
      const m = this.tx(() => this.phone(digest));
      const id = decode(C.Token, param), input = decode(C.AnswerInput, await body(request));
      await this.on(m, 'phone');
      return json(this.tx(() => {
        const m = this.phone(digest), d = this.decision(id);
        // The phone resends an answer after a lost reply as the same request: the same request id and the same part.
        if (d.answer) {
          const receipt = decode(C.Receipt, { decisionId: id, answerId: d.answer.answerId, sentAt: d.answer.sentAt });
          if (d.answer.requestId === input.requestId && d.answer.answer === input.answer) return receipt;
          throw C.refuse.alreadyAnswered(receipt);
        }
        if (this.ctx.storage.sql.exec('SELECT 1 FROM answers_v3 WHERE request_id=?', input.requestId).toArray().length) throw C.refuse.invalid('requestId already belongs to another decision.');
        const sentAt = iso(), answerId = token();
        this.ctx.storage.sql.exec('INSERT INTO answers_v3 VALUES (?, ?, ?, ?, ?)', id, input.requestId, answerId, input.answer, sentAt);
        this.ctx.storage.sql.exec('INSERT INTO pickups_v3 VALUES (?, ?)', id, Date.parse(sentAt) + clocks.pickupMs);
        this.touch(m);
        return decode(C.Receipt, { decisionId: id, answerId, sentAt });
      }));
    }
    throw C.refuse.notFound();
  }
}
