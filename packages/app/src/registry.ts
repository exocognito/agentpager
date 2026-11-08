import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import * as C from './contract.ts';
import { body, decode, json, refusal } from './shared.ts';
import { forward, type Env } from './env.ts';
import type { RegistryExport } from './move.ts';

const Id = Schema.Struct({ pagerId: C.PagerId });
const Forget = Schema.Struct({ pagerId: C.PagerId, agentId: C.Token });

type Row = { pager_id: string; fingerprint: string; public_key: string; phone_hash: string; enabled: number; auto_off: string; off_at: number | null; off_since: number | null; push: string | null; created_at: number };

// What M5 stored of every pager, in one object: each pager's row (its public key, its phone key as a digest, its
// switch, auto-off, off-since and alert target) and which agents connected to it. Since M6 each pager has its own
// store (pager.ts), which takes its row and its agents from here at its first call (/export) and keeps them from then
// on. What is here stays, unused and never written again, until a later release removes it, except that a pager's
// store erases what is here of a pager it deleted (/drop) or an agent it forgot (/forget).
//   pagers_v2        each pager's row, as M5 last wrote it
//   pager_agents_v3  the agents connected to each pager, in connect order
//   erase_v2         agents of pagers deleted before M6, still to forget everything
export class Registry {
  constructor(private ctx: DurableObjectState, private env: Env) {
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS pagers_v2 (pager_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, public_key TEXT NOT NULL, phone_hash TEXT NOT NULL,
        enabled INTEGER NOT NULL, auto_off TEXT NOT NULL, off_at INTEGER, off_since INTEGER, push TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS pager_agents_v3 (pager_id TEXT NOT NULL, agent_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (pager_id, agent_id));
      CREATE TABLE IF NOT EXISTS erase_v2 (agent_id TEXT PRIMARY KEY);`);
    // Whatever a delete before M6 left queued to forget is tried at once, from this start.
    void ctx.blockConcurrencyWhile(async () => {
      if (ctx.storage.sql.exec('SELECT 1 FROM erase_v2 LIMIT 1').toArray().length && await ctx.storage.getAlarm() === null) await ctx.storage.setAlarm(Date.now());
    });
  }
  // A pager deleted before M6 took its agents with it: each is still asked to forget everything, now and then every
  // minute until done. Until then its agent finds its pager gone on any call.
  private async erase() {
    const ids = this.ctx.storage.sql.exec<{ agent_id: string }>('SELECT agent_id FROM erase_v2').toArray().map(r => r.agent_id);
    await Promise.all(ids.map(async id => {
      const done = await forward(this.env.AGENT, id, '/forget', { method: 'POST', headers: {} }).then(r => r.ok, () => false);
      if (done) this.ctx.storage.sql.exec('DELETE FROM erase_v2 WHERE agent_id=?', id);
    }));
    if (this.ctx.storage.sql.exec('SELECT 1 FROM erase_v2 LIMIT 1').toArray().length) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm() { await this.erase(); }

  async fetch(request: Request): Promise<Response> {
    try {
      const action = new URL(request.url).pathname.slice(1), data = await body(request);
      // One pager's row and its agents, for its store's move. It only reads: auto-off that has come due is the pager's
      // store's to apply, from the same row. An agent still queued to forget is never handed over, nor is any agent of
      // a pager that isn't here.
      if (action === 'export') {
        const { pagerId } = decode(Id, data);
        const row = this.ctx.storage.sql.exec<Row>('SELECT * FROM pagers_v2 WHERE pager_id=?', pagerId).toArray()[0];
        const agents = row ? this.ctx.storage.sql.exec<{ agent_id: string }>('SELECT agent_id FROM pager_agents_v3 WHERE pager_id=? AND agent_id NOT IN (SELECT agent_id FROM erase_v2) ORDER BY created_at, rowid', pagerId).toArray().map(r => r.agent_id) : [];
        if (row && row.enabled !== 0 && row.enabled !== 1) throw new Error('A pager row whose switch is neither on nor off.');
        const reply: RegistryExport = {
          pager: row ? { fingerprint: row.fingerprint, publicKey: row.public_key, phoneHash: row.phone_hash, enabled: row.enabled === 1 ? 1 : 0, autoOff: decode(C.AutoOff, row.auto_off), offAt: row.off_at, offSince: row.off_since, push: row.push, createdAt: row.created_at } : null,
          agents,
        };
        return json(reply);
      }
      // A pager's store forgot one of the agents it took from here.
      if (action === 'forget') {
        const p = decode(Forget, data);
        this.ctx.storage.sql.exec('DELETE FROM pager_agents_v3 WHERE pager_id=? AND agent_id=?', p.pagerId, p.agentId);
        return json({ ok: true });
      }
      // A pager's store deleted the pager it took from here.
      if (action === 'drop') {
        const { pagerId } = decode(Id, data);
        this.ctx.storage.transactionSync(() => {
          this.ctx.storage.sql.exec('DELETE FROM pager_agents_v3 WHERE pager_id=?', pagerId);
          this.ctx.storage.sql.exec('DELETE FROM pagers_v2 WHERE pager_id=?', pagerId);
        });
        return json({ ok: true });
      }
      // M5's other routes are each pager's store's now. A call from M5's code during the deploy fails as the server's
      // own failure, which every client tries again, and never as the pager being gone.
      throw new Error(`The Registry no longer serves /${action}; each pager's store does.`);
    } catch (error) { return refusal(error); }
  }
}
