import { MCP_TOOLS } from '../schemas/exchange.ts';

// Every route the product serves: method, path, who calls it and what a success answers. Path parameters are Tokens.
// This is the one list of ways in; the start document renders it, and no prose file repeats it. An API route's
// request, result and errors are the session store method of the same name.
// Status codes follow HTTP convention; only the unusual ones are named: each refusal's in HTTP_STATUS, and the MCP
// notification status below.
export const ROUTES = {
  // A browser that holds a session goes on to homeApp instead (C3).
  frontPage: { method: 'GET', path: '/', caller: 'anyone', type: 'text/html' },
  // The web app: every session this browser holds, or an empty list with + (C8::home-lists-this-browsers-sessions).
  homeApp: { method: 'GET', path: '/app', caller: 'owner', type: 'text/html' },
  start: { method: 'GET', path: '/start', caller: 'agent', type: 'text/markdown' },
  claimPage: { method: 'GET', path: '/p/:token', caller: 'owner', type: 'text/html' },
  pairingQr: { method: 'GET', path: '/p/:token/qr.svg', caller: 'anyone', type: 'image/svg+xml' },
  phoneApp: { method: 'GET', path: '/s/:sessionId', caller: 'owner', type: 'text/html' },
  // The start document for an agent given a connect link, with its id filled in. Reading it joins nothing.
  connectPage: { method: 'GET', path: '/start?connect=:connectId', caller: 'agent', type: 'text/markdown' },
  createSession: { method: 'POST', path: '/api/sessions', caller: 'agent', type: 'application/json' },
  agentStatus: { method: 'GET', path: '/api/sessions/:sessionId', caller: 'agent', type: 'application/json' },
  askCard: { method: 'POST', path: '/api/sessions/:sessionId/cards', caller: 'agent', type: 'application/json' },
  readCardAnswer: { method: 'GET', path: '/api/sessions/:sessionId/cards/:decisionId/answer?wait=:seconds', caller: 'agent', type: 'application/json' },
  acknowledgeCard: { method: 'POST', path: '/api/sessions/:sessionId/cards/:decisionId/acknowledge', caller: 'agent', type: 'application/json' },
  claimPairing: { method: 'POST', path: '/api/pairing/:token/claim', caller: 'phone', type: 'application/json' },
  openConnect: { method: 'POST', path: '/api/connect/:connectId', caller: 'phone', type: 'application/json' },
  joinPhone: { method: 'POST', path: '/api/connect/:connectId/join', caller: 'agent', type: 'application/json' },
  readConnect: { method: 'GET', path: '/api/connect/:connectId', caller: 'phone', type: 'application/json' },
  readCards: { method: 'GET', path: '/api/sessions/:sessionId/cards', caller: 'phone', type: 'application/json' },
  answerCard: { method: 'POST', path: '/api/sessions/:sessionId/cards/:decisionId/answer', caller: 'phone', type: 'application/json' },
  endSession: { method: 'POST', path: '/api/sessions/:sessionId/end', caller: 'phone', type: 'application/json' },
  finishSession: { method: 'POST', path: '/api/sessions/:sessionId/finish', caller: 'agent', type: 'application/json' },
  mcp: { method: 'POST', path: '/mcp', caller: 'agent', type: 'application/json' },
} as const;
export type RouteKey = keyof typeof ROUTES;
export const AGENT_AUTH_HEADER = 'authorization';
export const PHONE_AUTH_HEADER = 'x-phone-key';

// The MCP way in: the same sessions over the Model Context Protocol at the mcp route. Stateless streamable HTTP with no
// login; the agent key travels in tool arguments. A notification is answered with this status and no body, because a
// client that gets a JSON body for one drops the server. A tool error carries the same error tag the HTTPS route
// answers, and changes nothing.
export const MCP = { route: ROUTES.mcp, transport: 'streamable-http', stateless: true, login: 'none', notificationStatus: 202, tools: MCP_TOOLS } as const;
