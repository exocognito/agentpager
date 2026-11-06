import { MAX_OPEN_DECISIONS, type Receipt, type RefusalTag } from '../../contract/exchange.ts';

// The server's side of the contract. The wire contract itself, every shape a client sends or receives, is
// packages/contract/exchange.ts; it is re-exported so the server reads one namespace.
// What follows is the server's own: its clocks and the words of its refusals.
export * from '../../contract/exchange.ts';

// Housekeeping: an agent is forgotten this long after its last activity.
export const AGENT_IDLE_MS = 30 * 24 * 3_600_000;
// An answer no agent has collected this long after Send gets one alert, and the phone says so (I6).
export const PICKUP_MS = 3 * 60_000;
// How long each auto-off choice keeps a pager on.
export const AUTO_OFF = { '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000, '30d': 30 * 24 * 3_600_000 } as const;
// The oldest protocol (CLIENT_HEADER) the service accepts from each side. An agent's call without the header, such as
// one from an m4 command, is refused. The phone's isn't yet: until its shapes change at the encryption switch, an app
// from before the header still works, and one that sends it must send a protocol accepted here.
export const OLDEST_PROTOCOL = { agent: 1, phone: 1 } as const;
export const PHONE_NEEDS_CLIENT_HEADER = false;

export class Refusal extends Error {
  readonly tag: RefusalTag;
  readonly fields: Readonly<Record<string, unknown>>;
  constructor(tag: RefusalTag, message: string, fields: Readonly<Record<string, unknown>> = {}) { super(message); this.tag = tag; this.fields = fields; }
}
export const refuse = {
  invalid: (reason: string) => new Refusal('InvalidInput', `The request was refused: ${reason}`, { reason }),
  unauthorized: () => new Refusal('Unauthorized', 'The key is missing or does not belong to this agent or pager.'),
  unknownAgent: () => new Refusal('UnknownAgent', "This agent does not exist or has been forgotten. Connect again with your owner's pager number."),
  unknownPager: () => new Refusal('UnknownPager', 'This pager does not exist or has been deleted.'),
  unknownDecision: () => new Refusal('UnknownDecision', 'This agent has no decision with that id.'),
  unknownFile: () => new Refusal('UnknownFile', 'This decision has no attachment with that name.'),
  pagerOff: () => new Refusal('PagerOff', 'This pager is turned off. Your message was not delivered. Nothing is queued: ask again once your owner turns it on, or ask them for another pager number.'),
  pagerExists: () => new Refusal('PagerExists', 'A pager with this number already exists.'),
  pagerDeleted: () => new Refusal('PagerDeleted', 'Your owner deleted this pager. Stop paging; ask your owner for a pager number only if they want more decisions.'),
  finished: () => new Refusal('AgentFinished', 'This agent has finished. To ask about new work, connect again.'),
  tooMany: () => new Refusal('TooManyOpenDecisions', `Your owner already has ${MAX_OPEN_DECISIONS} unanswered decisions from you. Wait for answers before asking more.`, { limit: MAX_OPEN_DECISIONS }),
  notAnswered: () => new Refusal('NotAnswered', 'This decision has no answer yet.'),
  alreadyAcknowledged: () => new Refusal('AlreadyAcknowledged', 'This answer is already acknowledged; only the first acknowledgement counts.'),
  answerMismatch: () => new Refusal('AnswerMismatch', 'That answerId is not the stored answer for this decision.'),
  alreadyAnswered: (receipt: Receipt) => new Refusal('AlreadyAnswered', 'This decision already has a different answer.', { receipt }),
  numberInvalid: () => new Refusal('NumberInvalid', 'This pager number is not in use. Ask your owner for their current one.'),
  notFound: () => new Refusal('NotFound', 'No such route. Read /start.'),
  // Refused before the key or the input is read, so nothing an old client sends is stored.
  commandTooOld: (origin: string) => new Refusal('UpdateRequired', `This agentpager command is too old for this server, so nothing reached your owner. Update it: build it again as ${origin}/start describes (in an existing clone, git pull first), or if you can't, tell your owner it needs updating. Then connect again with your owner's pager number.`),
  appTooOld: () => new Refusal('UpdateRequired', 'This AgentPager app is too old for this server. Update the app; your pagers stay on this phone.'),
  decisionIdTaken: () => new Refusal('DecisionIdTaken', 'This decisionId is taken, by a different question from this agent or by another agent on this pager. Nothing was sent; ask with a new decisionId.'),
};
