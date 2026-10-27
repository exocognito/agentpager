import { Context, Data, Effect } from 'effect';
import { type Acknowledgement, type ClaimedSession, type ConnectStatus, type AcknowledgementInput, type AgentStatus, type AnswerInput, type AnswerStatus, type Decision, type Inbox, type QuestionInput, type Receipt, type SessionCreated, type SessionInput, type ConnectOpened, type PhoneJoined, type Token } from '../schemas/exchange.ts';

export class Unauthorized extends Data.TaggedError('Unauthorized') {}
export class UnknownSession extends Data.TaggedError('UnknownSession') {}
export class UnknownDecision extends Data.TaggedError('UnknownDecision') {}
export class PairingLinkInvalid extends Data.TaggedError('PairingLinkInvalid') {}
export class ConnectLinkInvalid extends Data.TaggedError('ConnectLinkInvalid') {}
export class AlreadyPaired extends Data.TaggedError('AlreadyPaired') {}
export class NotAnswered extends Data.TaggedError('NotAnswered') {}
export class AlreadyAcknowledged extends Data.TaggedError('AlreadyAcknowledged') {}
export class AnswerMismatch extends Data.TaggedError('AnswerMismatch') {}
export class AlreadyAnswered extends Data.TaggedError('AlreadyAnswered')<{ readonly receipt: Receipt }> {}
export class InvalidInput extends Data.TaggedError('InvalidInput')<{ readonly reason: string }> {}
// Only the reserved phone's credential can retrieve the optional terminal name receipt.
export class SessionExpired extends Data.TaggedError('SessionExpired')<{ readonly expiredAt: string; readonly sessionName?: string }> {}
// The owner ended the session, or the agent finished before pairing, which ends it (C4).
export class SessionEnded extends Data.TaggedError('SessionEnded')<{ readonly endedAt: string; readonly endedBy: 'owner' | 'agent'; readonly sessionName?: string }> {}
// The agent finished a paired session: its key is refused and the phone can no longer answer, but the phone still reads it (C4).
export class AgentFinished extends Data.TaggedError('AgentFinished')<{ readonly finishedAt: string }> {}

export type SessionError = Unauthorized | UnknownSession | UnknownDecision | PairingLinkInvalid | ConnectLinkInvalid | AlreadyPaired | NotAnswered | AlreadyAcknowledged | AnswerMismatch | AlreadyAnswered | InvalidInput | SessionExpired | SessionEnded | AgentFinished;

// The one service the product supplies per session, backed by that session's Durable Object. Every boundary decodes
// through the schemas, and every expected refusal travels in the error channel named here.
export interface SessionStoreService {
  readonly createSession: (input: SessionInput) => Effect.Effect<SessionCreated, InvalidInput>;
  readonly agentStatus: (sessionId: Token, agentKey: Token) => Effect.Effect<AgentStatus, Unauthorized | UnknownSession | SessionExpired | SessionEnded | AgentFinished>;
  // C9::connect-an-agent-from-the-phone: the phone registers a connect id it made. The first agent to join with it
  // within UNPAIRED_LIFETIME_MS makes a session the phone already holds under the returned phone key. An id already
  // registered answers InvalidInput; a used, expired or unknown one answers ConnectLinkInvalid.
  readonly openConnect: (connectId: Token) => Effect.Effect<ConnectOpened, InvalidInput>;
  readonly joinPhone: (connectId: Token, input: SessionInput) => Effect.Effect<PhoneJoined, ConnectLinkInvalid | InvalidInput>;
  // How the registering phone finds the session an agent made with its connect id; only that id's phone key reads it.
  // A used id names its session; one that expired unused, or an unknown one, answers ConnectLinkInvalid.
  readonly readConnect: (connectId: Token, phoneKey: Token) => Effect.Effect<ConnectStatus, Unauthorized | ConnectLinkInvalid | SessionExpired | SessionEnded>;
  // Persist a random phone key before claiming; send it in PHONE_AUTH_HEADER. Only that first
  // credential can recover the reservation after a lost reply. A different claimant is refused (I1).
  readonly claimPairing: (token: Token, phoneKey: Token) => Effect.Effect<ClaimedSession, Unauthorized | PairingLinkInvalid | AlreadyPaired | SessionExpired | SessionEnded>;
  // I3::independent-decisions owns when an ask is accepted.
  readonly askCard: (sessionId: Token, agentKey: Token, question: QuestionInput) => Effect.Effect<Decision, Unauthorized | UnknownSession | InvalidInput | SessionExpired | SessionEnded | AgentFinished>;
  readonly readCardAnswer: (sessionId: Token, agentKey: Token, decisionId: Token) => Effect.Effect<AnswerStatus, Unauthorized | UnknownSession | UnknownDecision | InvalidInput | SessionExpired | SessionEnded | AgentFinished>;
  readonly acknowledgeCard: (sessionId: Token, agentKey: Token, decisionId: Token, input: AcknowledgementInput) => Effect.Effect<Acknowledgement, Unauthorized | UnknownSession | UnknownDecision | NotAnswered | AlreadyAcknowledged | AnswerMismatch | InvalidInput | SessionExpired | SessionEnded | AgentFinished>;
  readonly readCards: (sessionId: Token, phoneKey: Token) => Effect.Effect<Inbox, Unauthorized | UnknownSession | SessionExpired | SessionEnded>;
  // C1::pair-a-phone-by-qr owns the pairing answer's refusals.
  readonly answerCard: (sessionId: Token, phoneKey: Token, decisionId: Token, input: AnswerInput) => Effect.Effect<Receipt, Unauthorized | UnknownSession | UnknownDecision | AlreadyAnswered | InvalidInput | SessionExpired | SessionEnded | AgentFinished>;
  // C4: the owner ends the session from the phone; the agent finishes its part. Finishing an unpaired session ends it.
  readonly endSession: (sessionId: Token, phoneKey: Token) => Effect.Effect<{ readonly endedAt: string }, Unauthorized | UnknownSession | SessionExpired | SessionEnded>;
  readonly finishSession: (sessionId: Token, agentKey: Token) => Effect.Effect<{ readonly finishedAt: string }, Unauthorized | UnknownSession | SessionExpired | SessionEnded | AgentFinished>;
}
export class SessionStore extends Context.Tag('@agentpager/SessionStore')<SessionStore, SessionStoreService>() {}

export { AGENT_AUTH_HEADER, MCP, PHONE_AUTH_HEADER, ROUTES, type RouteKey } from './routes.ts';

// Each tagged error's HTTP status; the body is { error: <tag>, ...fields }.
export const HTTP_STATUS: Record<SessionError['_tag'], number> = {
  Unauthorized: 401, UnknownSession: 404, UnknownDecision: 404, PairingLinkInvalid: 410, ConnectLinkInvalid: 410, SessionExpired: 410, SessionEnded: 410, AgentFinished: 410,
  AlreadyPaired: 409, NotAnswered: 409, AlreadyAcknowledged: 409, AnswerMismatch: 409, AlreadyAnswered: 409, InvalidInput: 400,
};
