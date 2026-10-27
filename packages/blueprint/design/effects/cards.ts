import { Context, Data, Effect } from "effect";
import type { Unauthorized, UnknownSession, UnknownDecision, InvalidInput, SessionExpired, SessionEnded, AgentFinished, AlreadyAnswered } from "./session.ts";
import type { Inbox, AnswerInput, Receipt, Token, HomeSession, ConnectOpened } from "../schemas/exchange.ts";
// The service gave no usable reply. The card machine's failed states own what the phone keeps and shows.
export class Unreachable extends Data.TaggedError("Unreachable") {}
export type CardError = Unauthorized | UnknownSession | UnknownDecision | AlreadyAnswered | InvalidInput | SessionExpired | SessionEnded | AgentFinished | Unreachable;
// What the phone app calls. The product's layer is bound to the session and its stored phone credential; the machine never sees it.
export interface CardApiService {
  readonly readCards: () => Effect.Effect<Inbox, CardError>;
  readonly answerCard: (decisionId: Token, input: AnswerInput) => Effect.Effect<Receipt, CardError>;
  readonly endSession: () => Effect.Effect<{ readonly endedAt: string }, CardError>;
}
export class CardApi extends Context.Tag("@agentpager/CardApi")<CardApi, CardApiService>() {}
// What the home screen calls. The product's layer lists every session this browser holds a phone key for, most recent
// activity first: a live one read with its key, an ended or expired one from only its name and end time stored here.
// For each connect id registered here, it asks SessionStore.readConnect which session an agent made, and keeps the id
// until that names a session, returns the reserved phone's terminal name/time receipt, or answers ConnectLinkInvalid.
// Persisted pending claims are membership too: recover them using the original claimant key before listing.
// Discovery consumes a still-owned pending record under the same cross-tab commit lock as retirement;
// a delayed reply never restores a consumed record or a retired capability.
export interface HomeApiService {
  readonly listSessions: () => Effect.Effect<ReadonlyArray<HomeSession>, Unreachable>;
  // Registers a connect id and keeps it here with its phone key, so a session an agent makes with it is listed on the
  // next read.
  readonly openConnect: (connectId: Token) => Effect.Effect<ConnectOpened, Unreachable>;
}
export class HomeApi extends Context.Tag("@agentpager/HomeApi")<HomeApi, HomeApiService>() {}
