import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import * as C from './contract.ts';
import { body, decode, iso, json, refusal, sameDigest } from './shared.ts';
import { PushTarget } from './push.ts';
import { clocks, type Env } from './env.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const Fingerprint = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{16}$/));
const Create = Schema.Struct({ pagerId: C.PagerId, fingerprint: Fingerprint, publicKey: C.PublicKey, phoneHash: Digest, autoOff: C.AutoOff });
const Phone = Schema.Struct({ pagerId: C.PagerId, phoneHash: Digest });
const Settings = Schema.Struct({ ...Phone.fields, on: Schema.optional(Schema.Boolean), autoOff: Schema.optional(C.AutoOff) });
const Push = Schema.Struct({ ...Phone.fields, push: PushTarget });
const Connect = Schema.Struct({ pagerId: C.PagerId, fingerprint: Fingerprint, agentId: C.Token });
const Id = Schema.Struct({ pagerId: C.PagerId });
const PushGone = Schema.Struct({ pagerId: C.PagerId, token: Schema.String });
const Forget = Schema.Struct({ pagerId: C.PagerId, agentId: C.Token });

type Row = { pager_id: string; fingerprint: string; public_key: string; phone_hash: string; enabled: number; auto_off: string; off_at: number | null; off_since: number | null; push: string | null; created_at: number };

// The pagers: each phone-made pager's public key, its phone key as a digest, whether it is on, when it turns off by
// itself, and where its phone gets alerts. Also which agents connected to each, so the phone can read them and a
// deleted pager can take them with it. No names: those live only on the phone.
export class Registry {
  constructor(private ctx: DurableObjectState, private env: Env) {
    void this.env;
    // v1 links and numbers fail by design: v2 is a fresh install.
    ctx.storage.sql.exec(`DROP TABLE IF EXISTS links_v2; DROP TABLE IF EXISTS numbers_v1; DROP TABLE IF EXISTS number_pagers_v1; DROP TABLE IF EXISTS number_push_v1;
      CREATE TABLE IF NOT EXISTS pagers_v2 (pager_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, public_key TEXT NOT NULL, phone_hash TEXT NOT NULL,
        enabled INTEGER NOT NULL, auto_off TEXT NOT NULL, off_at INTEGER, off_since INTEGER, push TEXT, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS pager_agents_v2 (pager_id TEXT NOT NULL, agent_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (pager_id, agent_id));`);
  }
  private row(pagerId: string) { return this.ctx.storage.sql.exec<Row>('SELECT * FROM pagers_v2 WHERE pager_id=?', pagerId).toArray()[0]; }
  // Only the pager's own phone key reads or changes it.
  private mine(p: { pagerId: string; phoneHash: string }) {
    const row = this.row(p.pagerId);
    if (!row) throw C.refuse.unknownPager();
    if (!sameDigest(p.phoneHash, row.phone_hash)) throw C.refuse.unauthorized();
    return row;
  }
  private pager(row: Row): C.Pager {
    return decode(C.Pager, { pagerId: row.pager_id, on: row.enabled === 1, autoOff: row.auto_off, offAt: row.off_at === null ? null : iso(row.off_at), offSince: row.off_since === null ? null : iso(row.off_since), createdAt: iso(row.created_at) });
  }
  private agents(pagerId: string) {
    return this.ctx.storage.sql.exec<{ agent_id: string }>('SELECT agent_id FROM pager_agents_v2 WHERE pager_id=? ORDER BY created_at, rowid', pagerId).toArray().map(r => r.agent_id);
  }
  // Turned on now: it turns off by itself after its auto-off time, if it has one.
  private offAt(autoOff: C.AutoOff, now: number) { return autoOff === 'never' ? null : now + clocks.autoOffMs(autoOff); }

  async fetch(request: Request): Promise<Response> {
    try {
      const now = Date.now();
      // Auto-off lands in the same state as the switch: off since the time it was due.
      this.ctx.storage.sql.exec('UPDATE pagers_v2 SET enabled=0, off_since=off_at, off_at=NULL WHERE enabled=1 AND off_at IS NOT NULL AND off_at <= ?', now);
      const action = new URL(request.url).pathname.slice(1), data = await body(request);
      if (action === 'create') {
        const p = decode(Create, data);
        if (this.row(p.pagerId)) throw C.refuse.pagerExists();
        this.ctx.storage.sql.exec('INSERT INTO pagers_v2 VALUES (?, ?, ?, ?, 1, ?, ?, NULL, NULL, ?)', p.pagerId, p.fingerprint, p.publicKey, p.phoneHash, p.autoOff, this.offAt(p.autoOff, now), now);
        return json({ pager: this.pager(this.row(p.pagerId)) });
      }
      if (action === 'get') {
        const row = this.mine(decode(Phone, data));
        return json({ pager: this.pager(row), agentIds: this.agents(row.pager_id) });
      }
      if (action === 'settings') {
        const p = decode(Settings, data);
        let row = this.mine(p);
        if (p.autoOff !== undefined) {
          // Counted from now while on; an off pager keeps the choice for when it is turned on.
          this.ctx.storage.sql.exec('UPDATE pagers_v2 SET auto_off=?, off_at=? WHERE pager_id=?', p.autoOff, row.enabled === 1 ? this.offAt(p.autoOff, now) : null, p.pagerId);
          row = this.mine(p);
        }
        if (p.on === true && row.enabled === 0) this.ctx.storage.sql.exec('UPDATE pagers_v2 SET enabled=1, off_since=NULL, off_at=? WHERE pager_id=?', this.offAt(decode(C.AutoOff, row.auto_off), now), p.pagerId);
        if (p.on === false && row.enabled === 1) this.ctx.storage.sql.exec('UPDATE pagers_v2 SET enabled=0, off_since=?, off_at=NULL WHERE pager_id=?', now, p.pagerId);
        return json({ pager: this.pager(this.mine(p)) });
      }
      if (action === 'push') {
        const p = decode(Push, data);
        this.mine(p);
        this.ctx.storage.sql.exec('UPDATE pagers_v2 SET push=? WHERE pager_id=?', JSON.stringify(p.push), p.pagerId);
        return json({ ok: true });
      }
      // Apple says a token is gone: drop it, unless the phone has given a new one since.
      if (action === 'push-gone') {
        const p = decode(PushGone, data), row = this.row(p.pagerId);
        if (row?.push && decode(PushTarget, JSON.parse(row.push)).token === p.token) this.ctx.storage.sql.exec('UPDATE pagers_v2 SET push=NULL WHERE pager_id=?', p.pagerId);
        return json({ ok: true });
      }
      if (action === 'delete') {
        const row = this.mine(decode(Phone, data)), agentIds = this.agents(row.pager_id);
        this.ctx.storage.sql.exec('DELETE FROM pager_agents_v2 WHERE pager_id=?', row.pager_id);
        this.ctx.storage.sql.exec('DELETE FROM pagers_v2 WHERE pager_id=?', row.pager_id);
        return json({ agentIds });
      }
      // An agent connects with the number: the fingerprint must match, and the pager must be on.
      if (action === 'connect') {
        const p = decode(Connect, data), row = this.row(p.pagerId);
        if (!row || row.fingerprint !== p.fingerprint) throw C.refuse.numberInvalid();
        if (row.enabled !== 1) throw C.refuse.pagerOff();
        this.ctx.storage.sql.exec('INSERT INTO pager_agents_v2 VALUES (?, ?, ?)', p.pagerId, p.agentId, now);
        return json({ phoneHash: row.phone_hash });
      }
      // What an agent checks before each call: is its pager on, and where do alerts go.
      if (action === 'state') {
        const row = this.row(decode(Id, data).pagerId);
        if (!row) return json({ state: 'gone' });
        return json({ state: row.enabled === 1 ? 'on' : 'off', push: row.push ? decode(PushTarget, JSON.parse(row.push)) : null });
      }
      // Housekeeping forgot an agent.
      if (action === 'forget') {
        const p = decode(Forget, data);
        this.ctx.storage.sql.exec('DELETE FROM pager_agents_v2 WHERE pager_id=? AND agent_id=?', p.pagerId, p.agentId);
        return json({ ok: true });
      }
      return json({ error: 'NotFound' }, 404);
    } catch (error) { return refusal(error); }
  }
}
