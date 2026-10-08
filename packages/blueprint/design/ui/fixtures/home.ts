import { Effect, Layer, Schema } from "effect";
import { HomeApi, Unreachable, type HomeApiService } from "../../effects/cards.ts";
import { UNPAIRED_LIFETIME_MS, ConnectOpened, HomeSession, LiveHomeSession, EndedHomeSession, Token } from "../../schemas/exchange.ts";
import { id, inbox, NOW, session } from "./decisions.ts";

const minutesBefore = (minutes: number) => new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
const row = (value: unknown) => Schema.decodeUnknownSync(LiveHomeSession)(value);

// The live session the card fixtures hold, as its home row.
export const liveRow = row({ sessionId: session.sessionId, name: session.name, status: "active", openCount: inbox.open.length, lastActivityAt: minutesBefore(2) });
export const unpairedRow = row({ sessionId: id("u"), name: "Codex · agentpager", status: "unpaired", openCount: 1, lastActivityAt: minutesBefore(1) });
// A paired session whose agent finished: still readable, nothing left to answer.
export const finishedRow = row({ sessionId: id("f"), name: "Pi · release notes", status: "finished", openCount: 0, lastActivityAt: minutesBefore(40) });
export const endedRow = Schema.decodeUnknownSync(EndedHomeSession)({ name: "Claude · trip planner", endedAt: minutesBefore(26 * 60) });
// The session an agent makes with the phone's connect link, before the owner chooses its emoji.
export const joinedRow = row({ sessionId: id("j"), name: "Claude Code · dotfiles", status: "unpaired", openCount: 1, lastActivityAt: minutesBefore(0) });
export const connectIds = ["k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg", "N4wPz8RqT1mVx6KbL9sYc2EhJ5aGd7Uf"].map(t => Schema.decodeUnknownSync(Token)(t));
// Hands out connectIds in turn, so stories and tests know which id the sheet shows.
export const connectIdsInTurn = () => { let n = 0; return () => connectIds[n++ % connectIds.length]; };
export const expiredRow = Schema.decodeUnknownSync(EndedHomeSession)({ name: "Research agent", endedAt: minutesBefore(3 * 24 * 60) });

// An in-memory phone holding these rows. `fail` makes the next calls unreachable until cleared; `join` is an agent
// using the last connect id the phone registered.
export function createHomeServices(seed: ReadonlyArray<HomeSession>) {
  let rows = [...seed];
  let failing = false;
  let opened: ReadonlyArray<Token> = [];
  const service: HomeApiService = {
    listSessions: () => (failing ? Effect.fail(new Unreachable()) : Effect.succeed(rows)),
    openConnect: (connectId) => {
      if (failing) return Effect.fail(new Unreachable());
      opened = [...opened, connectId];
      return Effect.succeed(Schema.decodeUnknownSync(ConnectOpened)({ phoneKey: id("k"), expiresAt: new Date(Date.parse(NOW) + UNPAIRED_LIFETIME_MS).toISOString() }));
    },
  };
  return {
    layer: Layer.succeed(HomeApi, service),
    now: () => Date.parse(NOW),
    set: (next: ReadonlyArray<HomeSession>) => (rows = [...next]),
    fail: (next: boolean) => (failing = next),
    opened: () => opened,
    join: () => (rows = [joinedRow, ...rows]),
  };
}
