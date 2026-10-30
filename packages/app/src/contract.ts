import { Schema } from 'effect';
import { Token, Timestamp, ValidProse, characters } from '../../blueprint/design/schemas/values.ts';
import { Decision, QuestionInput, AnswerInput, AcknowledgementInput, Acknowledgement, Answer, Receipt } from '../../blueprint/design/schemas/exchange.ts';
export { Token, Timestamp, Decision, QuestionInput, AnswerInput, AcknowledgementInput, Acknowledgement, Answer, Receipt };

// The v2 model (docs/v2/01-decisions.md). A pager is made on the owner's phone and is either on or off; an agent is
// whatever connected to a pager with its number, and lasts until it finishes or is forgotten.
const strict = { parseOptions: { onExcessProperty: 'error' as const } };

export const MAX_OPEN_DECISIONS = 10;
export const ANSWER_WAIT_MAX_SECONDS = 50;
// Housekeeping: an agent is forgotten this long after its last activity.
export const AGENT_IDLE_MS = 30 * 24 * 3_600_000;

// A pager turns off by itself after this long on, or never.
export const AUTO_OFF = { '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000, '30d': 30 * 24 * 3_600_000 } as const;
export const AutoOff = Schema.Literal('never', '24h', '7d', '30d');
export type AutoOff = typeof AutoOff.Type;

// The pager number, made on the phone: `ap1_` and base64url of the pager id (16 bytes) and the first 8 bytes of the
// SHA-256 of the pager's public key (docs/v2/04-encryption.md §2). The server keys the pager by the id, as 32 hex.
export const PagerNumber = Schema.String.pipe(Schema.pattern(/^ap1_[A-Za-z0-9_-]{32}$/));
export const PagerId = Schema.String.pipe(Schema.pattern(/^[0-9a-f]{32}$/));
// A Curve25519 public key: 32 bytes, base64url without padding.
export const PublicKey = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_-]{43}$/));
// Who asked ("Codex") and the project its decisions are grouped under ("atomic-pages").
export const LABEL_MAX_CHARACTERS = 60;
export const Label = ValidProse.pipe(Schema.filter(text => characters(text) <= LABEL_MAX_CHARACTERS || `text may not exceed ${LABEL_MAX_CHARACTERS} characters`));

const Count = Schema.Number.pipe(Schema.int(), Schema.nonNegative());
// What the phone sees of a pager. The name lives only on the phone.
export const Pager = Schema.Struct({
  pagerId: PagerId, on: Schema.Boolean, autoOff: AutoOff,
  // While on: when it turns off by itself, if ever. While off: since when.
  offAt: Schema.NullOr(Timestamp), offSince: Schema.NullOr(Timestamp), createdAt: Timestamp,
});
export type Pager = typeof Pager.Type;
export const Agent = Schema.Struct({
  agentId: Token, app: Label, project: Label, createdAt: Timestamp, finishedAt: Schema.NullOr(Timestamp),
  lastActivityAt: Timestamp, openCount: Count,
});
export type Agent = typeof Agent.Type;

// Requests.
export const CreatePagerInput = Schema.Struct({ number: PagerNumber, publicKey: PublicKey, autoOff: AutoOff }).annotations(strict);
export const PagerSettingsInput = Schema.Struct({ on: Schema.optional(Schema.Boolean), autoOff: Schema.optional(AutoOff) }).annotations(strict);
export const ConnectInput = Schema.Struct({ number: Schema.String, app: Label, project: Label }).annotations(strict);

// Responses.
export const PagerReply = Schema.Struct({ pager: Pager });
export const AgentInbox = Schema.Struct({ agent: Agent, open: Schema.Array(Decision), answered: Schema.Array(Decision) });
export type AgentInbox = typeof AgentInbox.Type;
export const PagerInbox = Schema.Struct({ pager: Pager, agents: Schema.Array(AgentInbox) });
export type PagerInbox = typeof PagerInbox.Type;
export const Connected = Schema.Struct({ agent: Agent, agentKey: Token, message: Schema.String });
export type Connected = typeof Connected.Type;
export const AgentStatus = Schema.Struct({ agent: Agent, pager: Schema.Struct({ on: Schema.Boolean }) });
export const Finished = Schema.Struct({ finishedAt: Timestamp });
export const Asked = Schema.Struct({ decisionId: Token });
export const AnswerStatus = Schema.Union(Schema.Struct({ status: Schema.Literal('pending') }), Schema.Struct({ status: Schema.Literal('answered'), answer: Answer }));

// MCP: the same operations as the agentpager binary's (docs/v2/03-binary-surface.md §3).
const AgentCall = { agentId: Token, agentKey: Token };
export const MCP_TOOLS = {
  connect: { input: ConnectInput, result: Connected },
  ask: { input: Schema.Struct({ ...AgentCall, question: QuestionInput }).annotations(strict), result: Asked },
  wait: { input: Schema.Struct({ ...AgentCall, decisionId: Token, waitSeconds: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, ANSWER_WAIT_MAX_SECONDS))) }).annotations(strict), result: AnswerStatus },
  ack: { input: Schema.Struct({ ...AgentCall, decisionId: Token, acknowledgement: AcknowledgementInput }).annotations(strict), result: Acknowledgement },
  status: { input: Schema.Struct(AgentCall).annotations(strict), result: AgentStatus },
  finish: { input: Schema.Struct(AgentCall).annotations(strict), result: Finished },
} as const;

export const AGENT_AUTH_HEADER = 'authorization';
export const PHONE_AUTH_HEADER = 'x-phone-key';

// Every refusal: { error: <tag>, message: <one plain sentence>, ...fields }.
export const STATUS = {
  InvalidInput: 400, Unauthorized: 401, UnknownAgent: 404, UnknownPager: 404, UnknownDecision: 404, UnknownFile: 404, NotFound: 404,
  PagerOff: 409, PagerExists: 409, AgentFinished: 409, TooManyOpenDecisions: 409, NotAnswered: 409, AlreadyAcknowledged: 409,
  AnswerMismatch: 409, AlreadyAnswered: 409, NumberInvalid: 410, PagerDeleted: 410,
} as const;
export type Tag = keyof typeof STATUS;
export class Refusal extends Error {
  readonly tag: Tag;
  readonly fields: Readonly<Record<string, unknown>>;
  constructor(tag: Tag, message: string, fields: Readonly<Record<string, unknown>> = {}) { super(message); this.tag = tag; this.fields = fields; }
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
};
