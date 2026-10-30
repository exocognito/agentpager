import { JSONSchema, Schema } from 'effect';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as C from './contract.ts';
import { BUILD, forward, type Env } from './env.ts';
import { body, decode, emptyBody, json, read, refusal, sha256, token } from './shared.ts';
import { startDocument } from './start.ts';
import { PushTarget } from './push.ts';
import { AttachmentName } from '../../blueprint/design/ui/components/cards/brief/schema.ts';
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
    if (parts.length === 5 && parts[2] === 'cards') {
      const decisionId = decode(C.Token, parts[3]);
      if (parts[4] === 'answer') return pass(agentId, `/${method === 'GET' ? 'read' : 'answer'}/${decisionId}`);
      if (parts[4] === 'acknowledge' && method === 'POST') return pass(agentId, `/ack/${decisionId}`);
    }
    if (parts.length === 6 && parts[2] === 'cards' && parts[4] === 'files' && method === 'GET') {
      return pass(agentId, `/file/${decode(C.Token, parts[3])}/${decode(AttachmentName, parts[5])}`);
    }
    if (rest === 'finish' && method === 'POST') return pass(agentId, '/finish');
  }
  throw C.refuse.notFound();
}

// Tool replies are the same JSON as the HTTP API's. Each description names this server, so an agent can tell
// tools for another AgentPager server apart.
const descriptions = (origin: string): Record<keyof typeof C.MCP_TOOLS, string> => ({
  connect: `Connect to your owner's pager with the pager number they gave you (usually in AGENTS.md; it starts ap1_), on the AgentPager server ${origin}. You become a new agent on their phone: keep agentId and agentKey for every later call in this piece of work, and never show agentKey or the number. Connecting again adds another agent. app is who you are (Codex, Claude Code…); project is what you are working on, usually the repository's name: your owner's phone groups decisions by it. Then call ask. Full guide: ${origin}/start`,
  ask: `Ask your owner one decision as a "brief" card: a Markdown decision brief with 2 to 4 lettered options (number 1 is A) and optional attachments. Read "Decision briefs" in ${origin}/start before your first one. At most 10 unanswered decisions per agent. When your owner has turned the pager off, it is refused with PagerOff and nothing is queued. Replies {decisionId}.`,
  wait: 'Hold a read for up to 50 seconds. Replies {status:"pending"} (read again) or {status:"answered", answer:{answerId, choice, ...}}. A choice of kind "feedback" is your owner\'s note instead of an option: follow it, and ask a new card only if you still need a decision. On InternalError, read again after a few seconds; if it keeps failing for several minutes, stop and tell your owner. Keep reading while you have nothing better to do; if your turn ends, the answer waits for your next turn.',
  ack: 'Acknowledge the exact answerId with your next steps; your owner sees them with a green tick. Only the first acknowledgement counts.',
  status: "This agent's state, and whether its pager is on.",
  finish: 'Tell your owner you are done with this piece of work. Your decisions stay on their phone; this agent asks nothing more.',
});
// A keyed tool call is decoded only as far as routing needs: the agent's and the decision's ids. The key goes on only
// when well formed (a malformed key is no key, as over HTTP), and the question, acknowledgement and wait go on as
// sent, so the agent checks the key before any of them (I4). tools/list still lists the full schemas.
const Keyed = { agentId: C.Token, agentKey: Schema.optional(Schema.Unknown) };
const AskCall = Schema.Struct({ ...Keyed, question: Schema.optional(Schema.Unknown) });
const WaitCall = Schema.Struct({ ...Keyed, decisionId: C.Token, waitSeconds: Schema.optional(Schema.Unknown) });
const AckCall = Schema.Struct({ ...Keyed, decisionId: C.Token, acknowledgement: Schema.optional(Schema.Unknown) });
const AgentCall = Schema.Struct(Keyed);
const keyOf = (value: unknown) => Schema.is(C.Token)(value) ? value : undefined;
async function mcp(request: Request, env: Env, origin: string) {
  // Stateless JSON replies only: never let the SDK open a GET event stream.
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed. Use POST.' } }), { status: 405, headers: { 'content-type': 'application/json', allow: 'POST' } });
  }
  const server = new Server({ name: 'AgentPager', version: BUILD }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: Object.entries(C.MCP_TOOLS).map(([name, tool]) => ({ name, description: Object.entries(descriptions(origin)).find(([key]) => key === name)?.[1], inputSchema: { ...JSONSchema.fromAST(tool.input.ast, { definitions: {} }), type: 'object' } })) }));
  server.setRequestHandler(CallToolRequestSchema, async (call) => {
    const raw = call.params.arguments;
    try {
      let path: string, method = 'POST', data: unknown, agentKey: string | undefined, missing: string | undefined;
      switch (call.params.name) {
        case 'connect': { data = decode(C.MCP_TOOLS.connect.input, raw); path = '/api/agents'; break; }
        case 'ask': { const p = decode(AskCall, raw); path = `/api/agents/${p.agentId}/cards`; data = p.question; agentKey = keyOf(p.agentKey); if (p.question === undefined) [missing, path, method] = ['question', `/api/agents/${p.agentId}`, 'GET']; break; }
        // waitSeconds goes on as JSON, so the agent refuses a string or a fraction just as the schema would.
        case 'wait': { const p = decode(WaitCall, raw); path = `/api/agents/${p.agentId}/cards/${p.decisionId}/answer?wait=${p.waitSeconds === undefined ? C.ANSWER_WAIT_MAX_SECONDS : encodeURIComponent(JSON.stringify(p.waitSeconds))}`; method = 'GET'; agentKey = keyOf(p.agentKey); break; }
        case 'ack': { const p = decode(AckCall, raw); path = `/api/agents/${p.agentId}/cards/${p.decisionId}/acknowledge`; data = p.acknowledgement; agentKey = keyOf(p.agentKey); if (p.acknowledgement === undefined) [missing, path, method] = ['acknowledgement', `/api/agents/${p.agentId}`, 'GET']; break; }
        case 'status': { const p = decode(AgentCall, raw); path = `/api/agents/${p.agentId}`; method = 'GET'; agentKey = keyOf(p.agentKey); break; }
        case 'finish': { const p = decode(AgentCall, raw); path = `/api/agents/${p.agentId}/finish`; agentKey = keyOf(p.agentKey); break; }
        default: throw C.refuse.invalid('Unknown tool. Read /start.');
      }
      let response: Response;
      try { response = await api(new Request(origin + path, { method, headers: { ...(agentKey ? { authorization: `Bearer ${agentKey}` } : {}), 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }), env); }
      catch (error) { response = await failure(error); }
      // A missing question or acknowledgement is named only once the agent has taken the key, by reading its status.
      if (missing && response.ok) response = refusal(C.refuse.invalid(`${missing}: is missing`));
      const result: unknown = await response.json();
      return { ...(response.ok ? {} : { isError: true }), content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) { return { isError: true, content: [{ type: 'text', text: await refusal(error).text() }] }; }
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

const isBrowser = (request: Request) => request.headers.get('sec-fetch-dest') === 'document' ||
  ((request.headers.get('accept') ?? '').includes('text/html') && (request.headers.get('user-agent') ?? '').includes('Mozilla'));
const text = (value: string, type: string, status = 200) => new Response(value, { status, headers: { 'content-type': `${type}; charset=utf-8` } });

async function serve(request: Request, env: Env) {
  const u = new URL(request.url), origin = u.origin;
  if (u.pathname === '/mcp') return mcp(request, env, origin);
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
