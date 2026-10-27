import { Schema } from "effect";
import { Token, Text, Body, Emoji, Timestamp, OptionNumber, Option, SessionName } from "./values.ts";
import { Card, acceptsChoice } from "../ui/components/cards/schemas.ts";
import { Attachments, AttachmentInfo, attachmentTypes, missingAttachment, Payload as BriefCard } from "../ui/components/cards/brief/schema.ts";
// The primitives live in values.ts; this module re-exports them so one import path carries the whole exchange.
export * from "./values.ts";
export { Card, CardKind } from "../ui/components/cards/schemas.ts";
export { AttachmentInfo, AttachmentInput, AttachmentType, BRIEF_OPTIONS_MAX, letter } from "../ui/components/cards/brief/schema.ts";

export const PAIRING_OPTION_COUNT = 5;

// `pairing` is the first decision the service creates; `card` is every decision the agent asks.
export const DecisionKind = Schema.Literal("pairing", "card");
export type DecisionKind = typeof DecisionKind.Type;
export const DecisionStatus = Schema.Literal(
  "open",
  "answered",
  "feedback",
  "acknowledged",
);
export type DecisionStatus = typeof DecisionStatus.Type;
export const Choice = Schema.Union(
  Schema.Struct({ kind: Schema.Literal("option"), number: OptionNumber }),
  Schema.Struct({ kind: Schema.Literal("feedback"), text: Body }),
);
export type Choice = typeof Choice.Type;
export const AnswerInput = Schema.Struct({ requestId: Token, choice: Choice }).annotations({parseOptions:{onExcessProperty:"error"}});
export type AnswerInput = typeof AnswerInput.Type;
export const Answer = Schema.Struct({
  answerId: Token,
  decisionId: Token,
  choice: Choice,
  sentAt: Timestamp,
});
export type Answer = typeof Answer.Type;
export const AcknowledgementInput = Schema.Struct({
  answerId: Token,
  nextSteps: Text,
}).annotations({parseOptions:{onExcessProperty:"error"}});
export type AcknowledgementInput = typeof AcknowledgementInput.Type;
export const Acknowledgement = Schema.Struct({
  decisionId: Token,
  answerId: Token,
  nextSteps: Text,
  acknowledgedAt: Timestamp,
});
export type Acknowledgement = typeof Acknowledgement.Type;
// Attachments come only with a brief, and every image or page the brief names must be one of them.
const briefLinks = (q: { card: Card; attachments?: ReadonlyArray<{ name: string; type: AttachmentInfo["type"] }> }) =>
  q.card.type === "brief" ? missingAttachment(q.card.markdown, attachmentTypes(q.attachments)) ?? true
    : q.attachments === undefined || "attachments come only with a brief card";
// Every new card is a brief; a decision asked before emoji cards were retired may still hold one (Decision.card).
export const QuestionInput = Schema.Struct({
  title: Text,
  detail: Schema.optional(Body),
  card: BriefCard,
  attachments: Schema.optional(Attachments),
}).annotations({parseOptions:{onExcessProperty:"error"}}).pipe(Schema.filter(briefLinks));
export type QuestionInput = typeof QuestionInput.Type;
export const Decision = Schema.Struct({
  decisionId: Token,
  kind: DecisionKind,
  status: DecisionStatus,
  title: Text,
  detail: Schema.optional(Body),
  card: Card,
  attachments: Schema.optional(Schema.Array(AttachmentInfo)),
  askedAt: Timestamp,
  answer: Schema.optional(Answer),
  acknowledgement: Schema.optional(Acknowledgement),
}).pipe(
  Schema.filter(briefLinks),
  Schema.filter(
    (d) =>
      (d.status === "open") ===
      (d.answer === undefined),
  ),
  Schema.filter(
    (d) => d.status === "feedback" || (d.status === "acknowledged") === (d.acknowledgement !== undefined),
  ),
  Schema.filter((d) => !d.answer || d.answer.decisionId === d.decisionId),
  Schema.filter(
    (d) =>
      !d.acknowledgement ||
      (d.acknowledgement.decisionId === d.decisionId &&
        d.acknowledgement.answerId === d.answer?.answerId),
  ),
  Schema.filter((d) => {
    const c = d.answer?.choice;
    return !c || acceptsChoice(d.card, c);
  }),
  Schema.filter(
    (d) => (d.status === "feedback") === (d.answer?.choice.kind === "feedback"),
  ),
  // C1: exactly five choices, no disclosed recommendation and no feedback.
  Schema.filter((d) => d.kind !== "pairing" || (d.card.type === "generic" && d.card.options.length === PAIRING_OPTION_COUNT && d.card.recommended === undefined && d.status !== "feedback") || "a pairing decision has five emoji choices, no recommended option, and is answered by option"),
);
export type Decision = typeof Decision.Type;

export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
// A local instance enforces shorter lifetimes so tests cross them in real time: each test starts its instance with the
// shortest its case allows, from LOCAL_LIFETIME_FLOOR_MS up to these. A deployed build never does (D1).
export const LOCAL_LIFETIMES = { unpairedMs: 60 * 1000, sessionMs: 3 * 60 * 1000 } as const;
export const LOCAL_LIFETIME_FLOOR_MS = 10 * 1000;
const sessionLifetime = (ms: number) => ms === SESSION_LIFETIME_MS || (ms >= LOCAL_LIFETIME_FLOOR_MS && ms <= LOCAL_LIFETIMES.sessionMs);
// What the agent sends to create a session: the name the owner sees it by, such as its app and project.
export const SessionInput = Schema.Struct({ name: SessionName }).annotations({parseOptions:{onExcessProperty:"error"}});
export type SessionInput = typeof SessionInput.Type;
// finishedAt is when the agent finished: the session stays readable but takes no more cards or answers (C4).
export const SessionSummary = Schema.Struct({ sessionId: Token, name: SessionName, paired: Schema.Boolean, pairedAt: Schema.NullOr(Timestamp), lastAcceptedAt: Timestamp, expiresAt: Schema.NullOr(Timestamp), finishedAt: Schema.NullOr(Timestamp) }).pipe(
  Schema.filter(session => session.finishedAt === null || session.paired || "only a paired session can be finished; finishing before pairing ends it"),
  Schema.filter(session => session.paired === (session.pairedAt !== null) || "paired means the correct pairing answer was accepted"),
  // An unpaired session's deadline is UNPAIRED_LIFETIME_MS after creation; pairing replaces it with the session lifetime.
  Schema.filter(session => session.pairedAt === null ? session.expiresAt !== null || "an unpaired session has its unpaired deadline" :
    session.expiresAt !== null && sessionLifetime(Date.parse(session.expiresAt) - Date.parse(session.pairedAt)) || "expiry is fixed at the session lifetime after pairing"),
);
export type SessionSummary = typeof SessionSummary.Type;

// What the phone reads: every open decision in ask order, and every closed decision newest first.
export const Inbox = Schema.Struct({session:SessionSummary,open:Schema.Array(Decision),history:Schema.Array(Decision)}).pipe(
  Schema.filter(i=>i.session.paired || (i.open.length===1 && i.open[0].kind==="pairing" && i.history.length===0) || "before pairing the inbox holds only the open pairing decision"),
  Schema.filter(i=>!i.session.paired || i.open.every(d=>d.kind==="card") || "a paired session has no open pairing decision"),
  Schema.filter(i=>[...i.open,...i.history].filter(d=>d.kind==="pairing").length<=1 || "a session has one pairing decision"),
  Schema.filter(i=>i.open.every(d=>d.status==="open") && i.history.every(d=>d.status!=="open")),
  Schema.filter(i=>new Set([...i.open,...i.history].map(d=>d.decisionId)).size===i.open.length+i.history.length),
);
export type Inbox = typeof Inbox.Type;

// C8: a terminal label has no original identity, credential, status or card data.
export const HomeSessionStatus = Schema.Literal("unpaired", "active", "finished");
export type HomeSessionStatus = typeof HomeSessionStatus.Type;
export const LiveHomeSession = Schema.Struct({ sessionId: Token, name: SessionName, status: HomeSessionStatus, openCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()), lastActivityAt: Timestamp }).annotations({parseOptions:{onExcessProperty:"error"}});
export type LiveHomeSession = typeof LiveHomeSession.Type;
export const EndedHomeSession = Schema.Struct({ name: SessionName, endedAt: Timestamp }).annotations({parseOptions:{onExcessProperty:"error"}});
export type EndedHomeSession = typeof EndedHomeSession.Type;
export const HomeSession = Schema.Union(LiveHomeSession, EndedHomeSession);
export type HomeSession = typeof HomeSession.Type;

export const Receipt = Schema.Struct({ decisionId: Token, answerId: Token, sentAt: Timestamp });
export type Receipt = typeof Receipt.Type;

// Agent-side views.
// qrText draws the same QR code as qrUrl in Unicode block characters, so a phone camera can scan it from a terminal.
export const PairingLink = Schema.Struct({ url: Schema.String, qrUrl: Schema.String, qrText: Schema.String, token: Token, expiresAt: Timestamp });
export type PairingLink = typeof PairingLink.Type;
export const SessionCreated = Schema.Struct({ session: SessionSummary, agentKey: Token, pairing: PairingLink, pairingDecisionId: Token, pairingTarget: Option });
export type SessionCreated = typeof SessionCreated.Type;
// What the phone gets for a connect id it registered: the phone key of the session an agent makes with that id, and
// when the id stops working if no agent has used it (C9::connect-an-agent-from-the-phone).
export const ConnectOpened = Schema.Struct({ phoneKey: Token, expiresAt: Timestamp });
export type ConnectOpened = typeof ConnectOpened.Type;
// Discovery carries the real name in the same response as membership, never a placeholder.
export const ClaimedSession = Schema.Struct({ sessionId: Token, phoneKey: Token, name: SessionName });
export type ClaimedSession = typeof ClaimedSession.Type;
// Null until one joins. Terminal discovery is a refusal with the owner's name/time receipt.
export const ConnectStatus = Schema.Union(
  Schema.Struct({ sessionId: Schema.Null }),
  Schema.Struct({ sessionId: Token, name: SessionName }),
);
export type ConnectStatus = typeof ConnectStatus.Type;
// What an agent receives on joining a phone: like SessionCreated, with no pairing link because the phone already holds the session.
export const PhoneJoined = Schema.Struct({ session: SessionSummary, agentKey: Token, pairingDecisionId: Token, pairingTarget: Option });
export type PhoneJoined = typeof PhoneJoined.Type;
export const AgentStatus = Schema.Struct({ session: SessionSummary, pairing: Schema.NullOr(PairingLink), pairingTarget: Schema.NullOr(Option) });
export type AgentStatus = typeof AgentStatus.Type;
export const AnswerStatus = Schema.Union(Schema.Struct({status:Schema.Literal("pending")}),Schema.Struct({status:Schema.Literal("answered"),answer:Answer}));
export type AnswerStatus = typeof AnswerStatus.Type;

// The longest the agent's answer read holds open before it returns pending.
export const ANSWER_WAIT_MAX_MS = 50 * 1000;

// MCP tool boundaries at /mcp. Every tool after start_session names its session and presents the agent key.
const AgentCall={sessionId:Token,agentKey:Token};
const strict={parseOptions:{onExcessProperty:"error" as const}};
export const MCP_TOOLS = {
  start_session:{input:SessionInput,result:SessionCreated},
  // An agent given a connect link joins that phone with its id instead of starting a session.
  join_session:{input:Schema.Struct({connectId:Token,name:SessionName}).annotations(strict),result:PhoneJoined},
  ask_card:{input:Schema.Struct({...AgentCall,question:QuestionInput}).annotations(strict),result:Schema.Struct({decisionId:Token})},
  wait_for_card_answer:{input:Schema.Struct({...AgentCall,decisionId:Token,waitSeconds:Schema.optional(Schema.Number.pipe(Schema.int(),Schema.between(1,ANSWER_WAIT_MAX_MS / 1000)))}).annotations(strict),result:Schema.Struct({answer:AnswerStatus})},
  acknowledge_card:{input:Schema.Struct({...AgentCall,decisionId:Token,acknowledgement:AcknowledgementInput}).annotations(strict),result:Acknowledgement},
  // Finishing keeps the session readable on the phone; the agent key stops working (C4).
  finish_session:{input:Schema.Struct(AgentCall),result:Schema.Struct({finishedAt:Timestamp})},
} as const;

// A session nobody pairs expires this long after creation; an unused connect id stops working after the same time.
export const UNPAIRED_LIFETIME_MS = 15 * 60 * 1000;
export const PHONE_POLL_MS = 3000;
// After Send the phone holds the answer this long so the owner can take it back; closing the card cancels it.
export const UNDO_MS = 5000;
// A Send with no usable reply retries on its own before the phone says it failed: after 1.5 s, 3 s and 6 s.
export const SEND_RETRIES = 3;
export const SEND_RETRY_BASE_MS = 1500;

// The pairing decision offers PAIRING_OPTION_COUNT of these; the title is the emoji's plain name.
export const PAIRING_EMOJIS: ReadonlyArray<readonly [Emoji, string]> = [
  ["🍋", "Lemon"], ["🦊", "Fox"], ["🌵", "Cactus"], ["🚲", "Bicycle"], ["🌙", "Moon"], ["🍄", "Mushroom"], ["🐙", "Octopus"], ["🎈", "Balloon"],
  ["🧭", "Compass"], ["🪁", "Kite"], ["🥑", "Avocado"], ["🐢", "Turtle"], ["🎺", "Trumpet"], ["🧦", "Socks"], ["🪐", "Planet"], ["🍩", "Doughnut"],
];
export const PAIRING_TITLE = "Confirm agent connection";
// The pairing card's recommendation is always this advice, never an option: naming one would give the emoji away.
export const PAIRING_RECOMMENDATION = "Check which emoji your agent asked you to press";
