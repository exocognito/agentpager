import { Effect } from "effect";
import { expect, it } from "vitest";
import { createCardServices } from "./services.ts";
import { inbox, id } from "./decisions.ts";

it("replays an identical answer receipt without a second write", async () => {
  const fixture = createCardServices(inbox);
  const input = { requestId: id("r"), choice: { kind: "option" as const, number: 1 } };
  const first = await Effect.runPromise(
    fixture.service.answerCard(inbox.open[1].decisionId, input),
  );
  const repeat = await Effect.runPromise(
    fixture.service.answerCard(inbox.open[1].decisionId, input),
  );
  expect(repeat).toEqual(first);
  expect(fixture.writes).toHaveLength(1);
  await expect(
    Effect.runPromise(
      fixture.service.answerCard(inbox.open[1].decisionId, {
        ...input,
        choice: { kind: "option", number: 2 },
      }),
    ),
  ).rejects.toThrow();
});
