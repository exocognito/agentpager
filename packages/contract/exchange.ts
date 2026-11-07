import { Schema } from "effect";
import { Token, Text, Title, Body, Timestamp, OptionNumber, ValidProse, characters } from "./values.ts";
import { Attachments, AttachmentInfo, ATTACHMENTS_MAX, ATTACHMENTS_MAX_BYTES, attachmentTypes, IMAGE_MAX_BYTES, missingAttachment, PAGE_MAX_BYTES, Payload as BriefCard } from "./brief.ts";

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

// Every request from an AgentPager client says which client it is and the protocol it speaks, with its build for logs:
// `<client>/<protocol> <build>`, such as `cli/2 3f9c2ab` from the agentpager command or `ios/2 0.1+1` from the iPhone
// app (mirrored in Model/API.swift; mirror.test.ts checks it). The service compares only the protocol. It goes up
// with a change that clients from before it can't follow, and the service then refuses those clients as
// UpdateRequired, telling them how to update (packages/app/src/contract.ts). 2 is the encryption switch (M5): every
// card, attachment, identity, answer and acknowledgement travels as an encrypted part.
export const CLIENT_HEADER = "x-agentpager-client";
export const PROTOCOL = 2;
const CLIENT_VERSION = /^([a-z][a-z0-9-]{0,19})\/(0|[1-9][0-9]{0,5}) ([A-Za-z0-9._+-]{1,40})$/;
export type ClientVersion = { client: string; protocol: number; build: string };
// What a client of this code sends. A build that doesn't fit the header is sent with its other characters as "-".
export const clientVersion = (client: string, build: string) => `${client}/${PROTOCOL} ${build.replace(/[^A-Za-z0-9._+-]/g, "-").slice(0, 40) || "-"}`;
export function readClientVersion(header: string | null): ClientVersion | null {
  const parts = header === null ? null : CLIENT_VERSION.exec(header);
  return parts ? { client: parts[1], protocol: Number(parts[2]), build: parts[3] } : null;
}
export const MAX_OPEN_DECISIONS = 10;
// The longest an agent's answer read holds open before it returns pending.
export const ANSWER_WAIT_MAX_SECONDS = 50;

// Encrypted parts (envelope.ts, parts.ts): what the service carries between an agent's machine and the phone, and
// can't read. On the wire a part is base64url, no padding, of a version byte (1), the sender's one-time public key
// (32 bytes), a nonce (12) and the ciphertext with its 16-byte tag. AES-GCM keeps the plaintext's length, so the
// service knows each part's size, and that is all it checks: the shape, and the size its kind allows. Every kind is
// held to a byte size here, so a part always fits one stored row; the text inside has its own limits, which the end
// that seals it checks before it sends, and the end that opens it checks again (I4.9, blueprint/areas/3-cards.md).
export const ENVELOPE_OVERHEAD_BYTES = 61;
// An alert's preview: Apple takes at most 4096 bytes of payload, and a preview of this many seals to 2812 characters.
export const PREVIEW_MAX_BYTES = 2048;
export const PART_MAX_BYTES = {
  card: 1_000_000, attachment: Math.max(IMAGE_MAX_BYTES, PAGE_MAX_BYTES), identity: 16_384, acknowledgement: 65_536, answer: 65_536,
  decisionPreview: PREVIEW_MAX_BYTES, acknowledgementPreview: PREVIEW_MAX_BYTES,
} as const;
export type SealedKind = keyof typeof PART_MAX_BYTES;
// The plaintext bytes an encrypted part of this many characters carries.
export const sealedBytes = (part: string) => Math.floor((part.length * 3) / 4) - ENVELOPE_OVERHEAD_BYTES;
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
// Canonical base64url: only its alphabet, no length that leaves a lone character, and the last character's spare bits
// zero, so one part has one spelling. Its first byte is the version: 0x01 spells "A", then a character from "Q" to "f".
function sealedShape(text: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return false;
  const spare = text.length % 4 === 2 ? 15 : text.length % 4 === 3 ? 3 : 0;
  return (BASE64URL.indexOf(text[text.length - 1]) & spare) === 0 && text[0] === "A" && (BASE64URL.indexOf(text[1]) & 0x30) === 0x10;
}
export const Sealed = (kind: SealedKind) => Schema.String.pipe(
  Schema.filter(text => sealedShape(text) || "not an encrypted part"),
  Schema.filter(text => sealedBytes(text) >= 1 || "an encrypted part that holds nothing"),
  Schema.filter(text => sealedBytes(text) <= PART_MAX_BYTES[kind] || `an encrypted ${kind} may hold at most ${PART_MAX_BYTES[kind]} bytes`),
);

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
// Who asked ("Codex") and the project its decisions are grouped under ("atomic-pages"): sealed in an identity part.
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
// The pager's public key, which anyone may read by its id: the command checks it against the number's fingerprint
// before it seals anything to it (I19).
export const PagerKey = Schema.Struct({ pagerId: PagerId, publicKey: PublicKey });
export type PagerKey = typeof PagerKey.Type;
// An agent as the service holds it: who asked, its project and its computer are its identity part, sealed to the
// pager's key at connect, which only the phone opens.
export const Agent = Schema.Struct({
  agentId: Token, identity: Sealed("identity"), createdAt: Timestamp, finishedAt: Schema.NullOr(Timestamp),
  lastActivityAt: Timestamp, openCount: Count,
});
export type Agent = typeof Agent.Type;

// Decisions: one question from an agent, plus the owner's answer and the agent's acknowledgement. Each is an
// encrypted part; the service knows only ids, times, sizes and whether each has come.

// Whether an answer is an option or a note is inside it, which the service can't read.
export const DecisionStatus = Schema.Literal("open", "answered", "acknowledged");
export type DecisionStatus = typeof DecisionStatus.Type;
// What the owner chose, inside an answer part (parts.ts).
export const Choice = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("option"), number: OptionNumber }),
  Schema.Struct({ kind: Schema.Literal("feedback"), text: Body }),
);
export type Choice = typeof Choice.Type;
// The phone's answer: its part, sealed to the key inside the card it answers, and a request id the phone chose, so a
// resend after a lost reply, with the same part, is the same request (I5).
export const AnswerInput = Schema.Struct({ requestId: Token, answer: Sealed("answer") }).annotations(strict);
export type AnswerInput = typeof AnswerInput.Type;
// requestId lets the phone tell which of its sends the service stored.
export const Answer = Schema.Struct({ answerId: Token, decisionId: Token, requestId: Token, answer: Sealed("answer"), sentAt: Timestamp });
export type Answer = typeof Answer.Type;
// The agent's acknowledgement, and the preview its alert carries, both sealed to the pager's key.
export const AcknowledgementInput = Schema.Struct({ answerId: Token, acknowledgement: Sealed("acknowledgement"), preview: Sealed("acknowledgementPreview") }).annotations(strict);
export type AcknowledgementInput = typeof AcknowledgementInput.Type;
export const Acknowledgement = Schema.Struct({ decisionId: Token, answerId: Token, acknowledgement: Sealed("acknowledgement"), acknowledgedAt: Timestamp });
export type Acknowledgement = typeof Acknowledgement.Type;
export const Receipt = Schema.Struct({ decisionId: Token, answerId: Token, sentAt: Timestamp });
export type Receipt = typeof Receipt.Type;

// Every image or page the brief names must be one of its attachments.
const briefLinks = (q: { card: BriefCard; attachments?: ReadonlyArray<{ name: string; type: AttachmentInfo["type"] }> }) =>
  missingAttachment(q.card.markdown, attachmentTypes(q.attachments)) ?? true;
export const acceptsChoice = (card: { options: ReadonlyArray<{ number: number }> }, choice: Choice) =>
  choice.kind === "feedback" || card.options.some((option) => option.number === choice.number);
// A question as the agent writes it, before the command seals it: the command holds every card to this before it
// leaves the machine (I22.6, blueprint/areas/3-cards.md), since the service can't read it to refuse it.
export const QuestionInput = Schema.Struct({
  title: Title,
  detail: Schema.optional(Text),
  card: BriefCard,
  attachments: Schema.optional(Attachments),
}).annotations(strict).pipe(Schema.filter(briefLinks));
export type QuestionInput = typeof QuestionInput.Type;
// A keyed digest of the card that only its agent can make (an HMAC under a key from the agent's private key), so the
// service can tell the same card asked again from another one without reading either.
export const AskDigest = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_-]{43}$/));
// What an agent sends to ask: the card, each attachment in its slot and the alert's preview, each sealed to the pager's
// key and bound to the decision, and a request id its command chose. The decision is stored under the id
// decisionIdOf() makes from the agent and that request id, which the command works out before it seals. Asking again
// with the same request id and digest, as after a lost reply, finds the decision already made: the owner gets one
// decision and one alert. The same request id with another digest is refused (RequestIdTaken).
export const AskInput = Schema.Struct({
  requestId: Token,
  digest: AskDigest,
  card: Sealed("card"),
  attachments: Schema.optional(Schema.Array(Sealed("attachment")).pipe(
    Schema.maxItems(ATTACHMENTS_MAX),
    Schema.filter(list => list.reduce((sum, part) => sum + sealedBytes(part), 0) <= ATTACHMENTS_MAX_BYTES || `attachments may not exceed ${ATTACHMENTS_MAX_BYTES} bytes in all`),
  )),
  preview: Sealed("decisionPreview"),
}).annotations(strict);
export type AskInput = typeof AskInput.Type;
// A decision's id: the first 24 bytes of the SHA-256 of its agent's id and its ask's request id, base64url. No two
// agents' decisions can share one, so an agent can't name a decision of another agent's, on its pager or any other.
export async function decisionIdOf(agentId: string, requestId: string): Promise<Token> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`agentpager decision\n${agentId}\n${requestId}`)));
  return btoa(String.fromCharCode(...digest.slice(0, 24))).replaceAll("+", "-").replaceAll("/", "_");
}
// Each attachment's size, in its slot's order: what the service knows of it.
export const AttachmentSize = Schema.Struct({ bytes: Schema.Number.pipe(Schema.int(), Schema.between(1, PART_MAX_BYTES.attachment)) });
export const Decision = Schema.Struct({
  decisionId: Token,
  status: DecisionStatus,
  card: Sealed("card"),
  attachments: Schema.Array(AttachmentSize),
  askedAt: Timestamp,
  answer: Schema.optional(Answer),
  // When an agent first read the answer, and when the owner was told none had (I6: neither means received).
  collectedAt: Schema.optional(Timestamp),
  warnedAt: Schema.optional(Timestamp),
  acknowledgement: Schema.optional(Acknowledgement),
}).pipe(
  Schema.filter((d) => (d.collectedAt === undefined && d.warnedAt === undefined) || d.answer !== undefined || "only an answer is collected or warned about"),
  Schema.filter((d) => (d.status === "open") === (d.answer === undefined)),
  Schema.filter((d) => (d.status === "acknowledged") === (d.acknowledgement !== undefined)),
  Schema.filter((d) => !d.answer || d.answer.decisionId === d.decisionId),
  Schema.filter((d) => !d.acknowledgement || (d.acknowledgement.decisionId === d.decisionId && d.acknowledgement.answerId === d.answer?.answerId)),
);
export type Decision = typeof Decision.Type;

// Requests.
export const CreatePagerInput = Schema.Struct({ number: PagerNumber, publicKey: PublicKey, autoOff: AutoOff }).annotations(strict);
export const PagerSettingsInput = Schema.Struct({ on: Schema.optional(Schema.Boolean), autoOff: Schema.optional(AutoOff) }).annotations(strict);
// The agent connects with the number and its identity part, sealed to the key the number names. The service never
// gets the agent's own public key: it travels only inside each card (parts.ts answerKey).
export const ConnectInput = Schema.Struct({ number: Schema.String, identity: Sealed("identity") }).annotations(strict);

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
  InvalidInput: 400, UpdateRequired: 400, Unauthorized: 401, UnknownAgent: 404, UnknownPager: 404, UnknownDecision: 404, UnknownFile: 404, NotFound: 404,
  PagerOff: 409, PagerExists: 409, AgentFinished: 409, TooManyOpenDecisions: 409, NotAnswered: 409, AlreadyAcknowledged: 409,
  AnswerMismatch: 409, AlreadyAnswered: 409, RequestIdTaken: 409, NumberInvalid: 410, PagerDeleted: 410,
} as const;
export type RefusalTag = keyof typeof REFUSAL_STATUS;
