import { Effect, Layer, Schema } from "effect";
import { CardApi, type CardApiService } from "../../effects/cards.ts";
import {
  Decision,
  Inbox,
  SESSION_LIFETIME_MS,
  type AnswerInput,
  type QuestionInput,
  type Token,
  type Receipt,
} from "../../schemas/exchange.ts";
import {
  AgentFinished,
  AlreadyAnswered,
  InvalidInput,
  SessionEnded,
  SessionExpired,
} from "../../effects/session.ts";
import { acceptsChoice } from "../components/cards/schemas.ts";
import { newToken } from "../../machines/cards.ts";
import { pairingTarget } from "./decisions.ts";

// An in-memory session on its own clock. The agent never acknowledges or finishes unless the test does.
export function createCardServices(seed: Inbox) {
  let value = Schema.decodeUnknownSync(Inbox)(structuredClone(seed));
  let clock = Date.parse(seed.session.pairedAt ?? seed.session.lastAcceptedAt);
  let ended: { endedAt: string; endedBy: "owner" | "agent" } | null = null;
  const writes: AnswerInput[] = [];
  const receipts = new Map<string, { input: AnswerInput; receipt: Receipt }>();
  const iso = () => new Date(clock).toISOString();
  const expiresAt = () => value.session.expiresAt;
  const live = () => expiresAt() === null || clock < Date.parse(expiresAt()!);
  const check = () => {
    if (ended) return new SessionEnded(ended);
    if (!live()) return new SessionExpired({ expiredAt: expiresAt()! });
    return null;
  };
  const end = (endedBy: "owner" | "agent") => {
    ended = { endedAt: iso(), endedBy };
    value = { ...value, open: [], history: [] };
  };
  const service: CardApiService = {
    readCards: () => {
      const error = check();
      return error ? Effect.fail(error) : Effect.succeed(value);
    },
    answerCard: (decisionId, input) => {
      const error = check();
      if (error) return Effect.fail(error);
      if (value.session.finishedAt) return Effect.fail(new AgentFinished({ finishedAt: value.session.finishedAt }));
      const key = `${decisionId}:${input.requestId}`;
      const prior = receipts.get(key);
      if (prior) {
        if (JSON.stringify(prior.input) !== JSON.stringify(input))
          return Effect.fail(
            new InvalidInput({
              reason: "Request id belongs to another answer",
            }),
          );
        return Effect.succeed(structuredClone(prior.receipt));
      }
      const d = value.open.find((d) => d.decisionId === decisionId);
      const previous = value.history.find((d) => d.decisionId === decisionId);
      if (previous?.answer)
        return Effect.fail(
          new AlreadyAnswered({
            receipt: {
              decisionId,
              answerId: previous.answer.answerId,
              sentAt: previous.answer.sentAt,
            },
          }),
        );
      if (!d || !acceptsChoice(d.card, input.choice))
        return Effect.fail(
          new InvalidInput({ reason: "Choice does not match this decision" }),
        );
      const pairing = d.kind === "pairing";
      if (pairing && (input.choice.kind !== "option" || input.choice.number !== pairingTarget))
        return Effect.fail(new InvalidInput({ reason: "Choose the emoji your agent told you, then tap Send." }));
      const answer = {
        answerId: newToken(),
        decisionId,
        choice: input.choice,
        sentAt: iso(),
      };
      const closed = Schema.decodeUnknownSync(Decision)({
        ...d,
        status: input.choice.kind === "feedback" ? "feedback" : "answered",
        answer,
      });
      writes.push(input);
      value = Schema.decodeUnknownSync(Inbox)({
        session: {
          ...value.session,
          lastAcceptedAt: answer.sentAt,
          ...(pairing ? { paired: true, pairedAt: answer.sentAt, expiresAt: new Date(clock + SESSION_LIFETIME_MS).toISOString() } : {}),
        },
        open: value.open.filter((d) => d.decisionId !== decisionId),
        history: [closed, ...value.history],
      });
      const receipt = {
        decisionId,
        answerId: answer.answerId,
        sentAt: answer.sentAt,
      };
      receipts.set(key, { input: structuredClone(input), receipt });
      return Effect.succeed(receipt);
    },
    endSession: () => {
      const error = check();
      if (error) return Effect.fail(error);
      end("owner");
      return Effect.succeed({ endedAt: ended!.endedAt });
    },
  };
  const layer = Layer.succeed(CardApi, service);
  return {
    layer,
    service,
    writes,
    now: () => clock,
    read: () => value,
    advance: (ms: number) => (clock += ms),
    // Finishing before pairing ends the session; after pairing it leaves everything readable.
    finishByAgent: () => {
      if (!value.session.paired) return end("agent");
      value = Schema.decodeUnknownSync(Inbox)({ ...value, session: { ...value.session, finishedAt: iso() } });
    },
    acknowledge: (decisionId: Token, text: string) => {
      value = Schema.decodeUnknownSync(Inbox)({
        ...value,
        session: { ...value.session, lastAcceptedAt: iso() },
        history: value.history.map((d) =>
          d.decisionId === decisionId
            ? {
                ...d,
                status: d.status === "feedback" ? "feedback" : "acknowledged",
                acknowledgement: {
                  decisionId,
                  answerId: d.answer!.answerId,
                  nextSteps: text,
                  acknowledgedAt: iso(),
                },
              }
            : d,
        ),
      });
    },
    ask: (question: QuestionInput) => {
      const decision = Schema.decodeUnknownSync(Decision)({
        ...question,
        decisionId: newToken(),
        kind: "card",
        status: "open",
        askedAt: iso(),
      });
      value = Schema.decodeUnknownSync(Inbox)({
        ...value,
        open: [...value.open, decision],
      });
      return decision;
    },
  };
}
