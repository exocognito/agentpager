import { Schema } from 'effect';
import * as C from './contract.ts';
import { BUILD, forward, type Env } from './env.ts';
import { body, decode, emptyBody, json, read, refusal, sha256, token } from './shared.ts';
import { startDocument } from './start.ts';
import { PushTarget } from './push.ts';
export { Agent } from './agent.ts';
export { Registry } from './registry.ts';

// A refusal from a Durable Object, passed on to the caller as it is.
class Relay extends Error { constructor(readonly response: Response) { super('relayed refusal'); } }
const relay = (response: Response) => { if (!response.ok) throw new Relay(response); return response; };
const failure = async (error: unknown) => error instanceof Relay ? error.response : refusal(error);

const registry = (env: Env, path: string, data: unknown) => forward(env.REGISTRY, 'registry', path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
async function phoneHash(request: Request) {
  const key = request.headers.get(C.PHONE_AUTH_HEADER);
  if (!key || !Schema.is(C.Token)(key)) throw C.refuse.unauthorized();
  return sha256(key);
}
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const base64url = (text: string) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
// The pager number names the pager and the first 8 bytes of its public key's SHA-256 (docs/v2/04-encryption.md §2).
function parseNumber(number: string) {
  if (!Schema.is(C.PagerNumber)(number)) throw C.refuse.numberInvalid();
  const bytes = hex(base64url(number.slice(4)));
  return { pagerId: bytes.slice(0, 32), fingerprint: bytes.slice(32) };
}
async function fingerprint(publicKey: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', base64url(publicKey))).slice(0, 8));
}

const PagerHit = Schema.Struct({ pager: C.Pager, agentIds: Schema.Array(C.Token) });
const Linked = Schema.Struct({ phoneHash: Schema.String });
// The phone's own pager, checked before its input is read: a wrong key wins over invalid input (I4).
async function ownPager(env: Env, request: Request, pagerId: string) {
  const hash = await phoneHash(request);
  const reply = await read('/get', p => registry(env, p, { pagerId, phoneHash: hash }));
  return { hash, hit: decode(PagerHit, await relay(reply).json()) };
}

// Public HTTPS routes -> the Registry (pagers) or one agent's object.
async function api(request: Request, env: Env): Promise<Response> {
  const u = new URL(request.url), method = request.method, parts = u.pathname.split('/').filter(Boolean).slice(1);
  const pass = async (agentId: string, path: string) => method === 'GET'
    ? read(path + u.search, p => forward(env.AGENT, agentId, p, { method, headers: request.headers }))
    : forward(env.AGENT, agentId, path + u.search, { method, headers: request.headers, body: await request.arrayBuffer() });

  // The phone makes a pager with the number it made, and the public key the number's fingerprint names.
  if (parts.length === 1 && parts[0] === 'pagers' && method === 'POST') {
    const hash = await phoneHash(request), input = decode(C.CreatePagerInput, await body(request));
    const { pagerId, fingerprint: named } = parseNumber(input.number);
    if (named !== await fingerprint(input.publicKey)) throw C.refuse.invalid('number: its fingerprint does not match publicKey');
    return registry(env, '/create', { pagerId, fingerprint: named, publicKey: input.publicKey, phoneHash: hash, autoOff: input.autoOff });
  }
  if (parts[0] === 'pagers' && parts.length >= 2) {
    const pagerId = decode(C.PagerId, parts[1]), rest = parts.slice(2).join('/');
    // Everything on the pager, read while it is on or off: its state and each agent's decisions.
    if (rest === '' && method === 'GET') {
      const { hit } = await ownPager(env, request, pagerId);
      const headers = { [C.PHONE_AUTH_HEADER]: request.headers.get(C.PHONE_AUTH_HEADER) ?? '' };
      const replies = await Promise.all(hit.agentIds.map(id => read('/inbox', p => forward(env.AGENT, id, p, { method: 'GET', headers }))));
      const agents: C.AgentInbox[] = [];
      // An agent housekeeping has just forgotten is skipped; its pager stops listing it.
      for (const reply of replies) if (reply.status !== 404) agents.push(decode(C.AgentInbox, await relay(reply).json()));
      return json(decode(C.PagerInbox, { pager: hit.pager, agents }));
    }
    if (rest === 'settings' && method === 'POST') {
      const { hash } = await ownPager(env, request, pagerId), input = decode(C.PagerSettingsInput, await body(request));
      return registry(env, '/settings', { pagerId, phoneHash: hash, ...input });
    }
    if (rest === 'push' && method === 'POST') {
      const { hash } = await ownPager(env, request, pagerId), push = decode(PushTarget, await body(request));
      return registry(env, '/push', { pagerId, phoneHash: hash, push });
    }
    // Deleting a pager deletes its agents and their decisions from the service (the Registry sees it through).
    if (rest === 'delete' && method === 'POST') {
      const { hash } = await ownPager(env, request, pagerId);
      await emptyBody(request);
      return registry(env, '/delete', { pagerId, phoneHash: hash });
    }
  }
  // An agent connects with the owner's pager number: a new agent on that pager, every time.
  if (parts.length === 1 && parts[0] === 'agents' && method === 'POST') {
    const input = decode(C.ConnectInput, await body(request));
    const { pagerId, fingerprint: named } = parseNumber(input.number), agentId = token();
    const linked = decode(Linked, await relay(await registry(env, '/connect', { pagerId, fingerprint: named, agentId })).json());
    return forward(env.AGENT, agentId, '/open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agentId, pagerId, phoneHash: linked.phoneHash, app: input.app, project: input.project }) });
  }
  if (parts[0] === 'agents' && parts.length >= 2) {
    const agentId = decode(C.Token, parts[1]), rest = parts.slice(2).join('/');
    if (rest === '' && method === 'GET') return pass(agentId, '/status');
    if (rest === 'cards' && method === 'POST') return pass(agentId, '/ask');
    // The decision id and file name go on as sent: the agent decodes them after the key (I4).
    if (parts.length === 5 && parts[2] === 'cards') {
      const decisionId = parts[3];
      if (parts[4] === 'answer') return pass(agentId, `/${method === 'GET' ? 'read' : 'answer'}/${decisionId}`);
      if (parts[4] === 'acknowledge' && method === 'POST') return pass(agentId, `/ack/${decisionId}`);
    }
    if (parts.length === 6 && parts[2] === 'cards' && parts[4] === 'files' && method === 'GET') return pass(agentId, `/file/${parts[3]}/${parts[5]}`);
    if (rest === 'finish' && method === 'POST') return pass(agentId, '/finish');
  }
  throw C.refuse.notFound();
}

const isBrowser = (request: Request) => request.headers.get('sec-fetch-dest') === 'document' ||
  ((request.headers.get('accept') ?? '').includes('text/html') && (request.headers.get('user-agent') ?? '').includes('Mozilla'));
const text = (value: string, type: string, status = 200) => new Response(value, { status, headers: { 'content-type': `${type}; charset=utf-8` } });

async function serve(request: Request, env: Env) {
  const u = new URL(request.url), origin = u.origin;
  // The hosted MCP server is retired (docs/v2/01-decisions.md): an agent that arrives there, or at /start, is told to
  // install the agentpager command. The HTTP API stays as that command's transport.
  if (u.pathname === '/mcp') return text(startDocument(origin), 'text/markdown', 410);
  if (u.pathname.startsWith('/api/')) return api(request, env);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'MethodNotAllowed', message: 'Use GET.' }, 405);
  if (u.pathname === '/start') return text(startDocument(origin), 'text/markdown');
  if (u.pathname === '/favicon.ico') return new Response(null, { status: 204 });
  if (u.pathname === '/' && !isBrowser(request)) return text(`# AgentPager\n\nAgents start at ${origin}/start.\n`, 'text/markdown');
  // The owner's side is the iPhone app, so the web serves the front page alone; the old web app's address leads there.
  if (u.pathname === '/app') return Response.redirect(origin + '/', 302);
  if (u.pathname !== '/' && !u.pathname.startsWith('/assets/')) return json({ error: 'NotFound', message: 'No such page. Agents read /start.' }, 404);
  const asset = await env.ASSETS.fetch(new URL(u.pathname === '/' ? '/index.html' : u.pathname, u.origin).href);
  return new Response(await asset.arrayBuffer(), { status: asset.status, headers: Object.fromEntries(asset.headers) });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try { response = await serve(request, env); } catch (error) { response = await failure(error); }
    const headers = new Headers(response.headers);
    headers.set('X-AgentPager-Build', BUILD);
    headers.set('Cache-Control', 'no-store');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    return new Response(response.body, { status: response.status, headers });
  },
};
