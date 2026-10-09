import { Schema } from 'effect';
import { Token, Emoji, Timestamp, SessionName } from '../../blueprint/design/schemas/values.ts';
import { Decision, QuestionInput, AnswerInput, AcknowledgementInput, Acknowledgement, Answer, Receipt } from '../../blueprint/design/schemas/exchange.ts';
export { Token, Emoji, Timestamp, SessionName, Decision, QuestionInput, AnswerInput, AcknowledgementInput, Acknowledgement, Answer, Receipt };

// iOS dogfood contract (2026-10-08). A pager is the server's session object; the app never says "session".
const strict = { parseOptions: { onExcessProperty: 'error' as const } };

export const LIFETIMES = { '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000, '30d': 30 * 24 * 3_600_000 } as const;
export const Lifetime = Schema.Literal('24h', '7d', '30d');
export type Lifetime = typeof Lifetime.Type;
export const DEFAULT_LIFETIME: Lifetime = '24h';
// The pairing window is the pager's first 15 minutes; an ended pager's name, reason and time last 7 days.
export const PAIRING_WINDOW_MS = 15 * 60_000;
export const RETENTION_MS = 7 * 24 * 3_600_000;
export const PAIRING_TRIES = 3;
export const PALETTE_SIZE = 25;
export const CODE_LENGTH = 3;
export const MAX_OPEN_DECISIONS = 10;
export const ANSWER_WAIT_MAX_SECONDS = 50;

export const EndReason = Schema.Literal('timedOut', 'ownerEnded', 'agentFinished', 'pairingFailed');
export type EndReason = typeof EndReason.Type;
export const LiveStatus = Schema.Literal('waiting', 'unpaired', 'active');
export type LiveStatus = typeof LiveStatus.Type;

const Count = Schema.Number.pipe(Schema.int(), Schema.nonNegative());
export const LiveSummary = Schema.Struct({
  sessionId: Token, name: Schema.NullOr(SessionName), status: LiveStatus, lifetime: Lifetime,
  createdAt: Timestamp, pairedAt: Schema.NullOr(Timestamp), endsAt: Timestamp,
  triesLeft: Schema.Number.pipe(Schema.int(), Schema.between(0, PAIRING_TRIES)), openCount: Count, lastActivityAt: Timestamp,
});
export type LiveSummary = typeof LiveSummary.Type;
export const EndedSummary = Schema.Struct({ sessionId: Token, name: Schema.NullOr(SessionName), status: Schema.Literal('ended'), endedAt: Timestamp, endReason: EndReason });
export type EndedSummary = typeof EndedSummary.Type;
export const PagerSummary = Schema.Union(LiveSummary, EndedSummary);
export type PagerSummary = typeof PagerSummary.Type;

export const PaletteEntry = Schema.Struct({ emoji: Emoji, name: Schema.String });
export type PaletteEntry = typeof PaletteEntry.Type;
export const PairingCode = Schema.Struct({ emojis: Schema.Tuple(Emoji, Emoji, Emoji), names: Schema.Tuple(Schema.String, Schema.String, Schema.String), text: Schema.String });
export type PairingCode = typeof PairingCode.Type;
export const Link = Schema.Struct({ code: Token, url: Schema.String, qrText: Schema.String, qrUrl: Schema.String, expiresAt: Timestamp });
export type Link = typeof Link.Type;

// Requests.
export const CreateInput = Schema.Struct({ name: SessionName, lifetime: Schema.optional(Lifetime) }).annotations(strict);
export const JoinInput = Schema.Struct({ name: SessionName }).annotations(strict);
export const PhoneCreateInput = Schema.Struct({ lifetime: Schema.optional(Lifetime) }).annotations(strict);
export const LifetimeInput = Schema.Struct({ lifetime: Lifetime }).annotations(strict);
export const PairInput = Schema.Struct({ code: Schema.Tuple(Emoji, Emoji, Emoji) }).annotations(strict);

// Responses.
export const Created = Schema.Struct({ session: LiveSummary, agentKey: Token, link: Link, pairingCode: PairingCode });
export type Created = typeof Created.Type;
export const Joined = Schema.Struct({ session: LiveSummary, agentKey: Token, pairingCode: PairingCode });
export type Joined = typeof Joined.Type;
export const AgentStatus = Schema.Struct({ session: LiveSummary, pairingCode: Schema.NullOr(PairingCode) });
export const PhoneCreated = Schema.Struct({ session: LiveSummary, link: Link });
export type PhoneCreated = typeof PhoneCreated.Type;
// The owner's pager number (dogfood): agents with it open pagers that are paired from the start.
export const Paged = Schema.Struct({ session: LiveSummary, agentKey: Token });
export type Paged = typeof Paged.Type;
export const NumberMade = Schema.Struct({ number: Token });
export const NumberPagers = Schema.Struct({ sessionIds: Schema.Array(Token) });
export const PhoneInbox = Schema.Struct({ session: PagerSummary, open: Schema.Array(Decision), answered: Schema.Array(Decision) });
export type PhoneInbox = typeof PhoneInbox.Type;
export const StartInfo = Schema.Struct({ status: LiveStatus, name: Schema.NullOr(SessionName), palette: Schema.Array(PaletteEntry), triesLeft: Count, endsAt: Timestamp, lifetime: Lifetime });
export type StartInfo = typeof StartInfo.Type;
export const SessionReply = Schema.Struct({ session: PagerSummary });
export const Finished = Schema.Struct({ endedAt: Timestamp });
export const Asked = Schema.Struct({ decisionId: Token });
export const AnswerStatus = Schema.Union(Schema.Struct({ status: Schema.Literal('pending') }), Schema.Struct({ status: Schema.Literal('answered'), answer: Answer }));

// MCP: the same six tools as before, plus page_owner; join_session now takes the link code.
const AgentCall = { sessionId: Token, agentKey: Token };
export const MCP_TOOLS = {
  start_session: { input: CreateInput, result: Created },
  join_session: { input: Schema.Struct({ code: Token, name: SessionName }).annotations(strict), result: Joined },
  page_owner: { input: Schema.Struct({ number: Token, name: SessionName, lifetime: Schema.optional(Lifetime) }).annotations(strict), result: Paged },
  ask_card: { input: Schema.Struct({ ...AgentCall, question: QuestionInput }).annotations(strict), result: Asked },
  wait_for_card_answer: { input: Schema.Struct({ ...AgentCall, decisionId: Token, waitSeconds: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, ANSWER_WAIT_MAX_SECONDS))) }).annotations(strict), result: AnswerStatus },
  acknowledge_card: { input: Schema.Struct({ ...AgentCall, decisionId: Token, acknowledgement: AcknowledgementInput }).annotations(strict), result: Acknowledgement },
  finish_session: { input: Schema.Struct(AgentCall).annotations(strict), result: Finished },
} as const;

export const AGENT_AUTH_HEADER = 'authorization';
export const PHONE_AUTH_HEADER = 'x-phone-key';

// Curated pairing emojis: one code point each, default emoji presentation, no skin tones, flags, ZWJ or other variants.
export const PAIRING_EMOJIS: ReadonlyArray<readonly [string, string]> = [
  ['🍋', 'lemon'], ['🦊', 'fox'], ['🌵', 'cactus'], ['🚲', 'bicycle'], ['🌙', 'moon'], ['🍄', 'mushroom'], ['🐙', 'octopus'], ['🎈', 'balloon'],
  ['🧭', 'compass'], ['🪁', 'kite'], ['🥑', 'avocado'], ['🐢', 'turtle'], ['🎺', 'trumpet'], ['🧦', 'socks'], ['🪐', 'planet'], ['🍩', 'doughnut'],
  ['🔑', 'key'], ['🍉', 'watermelon'], ['⚓', 'anchor'], ['🎸', 'guitar'], ['🚀', 'rocket'], ['🧊', 'ice'], ['🌻', 'sunflower'], ['🦉', 'owl'],
  ['⛵', 'sailboat'], ['🔔', 'bell'], ['🐝', 'bee'], ['🌈', 'rainbow'], ['🧲', 'magnet'], ['🥕', 'carrot'], ['🍓', 'strawberry'], ['🐧', 'penguin'],
  ['🎩', 'top hat'], ['🍕', 'pizza'], ['🦋', 'butterfly'], ['🐳', 'whale'], ['🌽', 'corn'], ['🎲', 'die'], ['🧩', 'puzzle piece'], ['🪴', 'potted plant'],
  ['🐌', 'snail'], ['🍒', 'cherries'], ['🦒', 'giraffe'], ['🎃', 'pumpkin'], ['🧁', 'cupcake'], ['🦀', 'crab'],
];

// Every refusal: { error: <tag>, message: <one plain sentence>, ...fields }.
export const STATUS = {
  InvalidInput: 400, WrongCode: 400, Unauthorized: 401, UnknownSession: 404, UnknownDecision: 404,
  AlreadyJoined: 409, AlreadyPaired: 409, WaitingForAgent: 409, TooManyOpenDecisions: 409, NotAnswered: 409,
  AlreadyAcknowledged: 409, AnswerMismatch: 409, AlreadyAnswered: 409, LinkInvalid: 410, NumberInvalid: 410, PagerEnded: 410, NotFound: 404,
} as const;
export type Tag = keyof typeof STATUS;
export class Refusal extends Error {
  readonly tag: Tag;
  readonly fields: Readonly<Record<string, unknown>>;
  constructor(tag: Tag, message: string, fields: Readonly<Record<string, unknown>> = {}) { super(message); this.tag = tag; this.fields = fields; }
}
const ENDED: Record<EndReason, string> = {
  timedOut: 'This pager reached its end time.',
  ownerEnded: 'Your owner ended this pager.',
  agentFinished: 'You finished this pager.',
  pairingFailed: 'Pairing failed: your owner entered 3 wrong codes, so this pager has ended.',
};
export const refuse = {
  invalid: (reason: string) => new Refusal('InvalidInput', `The request was refused: ${reason}`, { reason }),
  wrongCode: (triesLeft: number) => new Refusal('WrongCode', `Those emojis don't match. ${triesLeft === 1 ? 'Last try.' : `${triesLeft} tries left.`}`, { triesLeft }),
  unauthorized: () => new Refusal('Unauthorized', 'The key is missing or does not belong to this pager.'),
  unknownSession: () => new Refusal('UnknownSession', 'This pager does not exist or has been forgotten.'),
  unknownDecision: () => new Refusal('UnknownDecision', 'This pager has no decision with that id.'),
  alreadyJoined: () => new Refusal('AlreadyJoined', 'An agent has already joined this AgentPager link. Ask your owner for a new link.'),
  alreadyPaired: () => new Refusal('AlreadyPaired', 'This pager is already paired with another phone.'),
  waitingForAgent: () => new Refusal('WaitingForAgent', 'No agent has joined this link yet.'),
  tooMany: () => new Refusal('TooManyOpenDecisions', `This pager already has ${MAX_OPEN_DECISIONS} open decisions. Wait for answers before asking more.`, { limit: MAX_OPEN_DECISIONS }),
  notAnswered: () => new Refusal('NotAnswered', 'This decision has no answer yet.'),
  alreadyAcknowledged: () => new Refusal('AlreadyAcknowledged', 'This answer is already acknowledged; only the first acknowledgement counts.'),
  answerMismatch: () => new Refusal('AnswerMismatch', 'That answerId is not the stored answer for this decision.'),
  alreadyAnswered: (receipt: Receipt) => new Refusal('AlreadyAnswered', 'This decision already has a different answer.', { receipt }),
  linkInvalid: () => new Refusal('LinkInvalid', 'This AgentPager link has expired, ended or was never valid. Ask for a new link.'),
  numberInvalid: () => new Refusal('NumberInvalid', 'This pager number is not in use: your owner may have changed it. Ask them for their current pager number.'),
  ended: (endReason: EndReason, endedAt: string, name?: string | null) => new Refusal('PagerEnded', `${ENDED[endReason]} Stop paging; start a new pager only if your owner asks.`, { endReason, endedAt, ...(name === undefined ? {} : { name }) }),
  notFound: () => new Refusal('NotFound', 'No such route. Read /start.'),
};
