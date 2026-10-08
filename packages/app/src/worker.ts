import { JSONSchema, Schema } from 'effect';
import QRCode from 'qrcode';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as C from './contract.ts';
import { BUILD, forward, type Env } from './env.ts';
import { body, decode, json, refusal, sha256, token } from './shared.ts';
import { codeDocument, codePage, OLD_CONNECT, startDocument } from './start.ts';
export { Session } from './session.ts';
export { Registry } from './registry.ts';

const RegistryHit = Schema.Struct({ sessionId: Schema.NullOr(C.Token) });
async function lookup(env: Env, code: string) {
  const codeHash = await sha256(code);
  const reply = await forward(env.REGISTRY, 'registry', '/get', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codeHash }) });
  const hit = decode(RegistryHit, await reply.json());
  if (!hit.sessionId) throw C.refuse.linkInvalid();
  return hit.sessionId;
}
async function init(env: Env, request: Request, origin: string, by: 'agent' | 'phone', name: string | null, lifetime: C.Lifetime) {
  const sessionId = token(), code = token();
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const phoneKey = request.headers.get(C.PHONE_AUTH_HEADER);
  if (by === 'phone' && phoneKey) headers[C.PHONE_AUTH_HEADER] = phoneKey;
  return forward(env.SESSION, sessionId, '/init', { method: 'POST', headers, body: JSON.stringify({ sessionId, code, origin, by, name, lifetime }) });
}
async function optionalBody(request: Request): Promise<unknown> {
  const text = await request.clone().text();
  return text === '' ? {} : body(request);
}

// Public HTTPS routes -> one pager object (or the registry for link codes).
async function api(request: Request, env: Env, origin: string): Promise<Response> {
  const u = new URL(request.url), method = request.method, parts = u.pathname.split('/').filter(Boolean).slice(1);
  const pass = async (sessionId: string, path: string) => forward(env.SESSION, sessionId, path + u.search, { method, headers: request.headers, body: method === 'GET' ? undefined : await request.arrayBuffer() });
  if (parts.length === 1 && parts[0] === 'sessions' && method === 'POST') {
    const input = decode(C.CreateInput, await body(request));
    return init(env, request, origin, 'agent', input.name, input.lifetime ?? C.DEFAULT_LIFETIME);
  }
  if (parts.length === 1 && parts[0] === 'pagers' && method === 'POST') {
    const input = decode(C.PhoneCreateInput, await optionalBody(request));
    return init(env, request, origin, 'phone', null, input.lifetime ?? C.DEFAULT_LIFETIME);
  }
  if (parts[0] === 'start' && parts.length >= 2) {
    const code = decode(C.Token, parts[1]), sub = parts[2];
    if (parts.length === 2 && method === 'GET') return pass(await lookup(env, code), '/start');
    if (parts.length === 3 && method === 'POST' && (sub === 'pair' || sub === 'join')) return pass(await lookup(env, code), `/${sub}`);
  }
  if (parts[0] === 'sessions' && parts.length >= 2) {
    const sessionId = decode(C.Token, parts[1]), rest = parts.slice(2).join('/');
    if (rest === '' && method === 'GET') return pass(sessionId, '/status');
    if (rest === 'cards') return pass(sessionId, method === 'POST' ? '/ask' : '/inbox');
    if (parts.length === 5 && parts[2] === 'cards') {
      const decisionId = decode(C.Token, parts[3]);
      if (parts[4] === 'answer') return pass(sessionId, `/${method === 'GET' ? 'read' : 'answer'}/${decisionId}`);
      if (parts[4] === 'acknowledge' && method === 'POST') return pass(sessionId, `/ack/${decisionId}`);
    }
    if (method === 'POST' && (rest === 'end' || rest === 'finish' || rest === 'lifetime')) return pass(sessionId, `/${rest}`);
  }
  throw C.refuse.notFound();
}

// Tool replies are the same JSON as the HTTP API's. Each description names this server, so an agent can tell
// tools for another AgentPager server apart.
const descriptions = (origin: string): Record<keyof typeof C.MCP_TOOLS, string> => ({
  start_session: `Start a pager on your owner's phone, on the AgentPager server ${origin}. lifetime is 24h (default), 7d or 30d. Then, in one message of your own (not only in a command's output), show your owner link.qrText in a fenced code block, the full link.url as text, and pairingCode.text verbatim as plain text. Never show agentKey; keep sessionId and agentKey for later turns. Then call ask_card right away: your owner sees it as soon as the phone pairs. Full guide: ${origin}/start`,
  join_session: `Join the pager your owner's phone made, using the code from their AgentPager link (${origin}/start/<code>); links from other servers will not work here. Only the first join works. Print pairingCode.text to your owner verbatim as plain text; never show agentKey, and keep sessionId and agentKey for later turns. Then call ask_card right away.`,
  ask_card: 'Ask your owner one decision with 2 to 5 numbered options. Works before pairing (the phone shows it once paired). At most 10 open decisions per pager. Replies {decisionId}.',
  wait_for_card_answer: 'Hold a read for up to 50 seconds. Replies {status:"pending"} (read again) or {status:"answered", answer:{answerId, choice, ...}}. Keep reading while you have nothing better to do; if your turn ends, the answer waits for your next turn.',
  acknowledge_card: 'Acknowledge the exact answerId with your next steps; your owner sees them with a green tick. Only the first acknowledgement counts.',
  finish_session: 'End the pager when your work is done. Your key stops working.',
});
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
      let path: string, method = 'POST', data: unknown, agentKey: string | undefined;
      switch (call.params.name) {
        case 'start_session': { data = decode(C.MCP_TOOLS.start_session.input, raw); path = '/api/sessions'; break; }
        case 'join_session': { const p = decode(C.MCP_TOOLS.join_session.input, raw); path = `/api/start/${p.code}/join`; data = { name: p.name }; break; }
        case 'ask_card': { const p = decode(C.MCP_TOOLS.ask_card.input, raw); path = `/api/sessions/${p.sessionId}/cards`; data = p.question; agentKey = p.agentKey; break; }
        case 'wait_for_card_answer': { const p = decode(C.MCP_TOOLS.wait_for_card_answer.input, raw); path = `/api/sessions/${p.sessionId}/cards/${p.decisionId}/answer?wait=${p.waitSeconds ?? C.ANSWER_WAIT_MAX_SECONDS}`; method = 'GET'; agentKey = p.agentKey; break; }
        case 'acknowledge_card': { const p = decode(C.MCP_TOOLS.acknowledge_card.input, raw); path = `/api/sessions/${p.sessionId}/cards/${p.decisionId}/acknowledge`; data = p.acknowledgement; agentKey = p.agentKey; break; }
        case 'finish_session': { const p = decode(C.MCP_TOOLS.finish_session.input, raw); path = `/api/sessions/${p.sessionId}/finish`; agentKey = p.agentKey; break; }
        default: throw C.refuse.invalid('Unknown tool. Read /start.');
      }
      let response: Response;
      try { response = await api(new Request(origin + path, { method, headers: { ...(agentKey ? { authorization: `Bearer ${agentKey}` } : {}), 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }), env, origin); }
      catch (error) { response = refusal(error); }
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
  if (u.pathname.startsWith('/api/')) return api(request, env, origin);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'MethodNotAllowed', message: 'Use GET.' }, 405);
  if (u.pathname === '/start') {
    if (u.searchParams.has('connect')) return text(OLD_CONNECT, 'text/plain', 410);
    return text(startDocument(origin), 'text/markdown');
  }
  // Read-only: a browser, a link preview or an agent reading this never joins or uses the link.
  const start = u.pathname.match(/^\/start\/([^/]+)(\/qr\.svg)?$/);
  if (start) {
    const code = decode(C.Token, start[1]);
    if (start[2]) return text(await QRCode.toString(`${origin}/start/${code}`, { type: 'svg', errorCorrectionLevel: 'M' }), 'image/svg+xml');
    return isBrowser(request) ? text(codePage(origin, code), 'text/html') : text(codeDocument(origin, code), 'text/markdown');
  }
  if (u.pathname === '/favicon.ico') return new Response(null, { status: 204 });
  if (u.pathname === '/' && !isBrowser(request)) return text(`# AgentPager\n\nAgents start at ${origin}/start.\n`, 'text/markdown');
  // The web app is parked; its bundle is still served as it was.
  const page = u.pathname === '/' || u.pathname === '/app';
  if (!page && !u.pathname.startsWith('/assets/')) return json({ error: 'NotFound', message: 'No such page. Agents read /start.' }, 404);
  const asset = await env.ASSETS.fetch(new URL(page ? '/index.html' : u.pathname, u.origin).href);
  return new Response(await asset.arrayBuffer(), { status: asset.status, headers: Object.fromEntries(asset.headers) });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try { response = await serve(request, env); } catch (error) { response = refusal(error); }
    const headers = new Headers(response.headers);
    headers.set('X-AgentPager-Build', BUILD);
    headers.set('Cache-Control', 'no-store');
    headers.set('Referrer-Policy', 'no-referrer');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    return new Response(response.body, { status: response.status, headers });
  },
};
