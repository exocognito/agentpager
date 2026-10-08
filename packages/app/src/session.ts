import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import { terminalQr } from './qr.ts';
import * as C from './contract.ts';
import { acceptsChoice } from '../../blueprint/design/ui/components/cards/schemas.ts';
import { body, decode, emptyBody, iso, json, refusal, sameDigest, sha256, token } from './shared.ts';
import { forward, lifetimes, type Env } from './env.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const Index = Schema.Number.pipe(Schema.int(), Schema.between(0, C.PALETTE_SIZE - 1));
// The live pager. Keys and the link code are stored only as SHA-256 digests. The pairing code is palette indexes
// and never leaves the server except to the agent.
const Meta = Schema.Struct({
  sessionId: C.Token, name: Schema.NullOr(C.SessionName), status: C.LiveStatus, lifetime: C.Lifetime,
  createdAt: C.Timestamp, pairedAt: Schema.NullOr(C.Timestamp), endsAt: C.Timestamp, windowEndsAt: C.Timestamp,
  triesLeft: Schema.Number.pipe(Schema.int(), Schema.between(0, C.PAIRING_TRIES)), lastActivityAt: C.Timestamp,
  agentHash: Schema.NullOr(Digest), phoneHash: Schema.NullOr(Digest), codeHash: Schema.NullOr(Digest),
  palette: Schema.Array(C.PaletteEntry), code: Schema.NullOr(Schema.Tuple(Index, Index, Index)),
});
type Meta = typeof Meta.Type;
// What survives an end for RETENTION_MS: the name, reason and time, plus key digests so only the holders can read it.
const Tombstone = Schema.Struct({ sessionId: C.Token, name: Schema.NullOr(C.SessionName), endReason: C.EndReason, endedAt: C.Timestamp, agentHash: Schema.NullOr(Digest), phoneHash: Schema.NullOr(Digest) });
type Tombstone = typeof Tombstone.Type;
const Init = Schema.Struct({ sessionId: C.Token, code: C.Token, origin: Schema.String, by: Schema.Literal('agent', 'phone'), name: Schema.NullOr(C.SessionName), lifetime: C.Lifetime });

const randomIndex = (n: number) => { // Rejection sampling: no modulo bias in the palette or the code.
  const ceiling = Math.floor(0x100000000 / n) * n;
  let value: number; do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= ceiling);
  return value % n;
};
const bare = (emoji: string) => emoji.replaceAll('️', '');
export function linkFor(origin: string, code: string, expiresAt: string): C.Link {
  const url = `${origin}/start/${code}`;
  return { code, url, qrText: terminalQr(url), qrUrl: `${url}/qr.svg`, expiresAt };
}
async function keyDigest(value: string | null | undefined) { return value && Schema.is(C.Token)(value) ? sha256(value) : null; }
const agentDigest = (request: Request) => keyDigest(request.headers.get(C.AGENT_AUTH_HEADER)?.replace(/^Bearer /, ''));
const phoneDigest = (request: Request) => keyDigest(request.headers.get(C.PHONE_AUTH_HEADER));

type PairOutcome = { kind: 'paired'; session: C.LiveSummary } | { kind: 'wrong'; triesLeft: number } | { kind: 'failed'; endedAt: string };

export class Session {
  private unregister: string[] = [];
  constructor(private ctx: DurableObjectState, private env: Env) { this.schema(); }
  private schema() {
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS pager (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tombstone (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS answers (decision_id TEXT PRIMARY KEY REFERENCES proposals(id), request_id TEXT NOT NULL UNIQUE, input TEXT NOT NULL, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS acknowledgements (decision_id TEXT PRIMARY KEY REFERENCES answers(decision_id), json TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS proposal_immutable BEFORE UPDATE ON proposals BEGIN SELECT RAISE(ABORT,'immutable proposal'); END;
      CREATE TRIGGER IF NOT EXISTS answer_immutable BEFORE UPDATE ON answers BEGIN SELECT RAISE(ABORT,'immutable answer'); END;
      CREATE TRIGGER IF NOT EXISTS acknowledgement_immutable BEFORE UPDATE ON acknowledgements BEGIN SELECT RAISE(ABORT,'immutable acknowledgement'); END;`);
  }
  private row(table: 'pager' | 'tombstone') { return this.ctx.storage.sql.exec<{ json: string }>(`SELECT json FROM ${table} WHERE id=1`).toArray()[0]?.json; }
  private meta(): Meta | null { const raw = this.row('pager'); return raw ? decode(Meta, JSON.parse(raw)) : null; }
  private tomb(): Tombstone | null { const raw = this.row('tombstone'); return raw ? decode(Tombstone, JSON.parse(raw)) : null; }
  private save(m: Meta) { decode(Meta, m); this.ctx.storage.sql.exec('INSERT INTO pager VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json', JSON.stringify(m)); }
  private tx<A>(run: () => A): A { this.settle(); return this.ctx.storage.transactionSync(run); }

  // Ending clears every decision, answer, acknowledgement, palette, code and link at once. A pager no agent ever
  // joined has no name to keep, so it is forgotten outright.
  private end(m: Meta, endReason: C.EndReason, endedAt: string) {
    this.ctx.storage.sql.exec('DELETE FROM acknowledgements; DELETE FROM answers; DELETE FROM proposals; DELETE FROM pager;');
    if (m.codeHash) this.unregister.push(m.codeHash);
    if (m.name === null) return null;
    const t: Tombstone = { sessionId: m.sessionId, name: m.name, endReason, endedAt, agentHash: m.agentHash, phoneHash: m.phoneHash };
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO tombstone VALUES (1, ?)', JSON.stringify(decode(Tombstone, t)));
    return t;
  }
  // The server keeps the only clock. Runs outside any transaction, so an expiry always commits.
  private settle() {
    const now = Date.now(), t = this.tomb();
    if (t) { if (now >= Date.parse(t.endedAt) + lifetimes.retainMs) this.ctx.storage.sql.exec('DELETE FROM tombstone;'); return; }
    const m = this.meta(); if (!m) return;
    if (now >= Date.parse(m.endsAt)) { this.end(m, 'timedOut', m.endsAt); return; }
    if (m.codeHash && now >= Date.parse(m.windowEndsAt)) { this.unregister.push(m.codeHash); this.save({ ...m, codeHash: null, palette: [], code: null }); }
  }
  private async unregisterQueued() {
    const hashes = this.unregister; this.unregister = [];
    for (const codeHash of hashes) {
      try { await forward(this.env.REGISTRY, 'registry', '/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codeHash }) }); }
      catch { /* The registry row expires with the pairing window anyway. */ }
    }
  }
  private async afterwards() {
    await this.unregisterQueued();
    const t = this.tomb(), m = this.meta();
    const next = t ? Date.parse(t.endedAt) + lifetimes.retainMs : m ? Math.min(Date.parse(m.endsAt), m.codeHash ? Date.parse(m.windowEndsAt) : Infinity) : null;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else if (await this.ctx.storage.getAlarm() !== next) await this.ctx.storage.setAlarm(next);
  }
  // Once nothing is left to keep, the pager is forgotten: all of its storage goes.
  async alarm() {
    this.settle();
    if (this.meta() || this.tomb()) { await this.afterwards(); return; }
    await this.unregisterQueued();
    await this.ctx.storage.deleteAll();
    this.schema();
  }

  private openCount() { return this.ctx.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM proposals WHERE id NOT IN (SELECT decision_id FROM answers)').toArray()[0].n; }
  private summary(m: Meta): C.LiveSummary {
    return decode(C.LiveSummary, { sessionId: m.sessionId, name: m.name, status: m.status, lifetime: m.lifetime, createdAt: m.createdAt, pairedAt: m.pairedAt, endsAt: m.endsAt, triesLeft: m.triesLeft, openCount: this.openCount(), lastActivityAt: m.lastActivityAt });
  }
  private endedSummary(t: { sessionId: string; name: string | null; endedAt: string; endReason: C.EndReason }): C.EndedSummary {
    return decode(C.EndedSummary, { sessionId: t.sessionId, name: t.name, status: 'ended', endedAt: t.endedAt, endReason: t.endReason });
  }
  private pairingCode(m: Meta): C.PairingCode | null {
    if (!m.code || m.status === 'active') return null;
    const picked = m.code.map(i => m.palette[i]);
    const minutes = Math.max(1, Math.ceil((Date.parse(m.windowEndsAt) - Date.now()) / 60_000));
    const tries = `${m.triesLeft} ${m.triesLeft === 1 ? 'try' : 'tries'}`;
    const text = [
      'To finish pairing, tap these 3 emojis on your phone, in this order:',
      picked.map(p => p.emoji).join(' '),
      `(${picked.map((p, i) => `${i + 1}. ${p.name}`).join('    ')})`,
      `${tries}. Pair within ${minutes} minute${minutes === 1 ? '' : 's'}, or this pager ends.`,
    ].join('\n');
    return decode(C.PairingCode, { emojis: picked.map(p => p.emoji), names: picked.map(p => p.name), text });
  }
  private agent(digest: string | null): Meta {
    const t = this.tomb();
    if (t) { if (sameDigest(digest, t.agentHash)) throw C.refuse.ended(t.endReason, t.endedAt); throw C.refuse.unauthorized(); }
    const m = this.meta(); if (!m) throw C.refuse.unknownSession();
    if (!sameDigest(digest, m.agentHash)) throw C.refuse.unauthorized();
    return m;
  }
  private phone(digest: string | null): { m: Meta; t: null } | { m: null; t: Tombstone } {
    const t = this.tomb();
    if (t) { if (sameDigest(digest, t.phoneHash)) return { m: null, t }; throw C.refuse.unauthorized(); }
    const m = this.meta(); if (!m) throw C.refuse.unknownSession();
    if (!sameDigest(digest, m.phoneHash)) throw C.refuse.unauthorized();
    return { m, t: null };
  }
  private livePhone(digest: string | null): Meta {
    const p = this.phone(digest);
    if (p.t) throw C.refuse.ended(p.t.endReason, p.t.endedAt, p.t.name);
    return p.m;
  }
  // A link code works only while its pager is live and inside the pairing window.
  private linked(): Meta {
    const m = this.tomb() ? null : this.meta();
    if (!m || !m.codeHash || Date.now() >= Date.parse(m.windowEndsAt)) throw C.refuse.linkInvalid();
    return m;
  }
  private decision(id: string): C.Decision {
    const raw = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM proposals WHERE id=?', id).toArray()[0];
    if (!raw) throw C.refuse.unknownDecision();
    const proposal = decode(C.Decision, JSON.parse(raw.json));
    const answer = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM answers WHERE decision_id=?', id).toArray()[0];
    if (!answer) return proposal;
    const a = decode(C.Answer, JSON.parse(answer.json));
    const ack = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM acknowledgements WHERE decision_id=?', id).toArray()[0];
    return decode(C.Decision, { ...proposal, status: a.choice.kind === 'feedback' ? 'feedback' : ack ? 'acknowledged' : 'answered', answer: a, ...(ack ? { acknowledgement: decode(C.Acknowledgement, JSON.parse(ack.json)) } : {}) });
  }
  private touch(m: Meta) { this.save({ ...m, lastActivityAt: iso() }); }

  async fetch(request: Request): Promise<Response> {
    let response: Response;
    try { response = await this.handle(request); } catch (error) { response = refusal(error); }
    try { await this.afterwards(); } catch (error) { console.error('Pager housekeeping failed', error instanceof Error ? error.message : 'unknown'); }
    return response;
  }
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), [action, param] = url.pathname.split('/').filter(Boolean);
    if (action === 'init') {
      const input = decode(Init, await body(request));
      const agentKey = input.by === 'agent' ? token() : null;
      const agentHash = agentKey ? await sha256(agentKey) : null;
      const phoneHash = input.by === 'phone' ? await phoneDigest(request) : null;
      if (input.by === 'phone' && !phoneHash) throw C.refuse.unauthorized();
      const codeHash = await sha256(input.code);
      const pool = [...C.PAIRING_EMOJIS];
      for (let i = pool.length - 1; i > 0; i--) { const j = randomIndex(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const palette = pool.slice(0, C.PALETTE_SIZE).map(([emoji, name]) => ({ emoji, name }));
      const now = Date.now(), windowEndsAt = iso(now + lifetimes.windowMs);
      const m: Meta = { sessionId: input.sessionId, name: input.name, status: input.by === 'agent' ? 'unpaired' : 'waiting', lifetime: input.lifetime, createdAt: iso(now), pairedAt: null, endsAt: windowEndsAt, windowEndsAt, triesLeft: C.PAIRING_TRIES, lastActivityAt: iso(now), agentHash, phoneHash, codeHash, palette, code: [randomIndex(C.PALETTE_SIZE), randomIndex(C.PALETTE_SIZE), randomIndex(C.PALETTE_SIZE)] };
      this.tx(() => { if (this.row('pager') || this.row('tombstone')) throw C.refuse.invalid('This pager already exists.'); this.save(m); });
      const registered = await forward(this.env.REGISTRY, 'registry', '/put', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codeHash, sessionId: m.sessionId, expiresAt: windowEndsAt }) });
      if (!registered.ok) throw new Error('Registry refused the link');
      const link = linkFor(input.origin, input.code, windowEndsAt);
      const code = this.pairingCode(m);
      if (agentKey && code) return json(decode(C.Created, { session: this.summary(m), agentKey, link, pairingCode: code }));
      return json(decode(C.PhoneCreated, { session: this.summary(m), link }));
    }
    if (action === 'start') {
      const m = this.tx(() => this.linked());
      return json(decode(C.StartInfo, { status: m.status, name: m.name, palette: m.palette, triesLeft: m.triesLeft, endsAt: m.endsAt, lifetime: m.lifetime }));
    }
    if (action === 'join') {
      const input = decode(C.JoinInput, await body(request));
      const agentKey = token(), agentHash = await sha256(agentKey);
      const m = this.tx(() => {
        const m = this.linked();
        if (m.agentHash) throw C.refuse.alreadyJoined();
        const joined: Meta = { ...m, name: input.name, status: 'unpaired', agentHash, lastActivityAt: iso() };
        this.save(joined); return joined;
      });
      const code = this.pairingCode(m);
      return json(decode(C.Joined, { session: this.summary(m), agentKey, pairingCode: code }));
    }
    if (action === 'pair') {
      const input = decode(C.PairInput, await body(request));
      const digest = await phoneDigest(request);
      const outcome = this.tx((): PairOutcome => {
        const m = this.linked();
        if (!digest) throw C.refuse.unauthorized();
        if (m.status === 'waiting') { if (!sameDigest(digest, m.phoneHash)) throw C.refuse.unauthorized(); throw C.refuse.waitingForAgent(); }
        if (m.status === 'active') { if (sameDigest(digest, m.phoneHash)) return { kind: 'paired', session: this.summary(m) }; throw C.refuse.alreadyPaired(); }
        if (m.phoneHash && !sameDigest(digest, m.phoneHash)) throw C.refuse.unauthorized();
        const right = m.code && input.code.every((emoji, i) => m.code !== null && bare(emoji) === bare(m.palette[m.code[i]].emoji));
        const now = Date.now();
        if (right) {
          const paired: Meta = { ...m, status: 'active', pairedAt: iso(now), endsAt: iso(now + lifetimes.lifetimeMs(m.lifetime)), phoneHash: digest, lastActivityAt: iso(now) };
          this.save(paired); return { kind: 'paired', session: this.summary(paired) };
        }
        const triesLeft = m.triesLeft - 1;
        if (triesLeft > 0) { this.save({ ...m, triesLeft }); return { kind: 'wrong', triesLeft }; }
        const endedAt = iso(now); this.end(m, 'pairingFailed', endedAt); return { kind: 'failed', endedAt };
      });
      if (outcome.kind === 'paired') return json({ session: outcome.session });
      if (outcome.kind === 'wrong') throw C.refuse.wrongCode(outcome.triesLeft);
      throw C.refuse.ended('pairingFailed', outcome.endedAt);
    }
    if (action === 'status') {
      const digest = await agentDigest(request);
      return json(this.tx(() => { const m = this.agent(digest); return decode(C.AgentStatus, { session: this.summary(m), pairingCode: this.pairingCode(m) }); }));
    }
    if (action === 'ask') {
      const digest = await agentDigest(request);
      const question = decode(C.QuestionInput, await body(request));
      return json(this.tx(() => {
        const m = this.agent(digest);
        if (this.openCount() >= C.MAX_OPEN_DECISIONS) throw C.refuse.tooMany();
        const d: C.Decision = { ...question, decisionId: token(), kind: 'card', status: 'open', askedAt: iso() };
        decode(C.Decision, d);
        this.ctx.storage.sql.exec('INSERT INTO proposals VALUES (?, ?)', d.decisionId, JSON.stringify(d));
        this.touch(m); return { decisionId: d.decisionId };
      }));
    }
    if (action === 'read') {
      const digest = await agentDigest(request);
      const id = decode(C.Token, param), wait = url.searchParams.get('wait');
      const seconds = wait === null ? 0 : decode(Schema.Number.pipe(Schema.int(), Schema.between(1, C.ANSWER_WAIT_MAX_SECONDS)), Number(wait));
      const until = Date.now() + seconds * 1000;
      for (;;) {
        const d = this.tx(() => { this.agent(digest); return this.decision(id); });
        if (d.answer) return json({ status: 'answered', answer: d.answer });
        if (Date.now() >= until) return json({ status: 'pending' });
        await new Promise(r => setTimeout(r, Math.min(100, until - Date.now())));
      }
    }
    if (action === 'ack') {
      const digest = await agentDigest(request);
      const id = decode(C.Token, param), input = decode(C.AcknowledgementInput, await body(request));
      return json(this.tx(() => {
        const m = this.agent(digest), d = this.decision(id);
        if (!d.answer) throw C.refuse.notAnswered();
        if (d.answer.answerId !== input.answerId) throw C.refuse.answerMismatch();
        if (d.acknowledgement) throw C.refuse.alreadyAcknowledged();
        const ack = decode(C.Acknowledgement, { ...input, decisionId: id, acknowledgedAt: iso() });
        this.ctx.storage.sql.exec('INSERT INTO acknowledgements VALUES (?, ?)', id, JSON.stringify(ack));
        this.touch(m); return ack;
      }));
    }
    if (action === 'finish') {
      const digest = await agentDigest(request);
      await emptyBody(request);
      return json(this.tx(() => { const m = this.agent(digest), endedAt = iso(); this.end(m, 'agentFinished', endedAt); return { endedAt }; }));
    }
    if (action === 'inbox') {
      const digest = await phoneDigest(request);
      return json(this.tx(() => {
        const p = this.phone(digest);
        if (p.t) return { session: this.endedSummary(p.t), open: [], answered: [] };
        const m = p.m;
        if (m.status !== 'active') return decode(C.PhoneInbox, { session: this.summary(m), open: [], answered: [] });
        const all = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM proposals ORDER BY rowid').toArray().map(r => this.decision(r.id));
        const answered = all.filter(d => d.answer).sort((a, b) => Date.parse(b.answer?.sentAt ?? '') - Date.parse(a.answer?.sentAt ?? ''));
        return decode(C.PhoneInbox, { session: this.summary(m), open: all.filter(d => !d.answer), answered });
      }));
    }
    if (action === 'answer') {
      const digest = await phoneDigest(request);
      const id = decode(C.Token, param), input = decode(C.AnswerInput, await body(request));
      const canonical = JSON.stringify({ requestId: input.requestId, choice: input.choice.kind === 'option' ? { kind: 'option', number: input.choice.number } : { kind: 'feedback', text: input.choice.text } });
      return json(this.tx(() => {
        const m = this.livePhone(digest);
        if (m.status !== 'active') throw C.refuse.invalid('Pair this pager before answering.');
        const d = this.decision(id);
        const stored = this.ctx.storage.sql.exec<{ input: string; request_id: string }>('SELECT input, request_id FROM answers WHERE decision_id=?', id).toArray()[0];
        if (d.answer && stored) {
          const receipt = decode(C.Receipt, { decisionId: id, answerId: d.answer.answerId, sentAt: d.answer.sentAt });
          if (stored.request_id === input.requestId && stored.input === canonical) return receipt;
          throw C.refuse.alreadyAnswered(receipt);
        }
        if (this.ctx.storage.sql.exec('SELECT 1 FROM answers WHERE request_id=?', input.requestId).toArray().length) throw C.refuse.invalid('requestId already belongs to another decision.');
        if (!acceptsChoice(d.card, input.choice)) throw C.refuse.invalid('Choose an option offered on this card.');
        const sentAt = iso();
        const answer = decode(C.Answer, { answerId: token(), decisionId: id, choice: input.choice, sentAt });
        decode(C.Decision, { ...d, status: input.choice.kind === 'feedback' ? 'feedback' : 'answered', answer });
        this.ctx.storage.sql.exec('INSERT INTO answers VALUES (?, ?, ?, ?)', id, input.requestId, canonical, JSON.stringify(answer));
        this.touch(m);
        return decode(C.Receipt, { decisionId: id, answerId: answer.answerId, sentAt });
      }));
    }
    if (action === 'end') {
      const digest = await phoneDigest(request);
      await emptyBody(request);
      return json(this.tx(() => {
        const p = this.phone(digest);
        if (p.t) return { session: this.endedSummary(p.t) };
        const endedAt = iso(); this.end(p.m, 'ownerEnded', endedAt);
        return { session: this.endedSummary({ sessionId: p.m.sessionId, name: p.m.name, endedAt, endReason: 'ownerEnded' }) };
      }));
    }
    if (action === 'lifetime') {
      const digest = await phoneDigest(request);
      const input = decode(C.LifetimeInput, await body(request));
      return json(this.tx(() => {
        const m = this.livePhone(digest), now = Date.now();
        // Counted from now once paired; before pairing the choice applies at pairing and the window stays the end time.
        const next: Meta = m.status === 'active' ? { ...m, lifetime: input.lifetime, endsAt: iso(now + lifetimes.lifetimeMs(input.lifetime)) } : { ...m, lifetime: input.lifetime };
        this.save(next); return { session: this.summary(next) };
      }));
    }
    throw C.refuse.notFound();
  }
}
