import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import * as C from './contract.ts';
import { body, decode, json, refusal } from './shared.ts';
import { forward, type Env } from './env.ts';
import { Fingerprint, Meta, type AgentExport } from './move.ts';

// One agent's own store, named by its agent id. Since M6 an agent's pager keeps everything of it (pager.ts), and this
// store only knows the way there: every call that names the agent by its id arrives here, as M5's did, and is passed
// on to its pager's store, which handles it. It writes nothing of the agent's.
//
//   link_v4   the pager of an agent that connected since M6, made when it connects
//   agent_v3, decisions_v3, attachments_v3, answers_v3, acknowledgements_v3, pickups_v3, collections_v3, warnings_v3
//             what M5 stored of an agent that connected before it (the agent, with its pager, and its decisions). Its
//             pager's store copies them at its move (/export), and they stay here, unused and never written again,
//             until a later release removes them, or until its pager's store forgets the agent or deletes its pager
//             and erases them (/forget).
const Open = Schema.Struct({ agentId: C.Token, pagerId: C.PagerId, fingerprint: Fingerprint, identity: C.Sealed('identity') });
const Held = Schema.Struct({ held: Schema.Boolean });
// What an agent stored before the encryption switch (M5), readable: its tables. An object that still has any of them
// forgets everything at its first start on this code, before it serves anything (the release's exception,
// blueprint/milestones/M5-encrypt.md). Nothing stored since is in them, so this never touches it.
const PRE_SWITCH_TABLES = ['agent', 'proposals', 'answers', 'acknowledgements', 'attachments', 'asks', 'pickups', 'collections', 'warnings'];
// An old agent's clock that couldn't reach its pager's store is tried again this much later.
const NUDGE_RETRY_MS = 60_000;

export class Agent {
  constructor(private ctx: DurableObjectState, private env: Env) {
    void ctx.blockConcurrencyWhile(async () => {
      const names = PRE_SWITCH_TABLES.map(n => `'${n}'`).join(', ');
      if (ctx.storage.sql.exec(`SELECT 1 FROM sqlite_master WHERE type='table' AND name IN (${names}) LIMIT 1`).toArray().length) {
        await ctx.storage.deleteAlarm();
        await ctx.storage.deleteAll();
      }
    });
  }
  private has(table: string) { return this.ctx.storage.sql.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", table).toArray().length > 0; }
  private rows<T extends Record<string, string | number | null>>(query: string) { return this.ctx.storage.sql.exec<T>(query).toArray(); }
  // What M5 stored of this agent, if anything.
  private meta(): Meta | null {
    if (!this.has('agent_v3')) return null;
    const raw = this.rows<{ json: string }>('SELECT json FROM agent_v3 WHERE id=1')[0]?.json;
    return raw ? decode(Meta, JSON.parse(raw)) : null;
  }
  // The way to the agent's pager: its link since M6, or what M5 stored of it.
  private where(): { agentId: string; pagerId: string } | null {
    const link = this.has('link_v4') ? this.rows<{ agent_id: string; pager_id: string }>('SELECT agent_id, pager_id FROM link_v4 WHERE id=1')[0] : undefined;
    if (link) return { agentId: link.agent_id, pagerId: link.pager_id };
    const m = this.meta();
    return m ? { agentId: m.agentId, pagerId: m.pagerId } : null;
  }
  // Everything M5 stored of this agent, for its pager's move, read and never changed.
  private export(): AgentExport {
    const agent = this.meta();
    if (!agent) return { agent: null, decisions: [], attachments: [], answers: [], acknowledgements: [], pickups: [], collections: [], warnings: [] };
    return {
      agent,
      decisions: this.rows<{ decisionId: string; card: string; preview: string; digest: string; askedAt: string }>('SELECT id AS decisionId, card, preview, digest, asked_at AS askedAt FROM decisions_v3 ORDER BY rowid'),
      attachments: this.rows<{ decisionId: string; slot: number; part: string }>('SELECT decision_id AS decisionId, slot, part FROM attachments_v3 ORDER BY decision_id, slot'),
      answers: this.rows<{ decisionId: string; requestId: string; answerId: string; part: string; sentAt: string }>('SELECT decision_id AS decisionId, request_id AS requestId, answer_id AS answerId, part, sent_at AS sentAt FROM answers_v3'),
      acknowledgements: this.rows<{ decisionId: string; part: string; acknowledgedAt: string }>('SELECT decision_id AS decisionId, part, acknowledged_at AS acknowledgedAt FROM acknowledgements_v3'),
      pickups: this.rows<{ decisionId: string; due: number }>('SELECT decision_id AS decisionId, due FROM pickups_v3'),
      collections: this.rows<{ decisionId: string; at: string }>('SELECT decision_id AS decisionId, at FROM collections_v3'),
      warnings: this.rows<{ decisionId: string; at: string }>('SELECT decision_id AS decisionId, at FROM warnings_v3'),
    };
  }
  // Everything goes at once, the way to its pager included, so a call naming this agent is refused as unknown.
  private async forget() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
  private pager(pagerId: string, path: string, init: { method: string; headers: Headers | Record<string, string>; body?: ArrayBuffer | string }) {
    return forward(this.env.PAGER, pagerId, `/${pagerId}${path}`, init);
  }

  // An agent from before M6 still has M5's alarm, for its housekeeping or an answer's warning. Those clocks are its
  // pager's store's now: this asks that store to take the agent over, if it hasn't yet, so the clock goes on there.
  // Once the store holds the agent, this store's clock stops. A store that has moved and doesn't hold the agent means
  // no pager holds it any more (forgotten, or its pager deleted), and what is left here goes.
  async alarm() {
    const m = this.meta();
    if (!m) { await this.ctx.storage.deleteAlarm(); return; }
    let held: boolean;
    try {
      const reply = await this.pager(m.pagerId, '/nudge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId: m.agentId }) });
      if (!reply.ok) throw new Error(`the pager's store answered ${reply.status}`);
      held = decode(Held, await reply.json()).held;
    } catch (error) {
      console.error('An old agent store could not reach its pager\'s store', error instanceof Error ? error.message : 'unknown');
      await this.ctx.storage.setAlarm(Date.now() + NUDGE_RETRY_MS);
      return;
    }
    if (held) await this.ctx.storage.deleteAlarm(); else await this.forget();
  }

  async fetch(request: Request): Promise<Response> {
    try { return await this.handle(request); } catch (error) { return refusal(error); }
  }
  private async handle(request: Request): Promise<Response> {
    const url = new URL(request.url), action = url.pathname.split('/').filter(Boolean)[0];
    // From the Worker: a new agent connects. This store keeps the way to its pager, whose store makes the agent if the
    // number and the switch allow. A refusal leaves nothing here, not even the table.
    if (action === 'open') {
      const input = decode(Open, await body(request));
      this.ctx.storage.transactionSync(() => {
        if (this.where()) throw C.refuse.invalid('This agent already exists.');
        this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS link_v4 (id INTEGER PRIMARY KEY CHECK(id=1), agent_id TEXT NOT NULL, pager_id TEXT NOT NULL)');
        this.ctx.storage.sql.exec('INSERT INTO link_v4 VALUES (1, ?, ?)', input.agentId, input.pagerId);
      });
      const reply = await this.pager(input.pagerId, '/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId: input.agentId, fingerprint: input.fingerprint, identity: input.identity }) });
      if (reply.status >= 400 && reply.status < 500) await this.ctx.storage.deleteAll();
      return reply;
    }
    // From its pager's store, at the move.
    if (action === 'export') return json(this.export());
    // From its pager's store, once it has forgotten the agent or deleted its pager, or from the Registry, for a pager
    // deleted before M6.
    if (action === 'forget') { await this.forget(); return json({ ok: true }); }
    // Every other call, as the Worker names it (/status, /ask, /read/<decision>, /ack/<decision>, /finish,
    // /answer/<decision>, /file/<decision>/<slot>), goes on to the agent's pager's store with its keys and its input.
    const to = this.where();
    if (!to) throw C.refuse.unknownAgent();
    return this.pager(to.pagerId, `/agent/${to.agentId}${url.pathname}${url.search}`, {
      method: request.method, headers: request.headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    });
  }
}
