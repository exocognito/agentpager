import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import { Token, Timestamp } from './contract.ts';
import { Refusal } from './contract.ts';
import { body, decode, json, refusal } from './shared.ts';
import { PushTarget } from './push.ts';
import type { Env } from './env.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const Put = Schema.Struct({ codeHash: Digest, sessionId: Token, expiresAt: Timestamp });
const Key = Schema.Struct({ codeHash: Digest });
const NumberPut = Schema.Struct({ numberHash: Digest, phoneHash: Digest });
const NumberPage = Schema.Struct({ numberHash: Digest, sessionId: Token, expiresAt: Timestamp });
const PhoneKey = Schema.Struct({ phoneHash: Digest });
const NumberPush = Schema.Struct({ phoneHash: Digest, push: PushTarget });

// Maps a link code's SHA-256 to its pager for the pairing window only. The plain code is never stored.
// Also keeps each phone key's one pager number and the pagers agents opened with it, as digests, and where that
// phone gets alerts, which each pager opened with the number starts with.
export class Registry {
  constructor(private ctx: DurableObjectState, private env: Env) {
    void this.env;
    // Old pairing and connect tables held plain tokens; old links fail by design.
    ctx.storage.sql.exec(`DROP TABLE IF EXISTS ap_links_v1; DROP TABLE IF EXISTS ap_connects_v1;
      CREATE TABLE IF NOT EXISTS links_v2 (code_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS numbers_v1 (phone_hash TEXT PRIMARY KEY, number_hash TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS number_pagers_v1 (phone_hash TEXT NOT NULL, session_id TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY (phone_hash, session_id));
      CREATE TABLE IF NOT EXISTS number_push_v1 (phone_hash TEXT PRIMARY KEY, json TEXT NOT NULL);`);
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM links_v2 WHERE expires_at <= ?', now);
      this.ctx.storage.sql.exec('DELETE FROM number_pagers_v1 WHERE expires_at <= ?', now);
      const action = new URL(request.url).pathname.slice(1), data = await body(request);
      // A phone key holds one number; a new one replaces it, so the old number stops opening pagers at once.
      if (action === 'number-put') {
        const p = decode(NumberPut, data);
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO numbers_v1 VALUES (?, ?)', p.phoneHash, p.numberHash);
        return json({ ok: true });
      }
      if (action === 'number-page') {
        const p = decode(NumberPage, data);
        const row = this.ctx.storage.sql.exec<{ phone_hash: string }>('SELECT phone_hash FROM numbers_v1 WHERE number_hash=?', p.numberHash).toArray()[0];
        if (!row) return json({ phoneHash: null });
        this.ctx.storage.sql.exec('INSERT INTO number_pagers_v1 VALUES (?, ?, ?)', row.phone_hash, p.sessionId, Date.parse(p.expiresAt));
        const push = this.ctx.storage.sql.exec<{ json: string }>('SELECT json FROM number_push_v1 WHERE phone_hash=?', row.phone_hash).toArray()[0];
        // `push` only when there is one: a Worker from before alerts refuses fields it does not know (see worker.ts).
        return json({ phoneHash: row.phone_hash, ...(push ? { push: decode(PushTarget, JSON.parse(push.json)) } : {}) });
      }
      // Only a phone key that holds a number keeps a token here.
      if (action === 'number-push') {
        const p = decode(NumberPush, data);
        if (!this.ctx.storage.sql.exec('SELECT 1 FROM numbers_v1 WHERE phone_hash=?', p.phoneHash).toArray().length) throw new Refusal('Unauthorized', 'This phone key has no pager number.');
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO number_push_v1 VALUES (?, ?)', p.phoneHash, JSON.stringify(p.push));
        return json({ ok: true });
      }
      // Listed by phone key, not number, so a pager opened just before a change of number still reaches the phone.
      if (action === 'number-list') {
        const p = decode(PhoneKey, data);
        const rows = this.ctx.storage.sql.exec<{ session_id: string }>('SELECT session_id FROM number_pagers_v1 WHERE phone_hash=? ORDER BY rowid DESC', p.phoneHash).toArray();
        return json({ sessionIds: rows.map(r => r.session_id) });
      }
      if (action === 'put') {
        const p = decode(Put, data);
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO links_v2 VALUES (?, ?, ?)', p.codeHash, p.sessionId, Date.parse(p.expiresAt));
        return json({ ok: true });
      }
      const k = decode(Key, data);
      if (action === 'get') {
        const row = this.ctx.storage.sql.exec<{ session_id: string }>('SELECT session_id FROM links_v2 WHERE code_hash=? AND expires_at > ?', k.codeHash, now).toArray()[0];
        return json({ sessionId: row ? row.session_id : null });
      }
      if (action === 'delete') { this.ctx.storage.sql.exec('DELETE FROM links_v2 WHERE code_hash=?', k.codeHash); return json({ ok: true }); }
      return json({ error: 'NotFound' }, 404);
    } catch (error) { return refusal(error); }
  }
}
