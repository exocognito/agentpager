import type { DurableObjectState } from '@cloudflare/workers-types';
import { Schema } from 'effect';
import { Token, Timestamp } from './contract.ts';
import { body, decode, json, refusal } from './shared.ts';
import type { Env } from './env.ts';

const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
const Put = Schema.Struct({ codeHash: Digest, sessionId: Token, expiresAt: Timestamp });
const Key = Schema.Struct({ codeHash: Digest });

// Maps a link code's SHA-256 to its pager for the pairing window only. The plain code is never stored.
export class Registry {
  constructor(private ctx: DurableObjectState, private env: Env) {
    void this.env;
    // Old pairing and connect tables held plain tokens; old links fail by design.
    ctx.storage.sql.exec(`DROP TABLE IF EXISTS ap_links_v1; DROP TABLE IF EXISTS ap_connects_v1;
      CREATE TABLE IF NOT EXISTS links_v2 (code_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL, expires_at INTEGER NOT NULL);`);
  }
  async fetch(request: Request): Promise<Response> {
    try {
      const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM links_v2 WHERE expires_at <= ?', now);
      const action = new URL(request.url).pathname.slice(1);
      if (action === 'put') {
        const p = decode(Put, await body(request));
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO links_v2 VALUES (?, ?, ?)', p.codeHash, p.sessionId, Date.parse(p.expiresAt));
        return json({ ok: true });
      }
      const k = decode(Key, await body(request));
      if (action === 'get') {
        const row = this.ctx.storage.sql.exec<{ session_id: string }>('SELECT session_id FROM links_v2 WHERE code_hash=? AND expires_at > ?', k.codeHash, now).toArray()[0];
        return json({ sessionId: row ? row.session_id : null });
      }
      if (action === 'delete') { this.ctx.storage.sql.exec('DELETE FROM links_v2 WHERE code_hash=?', k.codeHash); return json({ ok: true }); }
      return json({ error: 'NotFound' }, 404);
    } catch (error) { return refusal(error); }
  }
}
