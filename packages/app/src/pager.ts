import type { DurableObjectState, SqlStorageValue } from '@cloudflare/workers-types';
import { Either, ParseResult, Schema } from 'effect';
import * as C from './contract.ts';
import { AttachmentIndex } from '../../contract/parts.ts';
import { body, decode, emptyBody, iso, json, refusal, sameDigest, sha256, token } from './shared.ts';
import { clocks, forward, type Env } from './env.ts';
import { alert, PushTarget, type Alert } from './push.ts';
import { AgentExport, AttachmentPart, Digest, Fingerprint, RegistryExport } from './move.ts';
import { Waits, type Reach } from './wake.ts';

// One pager's store, one per pager, named by its pager id: the pager's row, its agents and their decisions. Every call
// on the pager is handled here, one after the other, so turning the pager off and any call on it never interleave:
// each call checks the switch and writes in one transaction (I17.2, blueprint/areas/1-pagers.md).
//
// Before M6 the pager's row lived in the Registry and each agent's rows in that agent's own store (registry.ts,
// agent.ts). The first call on a pager moves them here, once (move): it copies every agent's rows, then writes the
// pager's row with the mark that says it is done, in one transaction. Nothing here is read without that mark, so a
// move cut off by a restart or a deploy shows nothing, and the next call clears what it left and starts again. The old stores keep what they
// held, unused; a later release removes them. What the old stores still hold of a pager deleted here, or of an agent
// forgotten here, is erased from them (erase_v4), so nothing deleted stays anywhere.
//
// What it stores:
//   moved_v4            that this store holds its pager, which: moved from the Registry (1), or made by the phone since
//                       (0); never deleted, so the Registry is never read for it again
//   pager_v4            the pager: its public key, its phone key as a digest, its switch, auto-off, off-since and where
//                       its phone gets alerts. No name: that lives only on the phone
//   agents_v4           each agent, in connect order: its identity part, its key and its pager's phone key as digests,
//                       when it connected, finished and was last active, whether it came from an old store, and how long
//                       its pager has been off since its last activity (off_ms), which its 30-day clock doesn't count
//   decisions_v4        each decision, by its agent: its card part, its alert's preview part, and the digest its agent
//                       sent with it (C.AskDigest), so asking the same card again with that request id finds it
//   attachments_v4      each attachment's part, by its slot in the card's list
//   answers_v4          the answer part, with the phone's request id, so its resend is the same request (I5)
//   acknowledgements_v4 the acknowledgement part
//   pickups_v4, collections_v4, warnings_v4   when an answer is due its not-picked-up warning, was picked up (pickUp),
//                       was warned
//   erase_v4            what an old store still holds of a pager or agent this store has deleted, still to erase there
// Decisions, attachments, answers, acknowledgements, collections and warnings are written once and never changed.
//
// A decision closes unanswered when its agent finishes before it has an answer (B25.13, blueprint/areas/2-agents.md),
// and nothing more is stored for it: the agent's finish is the mark. Every answer is stored in a transaction that checks
// the agent hasn't finished, and the finish is one transaction, so a finished agent's decisions with no answer are
// exactly those its finish closed, at the time it finished (closure, below). An answer that landed first stays the
// answer, and its agent can still collect and acknowledge it. An agent that finished before M6 left its unanswered
// decisions open; they read as closed too, from when it finished, as B25.13 now holds for every finished agent.
//
// An agent's wait for its answer is held here, in memory, and woken by what it waits for (wake.ts).

const Create = Schema.Struct({ fingerprint: Fingerprint, publicKey: C.PublicKey, phoneHash: Digest, autoOff: C.AutoOff });
const Connect = Schema.Struct({ agentId: C.Token, fingerprint: Fingerprint, identity: C.Sealed('identity') });
const Nudge = Schema.Struct({ agentId: C.Token });
const Slot = Schema.String.pipe(Schema.pattern(/^[0-9]$/), Schema.compose(Schema.NumberFromString), Schema.compose(AttachmentIndex));
// Alerts are never delivered later than this.
const ALERT_EXPIRY_MS = 24 * 3_600_000;
// An old store that couldn't be reached to erase is tried again this much later.
const ERASE_RETRY_MS = 60_000;
// agents_v4's last column, as made and as added to a store made before it (upgrade): how long, in ms, the agent's pager
// has been off since its last activity.
const OFF_MS = 'off_ms INTEGER NOT NULL DEFAULT 0 CHECK(off_ms >= 0)';

type PagerRow = { fingerprint: string; public_key: string; phone_hash: string; enabled: number; auto_off: string; off_at: number | null; off_since: number | null; push: string | null; created_at: number };
type AgentRow = { agent_id: string; identity: string; agent_hash: string; phone_hash: string; created_at: string; finished_at: string | null; last_activity_at: string; moved: number; off_ms: number };
type MovedRow = { pager_id: string; at: number; from_registry: number };
type AnswerRow = { answer_id: string; request_id: string; part: string; sent_at: string };
type Erase = { store: 'agent' | 'listing' | 'pager'; id: string };

async function keyDigest(value: string | null | undefined) { return value && Schema.is(C.Token)(value) ? sha256(value) : null; }
const agentDigest = (request: Request) => keyDigest(request.headers.get(C.AGENT_AUTH_HEADER)?.replace(/^Bearer /, ''));
// Whether an agent's call comes from a command that says when it has received an answer (C.PICKUP_PROTOCOL): then only
// that, or the agent's acknowledgement, picks the answer up (B32.12, blueprint/areas/2-agents.md). The protocol in the
// call's client header tells, since saying what a client speaks is that header's job and every command sends it; the
// Worker has already refused one too old. The build it names is a commit, which has no order. The m6.1 command and
// every one before it say 2, so they keep the rule they were built for: their read picks the answer up. No read at 3
// does, so a read that never says it has the answer, such as a watcher's waiting to wake its agent, can't silence the
// owner's warning (B5.13).
const confirmsPickup = (request: Request) => (C.readClientVersion(request.headers.get(C.CLIENT_HEADER))?.protocol ?? 0) >= C.PICKUP_PROTOCOL;
const phoneDigest = (request: Request) => keyDigest(request.headers.get(C.PHONE_AUTH_HEADER));
const registry = (env: Env, path: string, data: unknown) => forward(env.REGISTRY, 'registry', path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
// What an old store hands over is decoded before use. A failure names only the paths that failed, never a value, since
// what it read holds key digests.
function handed<A, I>(schema: Schema.Schema<A, I>, value: unknown, from: string): A {
  const result = Schema.decodeUnknownEither(schema)(value);
  if (Either.isRight(result)) return result.right;
  const paths = ParseResult.ArrayFormatter.formatErrorSync(result.left).map(i => i.path.map(String).join('.') || '(the whole reply)');
  throw new Error(`The move can't read what ${from} holds, at ${[...new Set(paths)].join(', ')}.`);
}

export class Pager {
  // The move under way in this instance, which every call waits for.
  private moving: Promise<boolean> | null = null;
  // The agents' waits for their answers, held while their requests are open.
  private waits = new Waits();
  constructor(private ctx: DurableObjectState, private env: Env) {
    void ctx.blockConcurrencyWhile(async () => {
      this.upgrade();
      // An erasure queued just before a restart, whose alarm wasn't set, is tried from this start.
      if (this.movedRow() && this.sql('SELECT 1 FROM erase_v4 LIMIT 1').length && await ctx.storage.getAlarm() === null) await ctx.storage.setAlarm(Date.now());
    });
  }
  // Made in the transaction that first writes here: the move's, or the phone's making the pager. Until then this store
  // holds nothing, so a call naming a pager that doesn't exist stores nothing.
  private schema() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS moved_v4 (id INTEGER PRIMARY KEY CHECK(id=1), pager_id TEXT NOT NULL, at INTEGER NOT NULL, from_registry INTEGER NOT NULL CHECK(from_registry IN (0, 1)));
      CREATE TABLE IF NOT EXISTS pager_v4 (id INTEGER PRIMARY KEY CHECK(id=1), fingerprint TEXT NOT NULL, public_key TEXT NOT NULL, phone_hash TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)), auto_off TEXT NOT NULL, off_at INTEGER, off_since INTEGER, push TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS agents_v4 (agent_id TEXT PRIMARY KEY, identity TEXT NOT NULL, agent_hash TEXT NOT NULL, phone_hash TEXT NOT NULL,
        created_at TEXT NOT NULL, finished_at TEXT, last_activity_at TEXT NOT NULL, moved INTEGER NOT NULL CHECK(moved IN (0, 1)), ${OFF_MS});
      CREATE TABLE IF NOT EXISTS decisions_v4 (agent_id TEXT NOT NULL REFERENCES agents_v4(agent_id), decision_id TEXT NOT NULL, card TEXT NOT NULL, preview TEXT NOT NULL,
        digest TEXT NOT NULL, asked_at TEXT NOT NULL, PRIMARY KEY (agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS attachments_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, slot INTEGER NOT NULL, part TEXT NOT NULL,
        PRIMARY KEY (agent_id, decision_id, slot), FOREIGN KEY (agent_id, decision_id) REFERENCES decisions_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS answers_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, request_id TEXT NOT NULL, answer_id TEXT NOT NULL, part TEXT NOT NULL,
        sent_at TEXT NOT NULL, PRIMARY KEY (agent_id, decision_id), UNIQUE (agent_id, request_id), FOREIGN KEY (agent_id, decision_id) REFERENCES decisions_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS acknowledgements_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, part TEXT NOT NULL, acknowledged_at TEXT NOT NULL,
        PRIMARY KEY (agent_id, decision_id), FOREIGN KEY (agent_id, decision_id) REFERENCES answers_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS pickups_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, due INTEGER NOT NULL,
        PRIMARY KEY (agent_id, decision_id), FOREIGN KEY (agent_id, decision_id) REFERENCES answers_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS collections_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, at TEXT NOT NULL,
        PRIMARY KEY (agent_id, decision_id), FOREIGN KEY (agent_id, decision_id) REFERENCES answers_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS warnings_v4 (agent_id TEXT NOT NULL, decision_id TEXT NOT NULL, at TEXT NOT NULL,
        PRIMARY KEY (agent_id, decision_id), FOREIGN KEY (agent_id, decision_id) REFERENCES answers_v4(agent_id, decision_id));
      CREATE TABLE IF NOT EXISTS erase_v4 (store TEXT NOT NULL CHECK(store IN ('agent', 'listing', 'pager')), id TEXT NOT NULL, due INTEGER NOT NULL, PRIMARY KEY (store, id));
      CREATE TRIGGER IF NOT EXISTS decision_immutable_v4 BEFORE UPDATE ON decisions_v4 BEGIN SELECT RAISE(ABORT,'immutable decision'); END;
      CREATE TRIGGER IF NOT EXISTS attachment_immutable_v4 BEFORE UPDATE ON attachments_v4 BEGIN SELECT RAISE(ABORT,'immutable attachment'); END;
      CREATE TRIGGER IF NOT EXISTS answer_immutable_v4 BEFORE UPDATE ON answers_v4 BEGIN SELECT RAISE(ABORT,'immutable answer'); END;
      CREATE TRIGGER IF NOT EXISTS acknowledgement_immutable_v4 BEFORE UPDATE ON acknowledgements_v4 BEGIN SELECT RAISE(ABORT,'immutable acknowledgement'); END;
      CREATE TRIGGER IF NOT EXISTS collection_immutable_v4 BEFORE UPDATE ON collections_v4 BEGIN SELECT RAISE(ABORT,'immutable collection'); END;
      CREATE TRIGGER IF NOT EXISTS warning_immutable_v4 BEFORE UPDATE ON warnings_v4 BEGIN SELECT RAISE(ABORT,'immutable warning'); END;`);
  }
  // A store made by M6's first build, before the clock paused while the pager is off, has no off_ms. Each of its agents
  // gets 0: that build kept no record of time off, so each keeps the date it had, 30 days after its last activity; and
  // if its pager is off now, the time since it turned off is added when it turns on (resume), as for any pager. Run
  // before anything is served, so every call and alarm finds the column.
  private upgrade() {
    if (!this.sql("SELECT 1 FROM sqlite_master WHERE type='table' AND name='agents_v4'").length) return;
    if (this.sql<{ name: string }>('PRAGMA table_info(agents_v4)').some(c => c.name === 'off_ms')) return;
    this.ctx.storage.sql.exec(`ALTER TABLE agents_v4 ADD COLUMN ${OFF_MS}`);
  }
  private sql<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: unknown[]) { return this.ctx.storage.sql.exec<T>(query, ...bindings).toArray(); }
  private tx<A>(run: () => A): A { return this.ctx.storage.transactionSync(run); }
  private movedRow(): MovedRow | undefined {
    if (!this.sql("SELECT 1 FROM sqlite_master WHERE type='table' AND name='moved_v4'").length) return undefined;
    return this.sql<MovedRow>('SELECT pager_id, at, from_registry FROM moved_v4 WHERE id=1')[0];
  }
  // The pager, with auto-off landed if it has come due: in the same state as the switch, off since the time it was
  // due. Every check of the switch reads it here, inside the transaction that writes, so a call held across the
  // deadline, such as a wait, sees it.
  private pagerRow(): PagerRow | undefined {
    this.ctx.storage.sql.exec('UPDATE pager_v4 SET enabled=0, off_since=off_at, off_at=NULL WHERE enabled=1 AND off_at IS NOT NULL AND off_at <= ?', Date.now());
    return this.sql<PagerRow>('SELECT * FROM pager_v4 WHERE id=1')[0];
  }
  private agentRow(agentId: string): AgentRow | undefined { return this.sql<AgentRow>('SELECT * FROM agents_v4 WHERE agent_id=?', agentId)[0]; }
  private agentRows(): AgentRow[] { return this.sql<AgentRow>('SELECT * FROM agents_v4 ORDER BY rowid'); }

  // The move: the first call on this pager after M6's deploy, whatever it is, takes the pager's row from the Registry
  // and each agent's rows from that agent's store. It copies the agents' rows here one agent at a time, and each
  // attachment's part on its own, so it never holds more than one agent's rows and one part in memory; then it writes
  // the pager's row and the mark that it is done, in one transaction. Until that transaction nothing here is read: every
  // call waits for the move, and the clocks wait for the mark. So a move cut off at any point shows nothing, and the
  // next call clears what it copied and starts again. Once done it never runs again for this pager, even after the
  // pager is deleted, so nothing an old store still holds can come back. An agent the Registry lists whose store has forgotten it isn't
  // moved. A pager the Registry doesn't have (never made, or deleted before M6) isn't here, and nothing is written
  // for it: its calls are refused as for a pager that doesn't exist, and only the phone's making it writes here.
  private async ready(pagerId: string): Promise<boolean> {
    for (;;) {
      const done = this.movedRow();
      if (done) { if (done.pager_id !== pagerId) throw new Error('This pager store was asked about another pager.'); return true; }
      this.moving ??= this.move(pagerId).finally(() => { this.moving = null; });
      if (!await this.moving) return false;
    }
  }
  // Whether the pager is here now.
  private async move(pagerId: string): Promise<boolean> {
    const listed = await registry(this.env, '/export', { pagerId });
    if (!listed.ok) throw new Error(`The Registry refused the move: ${listed.status}.`);
    const from = handed(RegistryExport, await listed.json(), 'the Registry');
    if (!from.pager) return false;
    const p = from.pager;
    // What a move cut off here copied: never read, since it has no mark, and cleared before this one starts.
    this.tx(() => { this.schema(); this.clear(); });
    let agents = 0, decisions = 0;
    for (const agentId of from.agents) {
      const reply = await forward(this.env.AGENT, agentId, '/export', { method: 'POST', headers: {} });
      if (!reply.ok) throw new Error(`An agent's store refused the move: ${reply.status}.`);
      const x = handed(AgentExport, await reply.json(), 'an agent\'s store');
      if (!x.agent) continue;
      const m = x.agent;
      if (m.agentId !== agentId || m.pagerId !== pagerId) throw new Error('An agent\'s store names another agent or pager than the Registry lists it under.');
      this.tx(() => {
        const put = (query: string, ...values: unknown[]) => this.ctx.storage.sql.exec(query, agentId, ...values);
        put('INSERT INTO agents_v4 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)', m.identity, m.agentHash, m.phoneHash, m.createdAt, m.finishedAt, m.lastActivityAt);
        for (const d of x.decisions) put('INSERT INTO decisions_v4 VALUES (?, ?, ?, ?, ?, ?)', d.decisionId, d.card, d.preview, d.digest, d.askedAt);
        for (const a of x.answers) put('INSERT INTO answers_v4 VALUES (?, ?, ?, ?, ?, ?)', a.decisionId, a.requestId, a.answerId, a.part, a.sentAt);
        for (const a of x.acknowledgements) put('INSERT INTO acknowledgements_v4 VALUES (?, ?, ?, ?)', a.decisionId, a.part, a.acknowledgedAt);
        for (const a of x.pickups) put('INSERT INTO pickups_v4 VALUES (?, ?, ?)', a.decisionId, a.due);
        for (const a of x.collections) put('INSERT INTO collections_v4 VALUES (?, ?, ?)', a.decisionId, a.at);
        for (const a of x.warnings) put('INSERT INTO warnings_v4 VALUES (?, ?, ?)', a.decisionId, a.at);
      });
      for (const a of x.attachments) {
        const part = await forward(this.env.AGENT, agentId, `/export/${a.decisionId}/${a.slot}`, { method: 'POST', headers: {} });
        if (!part.ok) throw new Error(`An agent's store refused an attachment to the move: ${part.status}.`);
        this.ctx.storage.sql.exec('INSERT INTO attachments_v4 VALUES (?, ?, ?, ?)', agentId, a.decisionId, a.slot, handed(AttachmentPart, await part.text(), 'an agent\'s store'));
      }
      agents++; decisions += x.decisions.length;
    }
    // The move shows only now: the pager's row and the mark, together.
    this.tx(() => {
      this.ctx.storage.sql.exec('INSERT INTO pager_v4 VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p.fingerprint, p.publicKey, p.phoneHash, p.enabled, p.autoOff, p.offAt, p.offSince, p.push, p.createdAt);
      this.ctx.storage.sql.exec('INSERT INTO moved_v4 VALUES (1, ?, ?, 1)', pagerId, Date.now());
    });
    console.log(`Moved a pager into its own store: ${agents} agents, ${decisions} decisions.`);
    return true;
  }
  // Every row but the mark. Only for a store without its mark, which no call has read.
  private clear() {
    for (const table of ['warnings_v4', 'collections_v4', 'pickups_v4', 'acknowledgements_v4', 'answers_v4', 'attachments_v4', 'decisions_v4', 'agents_v4', 'pager_v4', 'erase_v4']) this.ctx.storage.sql.exec(`DELETE FROM ${table}`);
  }

  // At every call and every alarm, before anything else: auto-off lands if it has come due (pagerRow), and an agent
  // whose 30-day clock has run out is forgotten, and its pager stops listing it. So no call, the move's first included,
  // finds an agent whose time has come. Only while the pager is on: an off pager's agents are kept however long it
  // stays off (I17.6, B22.4).
  // Whether it forgot anyone.
  private housekeep(): boolean {
    const now = Date.now();
    const forgotten = this.tx(() => {
      if (this.pagerRow()?.enabled !== 1) return [];
      const idle = this.agentRows().filter(a => now >= this.forgetAt(a));
      for (const a of idle) this.forgetAgent(a);
      return idle.map(a => a.agent_id);
    });
    for (const agentId of forgotten) this.wake({ agentId });
    return forgotten.length > 0;
  }
  // When the agent is forgotten if its pager stays on and the agent does nothing more: once its pager has been on for
  // 30 days since its last activity (I17.6). Each stretch the pager spends off since then is added when it turns on
  // again (resume), so turning off pauses the clock and turning on resumes it. While the pager is off nothing is
  // forgotten (housekeep).
  private forgetAt(a: AgentRow) { return Date.parse(a.last_activity_at) + clocks.idleMs + a.off_ms; }
  // Turned on: each agent's clock resumes where turning off paused it. The time the pager was off, from when the switch
  // turned it off or, for auto-off, from when it was due (pagerRow), is added to each agent's off_ms. An agent last
  // active after the pager turned off, which only a call M5 let through as its pager turned off can be, gets only the
  // time since its last activity. Last activity stays as it was. In the transaction that turns the pager on.
  private resume(row: PagerRow, now: number) {
    if (row.off_since === null) throw new Error('An off pager without the time it turned off.');
    for (const a of this.agentRows()) {
      const off = now - Math.max(row.off_since, Date.parse(a.last_activity_at));
      if (off > 0) this.ctx.storage.sql.exec('UPDATE agents_v4 SET off_ms=off_ms+? WHERE agent_id=?', off, a.agent_id);
    }
  }
  // Every write that ends what a wait waits for calls this once it is done, for the waits it reaches: a decision's
  // answer stored, its agent forgotten, or its pager's switch or auto-off changed or the pager deleted. Each wait it
  // reaches looks again (read, below).
  private wake(reach: Reach) { this.waits.wake(reach); }
  // Called in the same turn as the transaction that queued an erasure, before anything else is awaited, so the erasure
  // is tried again a minute later even if this call is cut off before it is done. The call's own end sets the alarm
  // to whatever is due first.
  private armErase() { return this.ctx.storage.setAlarm(Date.now() + ERASE_RETRY_MS); }
  // Turned on now: it turns off by itself after its auto-off time, if it has one.
  private offAt(autoOff: C.AutoOff, now: number) { return autoOff === 'never' ? null : now + clocks.autoOffMs(autoOff); }
  private pager(pagerId: string, row: PagerRow): C.Pager {
    return decode(C.Pager, { pagerId, on: row.enabled === 1, autoOff: row.auto_off, offAt: row.off_at === null ? null : iso(row.off_at), offSince: row.off_since === null ? null : iso(row.off_since), createdAt: iso(row.created_at) });
  }
  // Only the pager's own phone key reads or changes it. A missing or malformed key is refused before anything is
  // looked up, so it never learns whether the pager exists.
  private mine(digest: string | null): PagerRow {
    if (digest === null) throw C.refuse.unauthorized();
    const row = this.pagerRow();
    if (!row) throw C.refuse.unknownPager();
    if (!sameDigest(digest, row.phone_hash)) throw C.refuse.unauthorized();
    return row;
  }
  // Off means nothing gets through and nothing is queued. Checked inside the transaction that writes.
  private on(): PushTarget | null {
    const row = this.pagerRow();
    if (!row) throw new Error('An agent outlived its pager.');
    if (row.enabled !== 1) throw C.refuse.pagerOff();
    return row.push ? decode(PushTarget, JSON.parse(row.push)) : null;
  }
  // An agent, by its key or its pager's phone key. An agent that isn't here was forgotten, or went with its deleted
  // pager.
  private agent(agentId: string, digest: string | null, by: 'agent' | 'phone' = 'agent'): AgentRow {
    const a = this.agentRow(agentId);
    if (!a) throw this.pagerRow() ? C.refuse.unknownAgent() : by === 'agent' ? C.refuse.pagerDeleted() : C.refuse.unknownPager();
    if (!sameDigest(digest, by === 'agent' ? a.agent_hash : a.phone_hash)) throw C.refuse.unauthorized();
    return a;
  }
  // Its decisions with no answer, in ask order.
  private unanswered(agentId: string) { return this.sql<{ decision_id: string }>('SELECT decision_id FROM decisions_v4 d WHERE agent_id=? AND NOT EXISTS (SELECT 1 FROM answers_v4 a WHERE a.agent_id=d.agent_id AND a.decision_id=d.decision_id) ORDER BY rowid', agentId).map(r => r.decision_id); }
  // Those still waiting for the owner: none once the agent has finished, since its finish closed them.
  private openCount(a: AgentRow) { return a.finished_at ? 0 : this.unanswered(a.agent_id).length; }
  // How a decision of this agent's with no answer closed, if it has: when its agent finished (B25.13).
  private closure(a: AgentRow): C.Closed | undefined { return a.finished_at === null ? undefined : { at: a.finished_at, reason: C.CLOSED_AGENT_FINISHED }; }
  // The agent's decisions that closed unanswered, in ask order: none until it finishes.
  private closedOf(a: AgentRow): C.ClosedDecision[] {
    const closed = this.closure(a);
    return closed ? this.unanswered(a.agent_id).map(decisionId => ({ decisionId, ...closed })) : [];
  }
  private summary(a: AgentRow): C.Agent {
    return decode(C.Agent, { agentId: a.agent_id, identity: a.identity, createdAt: a.created_at, finishedAt: a.finished_at, lastActivityAt: a.last_activity_at, openCount: this.openCount(a) });
  }
  // Activity, always while the pager is on: the agent's 30-day clock starts again, with no time off counted.
  private touch(agentId: string, at = iso()) { this.ctx.storage.sql.exec('UPDATE agents_v4 SET last_activity_at=?, off_ms=0 WHERE agent_id=?', at, agentId); }
  private preview(agentId: string, id: string) {
    const row = this.sql<{ preview: string }>('SELECT preview FROM decisions_v4 WHERE agent_id=? AND decision_id=?', agentId, id)[0];
    if (!row) throw C.refuse.unknownDecision();
    return row.preview;
  }
  // A decision as the phone and the agent read it: its parts as stored, and what the service knows of them. Only its
  // own agent's decisions are found (I21.3). One with no answer whose agent has finished closed unanswered then; its
  // status stays open on the wire, so the m5 app still reads it (packages/contract/exchange.ts › Decision).
  private decision(agent: AgentRow, id: string): C.Decision {
    const agentId = agent.agent_id;
    const d = this.sql<{ card: string; asked_at: string }>('SELECT card, asked_at FROM decisions_v4 WHERE agent_id=? AND decision_id=?', agentId, id)[0];
    if (!d) throw C.refuse.unknownDecision();
    const attachments = this.sql<{ part: string }>('SELECT part FROM attachments_v4 WHERE agent_id=? AND decision_id=? ORDER BY slot', agentId, id).map(r => ({ bytes: C.sealedBytes(r.part) }));
    const asked = { decisionId: id, card: d.card, attachments, askedAt: d.asked_at };
    const a = this.sql<AnswerRow>('SELECT answer_id, request_id, part, sent_at FROM answers_v4 WHERE agent_id=? AND decision_id=?', agentId, id)[0];
    if (!a) { const closed = this.closure(agent); return decode(C.Decision, { ...asked, status: 'open', ...(closed ? { closed } : {}) }); }
    const answer: C.Answer = { answerId: a.answer_id, decisionId: id, requestId: a.request_id, answer: a.part, sentAt: a.sent_at };
    const ack = this.sql<{ part: string; acknowledged_at: string }>('SELECT part, acknowledged_at FROM acknowledgements_v4 WHERE agent_id=? AND decision_id=?', agentId, id)[0];
    const at = (table: 'collections_v4' | 'warnings_v4') => this.sql<{ at: string }>(`SELECT at FROM ${table} WHERE agent_id=? AND decision_id=?`, agentId, id)[0]?.at;
    const collectedAt = at('collections_v4'), warnedAt = at('warnings_v4');
    return decode(C.Decision, {
      ...asked, status: ack ? 'acknowledged' : 'answered', answer, ...(collectedAt ? { collectedAt } : {}), ...(warnedAt ? { warnedAt } : {}),
      ...(ack ? { acknowledgement: { decisionId: id, answerId: a.answer_id, acknowledgement: ack.part, acknowledgedAt: ack.acknowledged_at } } : {}),
    });
  }
  // One agent as the phone reads it: open decisions in ask order, answered ones newest first. Those that closed
  // unanswered are among the open ones, each marked closed.
  private inboxOf(a: AgentRow): C.AgentInbox {
    const all = this.sql<{ decision_id: string }>('SELECT decision_id FROM decisions_v4 WHERE agent_id=? ORDER BY rowid', a.agent_id).map(r => this.decision(a, r.decision_id));
    const answered = all.filter(d => d.answer).sort((x, y) => Date.parse(y.answer?.sentAt ?? '') - Date.parse(x.answer?.sentAt ?? ''));
    return { agent: this.summary(a), open: all.filter(d => !d.answer), answered };
  }

  // An agent and everything it had go at once: decisions, attachments, answers, acknowledgements and its key digests.
  // Its old store, if it had one, and the Registry's listing of it are erased too, unless the whole pager goes from the
  // Registry with it. In a transaction.
  private forgetAgent(a: AgentRow, listing = true) {
    for (const table of ['warnings_v4', 'collections_v4', 'pickups_v4', 'acknowledgements_v4', 'answers_v4', 'attachments_v4', 'decisions_v4', 'agents_v4']) this.ctx.storage.sql.exec(`DELETE FROM ${table} WHERE agent_id=?`, a.agent_id);
    this.queue({ store: 'agent', id: a.agent_id });
    if (listing && a.moved === 1) this.queue({ store: 'listing', id: a.agent_id });
  }
  private queue(e: Erase) { this.ctx.storage.sql.exec('INSERT INTO erase_v4 VALUES (?, ?, ?) ON CONFLICT(store, id) DO UPDATE SET due=excluded.due', e.store, e.id, Date.now()); }
  // What the old stores still hold of what this store deleted: each is tried now, and any left a minute later, until
  // done. An agent's old store forgets everything, the way to its pager included, so its key is refused as unknown.
  private async erase() {
    const pagerId = this.movedRow()?.pager_id;
    if (!pagerId) return;
    const due = this.sql<Erase>('SELECT store, id FROM erase_v4 WHERE due <= ?', Date.now());
    await Promise.all(due.map(async e => {
      const call = e.store === 'agent' ? forward(this.env.AGENT, e.id, '/forget', { method: 'POST', headers: {} })
        : e.store === 'listing' ? registry(this.env, '/forget', { pagerId, agentId: e.id }) : registry(this.env, '/drop', { pagerId });
      const done = await call.then(r => r.ok, () => false);
      if (done) this.ctx.storage.sql.exec('DELETE FROM erase_v4 WHERE store=? AND id=?', e.store, e.id);
      else this.ctx.storage.sql.exec('UPDATE erase_v4 SET due=? WHERE store=? AND id=?', Date.now() + ERASE_RETRY_MS, e.store, e.id);
    }));
  }

  // The one alarm serves every clock: each agent's housekeeping, the next answer due a warning, and what is still to
  // erase from an old store. While the pager is off no agent's clock runs, so none sets it; turning the pager on is a
  // call, whose end sets it again.
  private async afterwards() {
    if (!this.movedRow()) return;
    const idle = this.pagerRow()?.enabled === 1 ? Math.min(...this.agentRows().map(a => this.forgetAt(a))) : Infinity;
    const due = (table: 'pickups_v4' | 'erase_v4') => this.sql<{ due: number | null }>(`SELECT min(due) AS due FROM ${table}`)[0]?.due ?? Infinity;
    const next = Math.min(idle, due('pickups_v4'), due('erase_v4'));
    const set = await this.ctx.storage.getAlarm();
    if (next === Infinity) { if (set !== null) await this.ctx.storage.deleteAlarm(); return; }
    if (set !== next) await this.ctx.storage.setAlarm(next);
  }
  async alarm() {
    if (!this.movedRow()) { await this.ctx.storage.deleteAlarm(); return; }
    this.housekeep();
    // Housekeeping stays armed whatever happens to a warning or an erasure.
    try { await this.warn(); } catch (error) { console.error('Pager warning failed', error instanceof Error ? error.message : 'unknown'); }
    try { await this.erase(); } catch (error) { console.error('Erasing an old store failed', error instanceof Error ? error.message : 'unknown'); }
    await this.afterwards();
  }
  // An answer no agent has picked up clocks.pickupMs after Send: the owner hears once, by an alert while the pager is on
  // and on the decision row, that AgentPager can't reach the agent. The alert resends the decision's preview, which
  // names who asked, its computer, its project and the question; the phone words it as the warning. While the pager is
  // off no agent can read an answer, so there is nothing to warn about.
  private async warn() {
    const warned = this.tx(() => {
      const due = this.sql<{ agent_id: string; decision_id: string }>('SELECT agent_id, decision_id FROM pickups_v4 WHERE due <= ?', Date.now());
      if (!due.length) return null;
      const row = this.pagerRow(), on = row?.enabled === 1, at = iso();
      for (const d of due) {
        this.ctx.storage.sql.exec('DELETE FROM pickups_v4 WHERE agent_id=? AND decision_id=?', d.agent_id, d.decision_id);
        if (on) this.ctx.storage.sql.exec('INSERT OR IGNORE INTO warnings_v4 VALUES (?, ?, ?)', d.agent_id, d.decision_id, at);
      }
      return on ? { push: row?.push ? decode(PushTarget, JSON.parse(row.push)) : null, due: due.map(d => ({ ...d, preview: this.preview(d.agent_id, d.decision_id) })) } : null;
    });
    for (const d of warned?.due ?? []) await this.alertPhone(d.agent_id, warned?.push ?? null, d.decision_id, 'warning', d.preview);
  }
  // An answer picked up (B32.12): the owner gets no warning for it, or, if it came after the warning, the decision goes
  // back to waiting for the agent (B5.13); the phone still waits for the acknowledgement (I6). The first time stays, and
  // nothing brings the warning's clock back, so it never warns twice. In the transaction that checked the answer.
  // When it was first picked up.
  private pickUp(agentId: string, decisionId: string, at = iso()): string {
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO collections_v4 VALUES (?, ?, ?)', agentId, decisionId, at);
    this.ctx.storage.sql.exec('DELETE FROM pickups_v4 WHERE agent_id=? AND decision_id=?', agentId, decisionId);
    const first = this.sql<{ at: string }>('SELECT at FROM collections_v4 WHERE agent_id=? AND decision_id=?', agentId, decisionId)[0];
    if (!first) throw new Error('An answer picked up with no collection.');
    return first.at;
  }
  // An alert goes to the pager's phone when it gave a token, with the preview the agent sealed. Apple's refusal of a
  // token drops it, unless the phone has given a new one since.
  private async alertPhone(agentId: string, to: PushTarget | null, decisionId: string, kind: Alert['kind'], preview: string) {
    const pagerId = this.movedRow()?.pager_id;
    if (!to || !pagerId) return;
    const a: Alert = { kind, preview, expiresAt: iso(Date.now() + ALERT_EXPIRY_MS), collapseId: decisionId, pagerId, agentId, decisionId };
    if (await alert(this.env, to, a) !== 'gone') return;
    const row = this.pagerRow();
    if (row?.push && decode(PushTarget, JSON.parse(row.push)).token === to.token) this.ctx.storage.sql.exec('UPDATE pager_v4 SET push=NULL WHERE id=1');
  }

  async fetch(request: Request): Promise<Response> {
    let response: Response;
    try { response = await this.handle(request); } catch (error) { response = refusal(error); }
    try { await this.afterwards(); } catch (error) { console.error('Pager housekeeping failed', error instanceof Error ? error.message : 'unknown'); }
    return response;
  }
  // /<pager id>/<action>: from the Worker, for the pager's routes, and from an agent's store, for its agent's
  // (/<pager id>/agent/<agent id>/<action>).
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), [named, action, ...rest] = url.pathname.split('/').filter(Boolean);
    const pagerId = decode(C.PagerId, named ?? '');
    const here = await this.ready(pagerId);
    if (!here && action !== 'create') return this.absent(request, action, rest);
    if (here && this.housekeep()) await this.armErase();
    if (action === 'agent') return this.agentCall(request, url, rest);
    // The phone makes the pager. The same phone making it again (its reply was lost) gets the pager back, with the
    // turn-off choice it asks for now; anyone else is refused.
    if (action === 'create') {
      const p = decode(Create, await body(request)), now = Date.now();
      const made = this.tx(() => {
        if (!this.movedRow()) { this.schema(); this.ctx.storage.sql.exec('INSERT INTO moved_v4 VALUES (1, ?, ?, 0)', pagerId, now); }
        const existing = this.pagerRow();
        if (existing) {
          if (!sameDigest(p.phoneHash, existing.phone_hash) || existing.public_key !== p.publicKey || existing.fingerprint !== p.fingerprint) throw C.refuse.pagerExists();
          if (existing.auto_off !== p.autoOff) this.ctx.storage.sql.exec('UPDATE pager_v4 SET auto_off=?, off_at=? WHERE id=1', p.autoOff, existing.enabled === 1 ? this.offAt(p.autoOff, now) : null);
        } else this.ctx.storage.sql.exec('INSERT INTO pager_v4 VALUES (1, ?, ?, ?, 1, ?, ?, NULL, NULL, ?)', p.fingerprint, p.publicKey, p.phoneHash, p.autoOff, this.offAt(p.autoOff, now), now);
        return { pager: this.pager(pagerId, this.mine(p.phoneHash)) };
      });
      // Its auto-off may have moved.
      this.wake('all');
      return json(made);
    }
    // A pager's public key, for anyone with its id: the command checks it against the number (I19).
    if (action === 'key' && request.method === 'GET') {
      const row = this.pagerRow();
      if (!row) throw C.refuse.numberInvalid();
      return json({ pagerId, publicKey: row.public_key });
    }
    // An agent connects with the number, through its own store, which keeps the way here: the fingerprint must match,
    // and the pager must be on, checked in the transaction that makes the agent.
    if (action === 'connect') {
      const input = decode(Connect, await body(request));
      const agentKey = token(), agentHash = await sha256(agentKey), now = iso();
      const a = this.tx(() => {
        const row = this.pagerRow();
        if (!row || row.fingerprint !== input.fingerprint) throw C.refuse.numberInvalid();
        if (row.enabled !== 1) throw C.refuse.pagerOff();
        if (this.agentRow(input.agentId)) throw C.refuse.invalid('This agent already exists.');
        const made: AgentRow = { agent_id: input.agentId, identity: input.identity, agent_hash: agentHash, phone_hash: row.phone_hash, created_at: now, finished_at: null, last_activity_at: now, moved: 0, off_ms: 0 };
        this.ctx.storage.sql.exec('INSERT INTO agents_v4 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', made.agent_id, made.identity, made.agent_hash, made.phone_hash, made.created_at, made.finished_at, made.last_activity_at, made.moved, made.off_ms);
        return this.summary(made);
      });
      const message = 'Connected as a new agent on your owner\'s pager. Your owner\'s phone shows you as a new agent. Use this agentId and agentKey for every question in this piece of work; connecting again adds another agent.';
      return json(decode(C.Connected, { agent: a, agentKey, message }));
    }
    // From an agent's old store, whose clock came due: whether this pager holds it, now that the move is done.
    if (action === 'nudge') {
      const { agentId } = decode(Nudge, await body(request));
      return json({ held: this.agentRow(agentId) !== undefined });
    }
    const digest = await phoneDigest(request);
    // Everything on the pager, read while it is on or off: its state and each agent's decisions, in connect order.
    if (action === 'inbox' && request.method === 'GET') {
      return json(this.tx(() => {
        const row = this.mine(digest), agents = this.agentRows();
        for (const a of agents) if (!sameDigest(digest, a.phone_hash)) throw C.refuse.unauthorized();
        return decode(C.PagerInbox, { pager: this.pager(pagerId, row), agents: agents.map(a => this.inboxOf(a)) });
      }));
    }
    if (action === 'settings') {
      this.mine(digest);
      const p = decode(C.PagerSettingsInput, await body(request)), now = Date.now();
      const set = this.tx(() => {
        let row = this.mine(digest);
        if (p.autoOff !== undefined) {
          // Counted from now while on; an off pager keeps the choice for when it is turned on.
          this.ctx.storage.sql.exec('UPDATE pager_v4 SET auto_off=?, off_at=? WHERE id=1', p.autoOff, row.enabled === 1 ? this.offAt(p.autoOff, now) : null);
          row = this.mine(digest);
        }
        if (p.on === true && row.enabled === 0) {
          this.resume(row, now);
          this.ctx.storage.sql.exec('UPDATE pager_v4 SET enabled=1, off_since=NULL, off_at=? WHERE id=1', this.offAt(decode(C.AutoOff, row.auto_off), now));
        }
        if (p.on === false && row.enabled === 1) this.ctx.storage.sql.exec('UPDATE pager_v4 SET enabled=0, off_since=?, off_at=NULL WHERE id=1', now);
        return { pager: this.pager(pagerId, this.mine(digest)) };
      });
      // Turned off, every wait ends refused; with its auto-off moved, each looks again by the new time.
      this.wake('all');
      return json(set);
    }
    if (action === 'push') {
      this.mine(digest);
      const push = decode(PushTarget, await body(request));
      this.tx(() => { this.mine(digest); this.ctx.storage.sql.exec('UPDATE pager_v4 SET push=? WHERE id=1', JSON.stringify(push)); });
      return json({ ok: true });
    }
    // Deleting a pager deletes its agents and their decisions, in one transaction; then what the old stores hold of
    // them is erased (I17.5).
    if (action === 'delete') {
      this.mine(digest);
      await emptyBody(request);
      this.tx(() => {
        this.mine(digest);
        for (const a of this.agentRows()) this.forgetAgent(a, false);
        if (this.movedRow()?.from_registry === 1) this.queue({ store: 'pager', id: pagerId });
        this.ctx.storage.sql.exec('DELETE FROM pager_v4 WHERE id=1');
      });
      this.wake('all');
      await this.armErase();
      await this.erase();
      return json({ ok: true });
    }
    throw C.refuse.notFound();
  }

  // A pager that isn't here, nor in the Registry: each call is refused as the pager not existing, as M5 refused it, a
  // key the phone didn't send before that.
  private async absent(request: Request, action: string | undefined, rest: string[]): Promise<Response> {
    if (action === 'nudge') return json({ held: false });
    if (action === 'key' || action === 'connect') throw C.refuse.numberInvalid();
    if (action === 'agent') throw rest[1] === 'answer' || rest[1] === 'file' ? C.refuse.unknownPager() : C.refuse.pagerDeleted();
    if (action === 'inbox' || action === 'settings' || action === 'push' || action === 'delete') {
      if (await phoneDigest(request) === null) throw C.refuse.unauthorized();
      throw C.refuse.unknownPager();
    }
    throw C.refuse.notFound();
  }

  // One agent's calls, passed on by its store with its id. Each that carries a key checks it before reading its
  // input: a wrong key is refused as unauthorized even when the input is also invalid (I4). A call that sends or
  // collects something checks its pager is on in the same transaction that writes.
  private async agentCall(request: Request, url: URL, [named, action, param, slot]: string[]): Promise<Response> {
    const agentId = decode(C.Token, named ?? '');
    // Status: the agent, whether its pager is on, and its decisions that closed unanswered, if any.
    if (action === 'status') {
      const digest = await agentDigest(request);
      return json(this.tx(() => {
        const a = this.agent(agentId, digest), closed = this.closedOf(a);
        return decode(C.AgentStatus, { agent: this.summary(a), pager: { on: this.pagerRow()?.enabled === 1 }, ...(closed.length ? { closed } : {}) });
      }));
    }
    if (action === 'ask') {
      const digest = await agentDigest(request);
      this.tx(() => { if (this.agent(agentId, digest).finished_at) throw C.refuse.finished(); });
      const input = decode(C.AskInput, await body(request));
      // The decision's id comes from this agent's id and the request id, so it is this agent's alone, and its parts are
      // bound to it: the command sealed them for this id.
      const decisionId = await C.decisionIdOf(agentId, input.requestId);
      const asked = this.tx(() => {
        const a = this.agent(agentId, digest);
        if (a.finished_at) throw C.refuse.finished();
        const push = this.on();
        // The same card again (its reply was lost) finds its decision, which stays as first stored: nothing is stored
        // and no alert goes, even when this agent's open decisions are now at their limit. Another card is refused.
        const known = this.sql<{ digest: string }>('SELECT digest FROM decisions_v4 WHERE agent_id=? AND decision_id=?', agentId, decisionId)[0];
        if (known?.digest === input.digest) return { push, again: true };
        if (known) throw C.refuse.requestIdTaken();
        if (this.openCount(a) >= C.MAX_OPEN_DECISIONS) throw C.refuse.tooMany();
        this.ctx.storage.sql.exec('INSERT INTO decisions_v4 VALUES (?, ?, ?, ?, ?, ?)', agentId, decisionId, input.card, input.preview, input.digest, iso());
        (input.attachments ?? []).forEach((part, at) => this.ctx.storage.sql.exec('INSERT INTO attachments_v4 VALUES (?, ?, ?, ?)', agentId, decisionId, at, part));
        this.touch(agentId);
        return { push, again: false };
      });
      if (!asked.again) await this.alertPhone(agentId, asked.push, decisionId, 'decision', input.preview);
      return json(decode(C.Asked, { decisionId }));
    }
    if (action === 'read') {
      const digest = await agentDigest(request);
      this.tx(() => this.agent(agentId, digest));
      const id = decode(C.Token, param ?? ''), wait = url.searchParams.get('wait'), picksUp = !confirmsPickup(request);
      const seconds = wait === null ? 0 : decode(Schema.Number.pipe(Schema.int(), Schema.between(1, C.ANSWER_WAIT_MAX_SECONDS)), Number(wait));
      // Held until the answer is here, or until its time is up, when it is pending. Each look checks the agent and the
      // switch first, in the transaction that finds the answer: the answer is delivered only while the pager is on, and
      // a wait woken by the pager turning off, by it or the agent going, or by the agent finishing, which closes the
      // decision if it has no answer, ends refused as a new call would be. Between looks it sleeps until a wake (wake,
      // above), its time, or its pager's auto-off, whichever is first. A wait whose command has gone still finds the
      // answer and replies to no one, since nothing tells it its caller went: so a command at C.PICKUP_PROTOCOL picks
      // the answer up only once it has it (received, below). Only an older command's read picks it up, as it always did.
      const answer = await this.waits.hold({ agentId, decisionId: id }, Date.now() + seconds * 1000, () => this.tx(() => {
        const a = this.agent(agentId, digest);
        this.on();
        const d = this.decision(a, id);
        if (d.closed) throw C.refuse.decisionClosed(d.closed);
        if (!d.answer) return { lookBy: this.pagerRow()?.off_at ?? null };
        if (picksUp) this.pickUp(agentId, id);
        return { found: d.answer };
      }));
      return json(answer ? decode(C.AnswerStatus, { status: 'answered', answer }) : { status: 'pending' });
    }
    // The agent's command has received the answer: it read it and opened it, and says so (B32.12). Only its own agent's
    // key says so, for that agent's own decision, naming the answer it has; anything else is refused as the same
    // acknowledgement would be, and picks nothing up. Saying it again, as after a lost reply, changes nothing and gets
    // the same reply. Received isn't activity, as reading isn't: the agent's 30-day clock stays as it was.
    if (action === 'received') {
      const digest = await agentDigest(request);
      this.tx(() => this.agent(agentId, digest));
      const id = decode(C.Token, param ?? ''), input = decode(C.ReceivedInput, await body(request));
      return json(this.tx(() => {
        const a = this.agent(agentId, digest);
        this.on();
        const d = this.decision(a, id);
        if (d.closed) throw C.refuse.decisionClosed(d.closed);
        if (!d.answer) throw C.refuse.notAnswered();
        if (d.answer.answerId !== input.answerId) throw C.refuse.answerMismatch();
        return decode(C.Received, { decisionId: id, answerId: input.answerId, collectedAt: this.pickUp(agentId, id) });
      }));
    }
    if (action === 'ack') {
      const digest = await agentDigest(request);
      this.tx(() => this.agent(agentId, digest));
      const id = decode(C.Token, param ?? ''), input = decode(C.AcknowledgementInput, await body(request));
      const done = this.tx(() => {
        const a = this.agent(agentId, digest);
        const push = this.on(), d = this.decision(a, id);
        if (d.closed) throw C.refuse.decisionClosed(d.closed);
        if (!d.answer) throw C.refuse.notAnswered();
        if (d.answer.answerId !== input.answerId) throw C.refuse.answerMismatch();
        if (d.acknowledgement) throw C.refuse.alreadyAcknowledged();
        const acknowledgedAt = iso();
        this.ctx.storage.sql.exec('INSERT INTO acknowledgements_v4 VALUES (?, ?, ?, ?)', agentId, id, input.acknowledgement, acknowledgedAt);
        // An agent that acknowledges an answer has it, whether or not its command said so first (B32.12).
        this.pickUp(agentId, id, acknowledgedAt);
        this.touch(agentId);
        return { push, ack: decode(C.Acknowledgement, { decisionId: id, answerId: input.answerId, acknowledgement: input.acknowledgement, acknowledgedAt }) };
      });
      await this.alertPhone(agentId, done.push, id, 'acknowledgement', input.preview);
      return json(done.ack);
    }
    // Finishing tells the phone this agent is done, and it asks nothing more. Its decisions with no answer close
    // unanswered in the same transaction, so none can be answered after it; those answered before it keep their
    // answers, which the agent can still collect and acknowledge (B25.13). Finishing again changes nothing, and names
    // the same decisions.
    if (action === 'finish') {
      const digest = await agentDigest(request);
      this.tx(() => this.agent(agentId, digest));
      await emptyBody(request);
      const finished = this.tx(() => {
        const a = this.agent(agentId, digest);
        this.on();
        const finishedAt = a.finished_at ?? iso();
        if (!a.finished_at) {
          this.ctx.storage.sql.exec('UPDATE agents_v4 SET finished_at=? WHERE agent_id=?', finishedAt, agentId);
          this.touch(agentId, finishedAt);
        }
        return decode(C.Finished, { finishedAt, closed: this.closedOf({ ...a, finished_at: finishedAt }) });
      });
      // Closed: the waits for them end, told so.
      this.wake({ agentId });
      return json(finished);
    }
    const digest = await phoneDigest(request);
    // One attachment of a decision, for the phone: its encrypted part, by its slot in the card's list. Readable while
    // the pager is off, never once it is deleted.
    if (action === 'file' && request.method === 'GET') {
      this.tx(() => this.agent(agentId, digest, 'phone'));
      const id = decode(C.Token, param ?? ''), at = decode(Slot, slot ?? '');
      const part = this.tx(() => {
        this.decision(this.agent(agentId, digest, 'phone'), id);
        const row = this.sql<{ part: string }>('SELECT part FROM attachments_v4 WHERE agent_id=? AND decision_id=? AND slot=?', agentId, id, at)[0];
        if (!row) throw C.refuse.unknownFile();
        return row.part;
      });
      return new Response(part, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (action === 'answer') {
      this.tx(() => this.agent(agentId, digest, 'phone'));
      const id = decode(C.Token, param ?? ''), input = decode(C.AnswerInput, await body(request));
      const receipt = this.tx(() => {
        const a = this.agent(agentId, digest, 'phone');
        this.on();
        const d = this.decision(a, id);
        // The phone resends an answer after a lost reply as the same request: the same request id and the same part.
        // An answer stored before its agent finished stays the answer, so its resend still gets its receipt.
        if (d.answer) {
          const receipt = decode(C.Receipt, { decisionId: id, answerId: d.answer.answerId, sentAt: d.answer.sentAt });
          if (d.answer.requestId === input.requestId && d.answer.answer === input.answer) return receipt;
          throw C.refuse.alreadyAnswered(receipt);
        }
        // Its agent finished first: nothing is stored. The phone holds an answer through its Undo window and sends it
        // once the window closes (I6), so one still in its window when the agent finished is refused here too.
        if (d.closed) throw C.refuse.decisionClosed(d.closed);
        if (this.sql('SELECT 1 FROM answers_v4 WHERE agent_id=? AND request_id=?', agentId, input.requestId).length) throw C.refuse.invalid('requestId already belongs to another decision.');
        const sentAt = iso(), answerId = token();
        this.ctx.storage.sql.exec('INSERT INTO answers_v4 VALUES (?, ?, ?, ?, ?, ?)', agentId, id, input.requestId, answerId, input.answer, sentAt);
        this.ctx.storage.sql.exec('INSERT INTO pickups_v4 VALUES (?, ?, ?)', agentId, id, Date.parse(sentAt) + clocks.pickupMs);
        this.touch(agentId);
        return decode(C.Receipt, { decisionId: id, answerId, sentAt });
      });
      // Stored: the waits for it collect it now. The phone sends it once its Undo window has closed (I6).
      this.wake({ agentId, decisionId: id });
      return json(receipt);
    }
    throw C.refuse.notFound();
  }
}
