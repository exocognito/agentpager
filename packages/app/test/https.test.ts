import { test } from 'node:test';
import { fixture, assert, raw, sha, pagerKeys, token, C } from './support.ts';
import { keepsToHttps, plainHttp } from '../src/https.ts';

// The local Worker builds each request's URL from its Host header, so a request naming dev.agentpager.me or
// agentpager.me meets the rule exactly as a deployed stage would; one naming the local server's own address doesn't.
// `pnpm smoke:dev` checks the same on dev.agentpager.me itself.
const HSTS = 'max-age=31536000';
const LOCAL = (port: string) => [`127.0.0.1:${port}`, `localhost:${port}`, `192.168.1.20:${port}`, `[::1]:${port}`, `pager.local:${port}`];

test('I23.4 Plain HTTP to a deployed host: GET and HEAD move to HTTPS, anything else is refused unread; a local server keeps plain HTTP', { timeout: 180_000 }, async () => {
  const f = await fixture('https-plain');
  try {
    for (const [method, host, path] of [['GET', 'dev.agentpager.me', '/start?from=docs'], ['GET', 'agentpager.me', '/'], ['HEAD', 'dev.agentpager.me', '/assets/app.js'], ['GET', 'dev.agentpager.me', '/api/agents/x']]) {
      const r = await raw(f.origin + path, { method, host });
      assert.equal(r.status, 308, `${method} ${host}${path}`);
      // wrangler dev's proxy puts its own scheme back on a Location naming the host it was called by; the rule's
      // own test below, and the smoke run on dev, check the scheme.
      const to = new URL(String(r.headers.location));
      assert.equal(to.host + to.pathname + to.search, host + path, `${method} ${host}${path}`);
      assert.equal(r.headers['x-agentpager-build'], sha);
      assert.equal(r.headers['strict-transport-security'], undefined, 'no HSTS over plain HTTP');
    }
    // A pager made over plain HTTP is refused before it is read: the number connects nothing afterwards.
    const keys = pagerKeys();
    const made = await raw(f.origin + '/api/pagers', { method: 'POST', host: 'dev.agentpager.me', body: JSON.stringify({ number: keys.number, publicKey: keys.publicKey, autoOff: 'never' }) });
    assert.equal(made.status, 403);
    const refusal = JSON.parse(made.body);
    assert.equal(refusal.error, 'HttpsRequired');
    assert.ok(refusal.message.includes('https://dev.agentpager.me'), refusal.message);
    assert.equal(made.headers.location, undefined, 'never redirected, so nothing is sent again');
    for (const [method, path] of [['PUT', '/'], ['DELETE', '/api/pagers/x'], ['POST', '/api/agents'], ['PATCH', '/start']]) {
      assert.equal((await raw(f.origin + path, { method, host: 'agentpager.me', body: '{}' })).status, 403, `${method} ${path}`);
    }
    await f.refused(410, 'NumberInvalid', '/api/agents', { data: { number: keys.number, app: 'Codex', project: 'https' } });
    // The same calls on the local server's own addresses, and on a LAN or .local name, are served as before.
    const port = new URL(f.origin).port;
    for (const host of LOCAL(port)) {
      const r = await raw(f.origin + '/start', { host });
      assert.equal(r.status, 200, host); assert.equal(r.headers.location, undefined, host);
      assert.equal(r.headers['strict-transport-security'], undefined, host);
    }
    const local = pagerKeys();
    await f.ok(C.PagerReply, '/api/pagers', { phone: token(), data: { number: local.number, publicKey: local.publicKey, autoOff: 'never' } });
  } finally { await f.stop(); }
});

test('I23.4 Every HTTPS reply from a deployed host tells browsers to keep to HTTPS; a local server name gets no HSTS', { timeout: 180_000 }, async () => {
  const f = await fixture('https-hsts', undefined, { https: true });
  try {
    for (const [method, path] of [['GET', '/start'], ['GET', '/'], ['GET', '/missing'], ['GET', '/app'], ['POST', '/api/agents'], ['GET', '/api/pagers/x']]) {
      for (const host of ['dev.agentpager.me', 'agentpager.me']) {
        const r = await raw(f.origin + path, { method, host, ...(method === 'POST' ? { body: '{}' } : {}) });
        assert.equal(r.headers['strict-transport-security'], HSTS, `${method} ${host}${path} (${r.status})`);
        assert.notEqual(r.status, 308, `${method} ${host}${path}`);
      }
    }
    const port = new URL(f.origin).port;
    for (const host of LOCAL(port)) {
      const r = await raw(f.origin + '/start', { host });
      assert.equal(r.status, 200, host); assert.equal(r.headers['strict-transport-security'], undefined, host);
    }
  } finally { await f.stop(); }
});

test('I23.4 The redirect is the same address on HTTPS; only a deployed host is redirected, refused or kept to HTTPS', async () => {
  for (const [from, to] of [['http://dev.agentpager.me/start?from=docs', 'https://dev.agentpager.me/start?from=docs'], ['http://agentpager.me/', 'https://agentpager.me/'], ['http://agentpager.me:8080/a/b', 'https://agentpager.me:8080/a/b']]) {
    for (const method of ['GET', 'HEAD']) {
      const r = plainHttp(new URL(from), method);
      assert.equal(r?.status, 308, from); assert.equal(r?.headers.get('location'), to, from);
    }
    const refused = plainHttp(new URL(from), 'POST');
    assert.equal(refused?.status, 403); assert.equal((await refused?.json()).error, 'HttpsRequired');
    assert.equal(keepsToHttps(new URL(from)), false, 'no HSTS over plain HTTP');
    assert.equal(keepsToHttps(new URL(to)), true, to);
  }
  for (const local of ['http://127.0.0.1:8787/start', 'http://localhost:8787/', 'http://192.168.1.20:8787/api/agents', 'http://[::1]:8787/', 'http://pager.local:8787/', 'http://app.localhost/']) {
    for (const method of ['GET', 'POST']) assert.equal(plainHttp(new URL(local), method), undefined, `${method} ${local}`);
    assert.equal(keepsToHttps(new URL(local.replace('http:', 'https:'))), false, local);
  }
  for (const secure of ['https://dev.agentpager.me/', 'https://agentpager.me/api/agents']) assert.equal(plainHttp(new URL(secure), 'POST'), undefined, secure);
});
