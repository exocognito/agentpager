import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';
import { AcknowledgementInput, Card, MCP_TOOLS, QuestionInput, SessionInput } from '../../schemas/exchange.ts';
import { AGENT_AUTH_HEADER, ROUTES } from '../../effects/session.ts';
import { CARD_EXAMPLES, connectUrl, startDocument } from './StartScreen.tsx';

const token = (seed: string) => seed.repeat(32).slice(0, 32);
const script = (origin: string, connectId?: string) => startDocument(origin, connectId).match(/```sh\n([\s\S]*?)```/)![1];

describe('the agent start document', () => {
  it('passes expanded credentials, answer ids, JSON and complete URLs to curl', () => {
    const origin = 'https://example.invalid';
    const env = {
      SESSION: token('session'), AGENT_KEY: token('agent'),
      PAIRING_DECISION: token('pairing'), DECISION: token('question'), ANSWER_ID: token('answer'),
    };
    // Capture real shell arguments at the network boundary; no request leaves this process.
    const capture = `curl() { printf '%s\\0' "$@"; printf '\\0'; }\n`;
    const calls = execFileSync('/bin/sh', ['-eu', '-c', capture + script(origin)], { env: { ...process.env, ...env }, encoding: 'utf8' })
      .split('\0\0').filter(Boolean).map(call => call.split('\0'));
    const keys = ['createSession', 'readCardAnswer', 'acknowledgeCard', 'askCard', 'readCardAnswer', 'acknowledgeCard', 'finishSession'] as const;
    expect(calls).toHaveLength(keys.length);
    // The session is created with the name the owner will see it by.
    expect(Schema.decodeUnknownSync(SessionInput)(JSON.parse(calls[0][calls[0].indexOf('-d') + 1]))).toMatchObject({ name: expect.any(String) });
    for (const [index, key] of keys.entries()) {
      const args = calls[index];
      expect(args[args.indexOf('-X') + 1]).toBe(ROUTES[key].method);
      const decisionId = index < 3 ? env.PAIRING_DECISION : env.DECISION;
      const path = ROUTES[key].path.replace(':sessionId', env.SESSION).replace(':decisionId', decisionId).replace(':seconds', '50');
      expect(args.at(-1)).toBe(origin + path);
      if (index > 0) expect(args).toContain(`${AGENT_AUTH_HEADER}: Bearer ${env.AGENT_KEY}`);
    }
    for (const index of [2, 5]) {
      const args = calls[index];
      const body = JSON.parse(args[args.indexOf('-d') + 1]);
      expect(Schema.is(AcknowledgementInput)(body)).toBe(true);
      expect(body.answerId).toBe(env.ANSWER_ID);
    }
    const ask = calls[3];
    expect(Schema.is(QuestionInput)(JSON.parse(ask[ask.indexOf('-d') + 1]))).toBe(true);
  });

  it('explains nested results, choices, required text and input bounds', () => {
    const document = startDocument();
    expect(document).toContain('never blank');
    expect(document).toContain('2 to 4 options');
    expect(document).toContain('one Unicode RGI emoji');
    expect(document).toContain('8 code points');
    expect(document).toContain('32 URL-safe');
    expect(document).toContain('1000 characters');
    expect(document).toContain('280 visible characters');
    for (const name of ['SessionSummary', 'PairingLink', 'Decision', 'Option', 'Answer', 'Choice', 'Acknowledgement', 'Card']) {
      expect(document).toContain(`| ${name} |`);
    }
    expect(document).toContain('detail?');
    expect(document).toContain('"kind":"option","number":1');
    expect(document).toContain('"kind":"feedback","text":');
    expect(document).toContain('waitSeconds?');
  });

  it('names every agent route and the wait wrapper, and leaves the phone routes out', () => {
    const document = startDocument('https://agentpager.me');
    for (const route of Object.values(ROUTES)) {
      const row = `| ${route.method} ${route.path} |`;
      if (route.caller.includes('agent') || route === ROUTES.pairingQr) expect(document).toContain(row);
      else expect(document).not.toContain(row);
    }
    expect(document).toContain('it returns {answer}');
    expect(document).not.toContain('requestId');
  });

  it('opens a connect page with its own join call, and joins nothing by being read', () => {
    const connectId = token('connect');
    const joinUrl = `https://agentpager.me${ROUTES.joinPhone.path.replace(':connectId', connectId)}`;
    const document = startDocument('https://agentpager.me', connectId);
    expect(connectUrl(connectId)).toBe(`https://agentpager.me/start?connect=${connectId}`);
    expect(document).toContain(`"${joinUrl}"`);
    expect(document).toContain(`connectId \`${connectId}\``);
    expect(document).toContain('Reading it joins nothing');
    expect(document).toContain(connectUrl(connectId));
    expect(startDocument('https://agentpager.me')).not.toContain(connectId);
    // An agent given a connect link is never told to create a session or show a pairing link first.
    expect(document).not.toContain('Create the session');
    expect(document).not.toContain('## Show the pairing link');
    expect(document).toContain('There is no link or QR image to show');
    expect(document).not.toContain('Create a session without a key');
    expect(document).not.toContain('pairing.qrUrl');
    expect(document).not.toContain('pairing.qrText');
    expect(startDocument('https://agentpager.me')).toContain('Put pairing.qrText in a fenced code block');
    expect(document).toContain('MCP resources are not tools');
    const first = execFileSync('/bin/sh', ['-eu', '-c', `curl() { printf '%s\\0' "$@"; exit 0; }\n` + script('https://agentpager.me', connectId)], { encoding: 'utf8' }).split('\0');
    expect(first.at(-2)).toBe(joinUrl);
  });

  it('decodes every documented card and keeps one tool set', () => {
    // What an agent sends: every documented card is a question the schema takes, not only a card some decision holds.
    for (const card of Object.values(CARD_EXAMPLES)) expect(Schema.is(QuestionInput)({ title: 'Documented card', card })).toBe(true);
    expect(Object.keys(MCP_TOOLS).sort()).toEqual(['acknowledge_card', 'ask_card', 'finish_session', 'join_session', 'start_session', 'wait_for_card_answer']);
  });

  it('distinguishes invalid card types from unknown decision identifiers', () => {
    const document = startDocument('https://agentpager.me');
    expect(document).toContain('Unsupported card types or malformed card inputs return InvalidInput');
    expect(document).toContain('UnknownDecision means an unknown decision ID');
    expect(Schema.is(Card)({ type: 'not-a-card' })).toBe(false);
  });

  it('derives the worked request from the ask-card route', () => {
    const original = { ...ROUTES.askCard };
    try {
      Object.assign(ROUTES.askCard, { method: 'PATCH', path: '/probe/:sessionId/proposals' });
      expect(startDocument('https://agentpager.me')).toContain('PATCH /probe/:sessionId/proposals');
      const worked = script('https://agentpager.me');
      expect(worked).toContain('-X PATCH');
      expect(worked).toContain('https://agentpager.me/probe/$SESSION/proposals');
    } finally {
      Object.assign(ROUTES.askCard, original);
    }
  });
});

it('explains target matching, claimed reservation and fixed lifetime without leaking the target to the phone', () => {
  const document = startDocument();
  expect(document).toContain('pairingTarget');
  expect(document).toContain('select that emoji, then tap Send');
  expect(document).toContain('24 hours after correct pairing');
  expect(document).toContain('pairedAt is null until correct pairing; until then expiresAt is the unpaired deadline');
  expect(document).toContain('InvalidInput');
});

it('keeps pairing publication distinct from completing the requested exchange', () => {
  const document = startDocument();
  expect(document).toMatch(/progress message before (?:calling|starting).*answer read/i);
  expect(document).toMatch(/after publishing[\s\S]*wait for.*pairing[\s\S]*acknowledge[\s\S]*requested exchange/i);
  expect(document).toMatch(/final response[\s\S]*answer and acknowledgement steps/i);
});

it('allows unrelated cards to stay open after the selected exchange completes', () => {
  const document = startDocument('https://agentpager.me');
  expect(document).toMatch(/other independent cards may remain open/i);
  expect(document).toMatch(/finish only the selected exchange before responding/i);
});
