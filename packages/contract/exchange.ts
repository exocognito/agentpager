import { Schema } from "effect";
import { Token, Text, Title, Body, Timestamp, OptionNumber, ValidProse, characters } from "./values.ts";
import { Attachments, AttachmentInfo, attachmentTypes, missingAttachment, Payload as BriefCard } from "./brief.ts";

// The live wire contract (v2, DEC-2026-10-29-v2-design in blueprint/DECISIONS.md): every shape the server, the agentpager binary and the phone
// exchange. The server (packages/app) and the binary (packages/cli) decode with these schemas; the iPhone app mirrors
// them in Model/API.swift. The primitives live in values.ts and the brief in brief.ts; this module
// re-exports the primitives so one import carries the whole contract.
// A pager is made on the owner's phone and is either on or off; an agent is whatever connected to a pager with its
// number, and lasts until it finishes or is forgotten.
export * from "./values.ts";

const strict = { parseOptions: { onExcessProperty: "error" as const } };

export const AGENT_AUTH_HEADER = "authorization";
export const PHONE_AUTH_HEADER = "x-phone-key";
export const MAX_OPEN_DECISIONS = 10;
// The longest an agent's answer read holds open before it returns pending.
export const ANSWER_WAIT_MAX_SECONDS = 50;

// Pagers and agents.

// A pager turns off by itself after this long on, or never.
export const AutoOff = Schema.Literal("never", "24h", "7d", "30d");
export type AutoOff = typeof AutoOff.Type;
// The pager number, made on the phone: `ap1_` and base64url of the pager id (16 bytes) and the first 8 bytes of the
// SHA-256 of the pager's public key (I19, blueprint/areas/6-privacy.md). The server keys the pager by the id, as 32 hex.
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
// machine: the computer it runs on, by its short hostname, when the agent said.
export const Agent = Schema.Struct({
  agentId: Token, app: Label, project: Label, machine: Schema.optional(Label), createdAt: Timestamp, finishedAt: Schema.NullOr(Timestamp),
  lastActivityAt: Timestamp, openCount: Count,
});
export type Agent = typeof Agent.Type;

// Decisions: one question from an agent, plus the owner's answer and the agent's acknowledgement.

export const DecisionStatus = Schema.Literal("open", "answered", "feedback", "acknowledged");
export type DecisionStatus = typeof DecisionStatus.Type;
export const Choice = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("option"), number: OptionNumber }),
  Schema.Struct({ kind: Schema.Literal("feedback"), text: Body }),
);
export type Choice = typeof Choice.Type;
export const AnswerInput = Schema.Struct({ requestId: Token, choice: Choice }).annotations(strict);
export type AnswerInput = typeof AnswerInput.Type;
export const Answer = Schema.Struct({ answerId: Token, decisionId: Token, choice: Choice, sentAt: Timestamp });
export type Answer = typeof Answer.Type;
export const AcknowledgementInput = Schema.Struct({ answerId: Token, nextSteps: Text }).annotations(strict);
export type AcknowledgementInput = typeof AcknowledgementInput.Type;
export const Acknowledgement = Schema.Struct({ decisionId: Token, answerId: Token, nextSteps: Text, acknowledgedAt: Timestamp });
export type Acknowledgement = typeof Acknowledgement.Type;
export const Receipt = Schema.Struct({ decisionId: Token, answerId: Token, sentAt: Timestamp });
export type Receipt = typeof Receipt.Type;

// Every image or page the brief names must be one of its attachments.
const briefLinks = (q: { card: BriefCard; attachments?: ReadonlyArray<{ name: string; type: AttachmentInfo["type"] }> }) =>
  missingAttachment(q.card.markdown, attachmentTypes(q.attachments)) ?? true;
export const acceptsChoice = (card: BriefCard, choice: Choice) =>
  choice.kind === "feedback" || card.options.some((option) => option.number === choice.number);
// Every card is a brief.
export const QuestionInput = Schema.Struct({
  title: Title,
  detail: Schema.optional(Text),
  card: BriefCard,
  attachments: Schema.optional(Attachments),
}).annotations(strict).pipe(Schema.filter(briefLinks));
export type QuestionInput = typeof QuestionInput.Type;
export const Decision = Schema.Struct({
  decisionId: Token,
  status: DecisionStatus,
  title: Title,
  detail: Schema.optional(Text),
  card: BriefCard,
  attachments: Schema.optional(Schema.Array(AttachmentInfo)),
  askedAt: Timestamp,
  answer: Schema.optional(Answer),
  // When an agent first read the answer, and when the owner was told none had (I6: neither means received).
  collectedAt: Schema.optional(Timestamp),
  warnedAt: Schema.optional(Timestamp),
  acknowledgement: Schema.optional(Acknowledgement),
}).pipe(
  Schema.filter(briefLinks),
  Schema.filter((d) => (d.collectedAt === undefined && d.warnedAt === undefined) || d.answer !== undefined || "only an answer is collected or warned about"),
  Schema.filter((d) => (d.status === "open") === (d.answer === undefined)),
  Schema.filter((d) => d.status === "feedback" || (d.status === "acknowledged") === (d.acknowledgement !== undefined)),
  Schema.filter((d) => !d.answer || d.answer.decisionId === d.decisionId),
  Schema.filter((d) => !d.acknowledgement || (d.acknowledgement.decisionId === d.decisionId && d.acknowledgement.answerId === d.answer?.answerId)),
  Schema.filter((d) => {
    const c = d.answer?.choice;
    return !c || acceptsChoice(d.card, c);
  }),
  Schema.filter((d) => (d.status === "feedback") === (d.answer?.choice.kind === "feedback")),
);
export type Decision = typeof Decision.Type;

// Requests.
export const CreatePagerInput = Schema.Struct({ number: PagerNumber, publicKey: PublicKey, autoOff: AutoOff }).annotations(strict);
export const PagerSettingsInput = Schema.Struct({ on: Schema.optional(Schema.Boolean), autoOff: Schema.optional(AutoOff) }).annotations(strict);
export const ConnectInput = Schema.Struct({ number: Schema.String, app: Label, project: Label, machine: Schema.optional(Label) }).annotations(strict);

// Responses.
export const PagerReply = Schema.Struct({ pager: Pager });
// The phone reads everything while its pager is off: open decisions in ask order, answered ones newest first.
export const AgentInbox = Schema.Struct({ agent: Agent, open: Schema.Array(Decision), answered: Schema.Array(Decision) });
export type AgentInbox = typeof AgentInbox.Type;
export const PagerInbox = Schema.Struct({ pager: Pager, agents: Schema.Array(AgentInbox) });
export type PagerInbox = typeof PagerInbox.Type;
export const Connected = Schema.Struct({ agent: Agent, agentKey: Token, message: Schema.String });
export type Connected = typeof Connected.Type;
export const AgentStatus = Schema.Struct({ agent: Agent, pager: Schema.Struct({ on: Schema.Boolean }) });
export const Finished = Schema.Struct({ finishedAt: Timestamp });
export const Asked = Schema.Struct({ decisionId: Token });
export const AnswerStatus = Schema.Union(Schema.Struct({ status: Schema.Literal("pending") }), Schema.Struct({ status: Schema.Literal("answered"), answer: Answer }));

// Every refusal is { error: <tag>, message: <one plain sentence>, ...fields } with its tag's HTTP status. Clients
// branch on the tag; the server words the message (packages/app/src/contract.ts).
export const REFUSAL_STATUS = {
  InvalidInput: 400, Unauthorized: 401, UnknownAgent: 404, UnknownPager: 404, UnknownDecision: 404, UnknownFile: 404, NotFound: 404,
  PagerOff: 409, PagerExists: 409, AgentFinished: 409, TooManyOpenDecisions: 409, NotAnswered: 409, AlreadyAcknowledged: 409,
  AnswerMismatch: 409, AlreadyAnswered: 409, NumberInvalid: 410, PagerDeleted: 410,
} as const;
export type RefusalTag = keyof typeof REFUSAL_STATUS;
