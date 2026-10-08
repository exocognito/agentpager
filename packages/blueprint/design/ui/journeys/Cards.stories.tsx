import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Effect, Layer, Schema } from "effect";
import { CardApi, Unreachable } from "../../effects/cards.ts";
import { CardApp } from "../screens/CardScreen.tsx";
import { createCardServices } from "../fixtures/services.ts";
import {
  inbox,
  NOW,
  session,
  feedbackDecision,
  question,
  updateQuestion,
  pairingInbox,
  pairingDecision,
  pairingTarget,
} from "../fixtures/decisions.ts";
import { BODY_MAX_CHARACTERS, Inbox, TEXT_MAX_CHARACTERS, UNDO_MS } from "../../schemas/exchange.ts";
function Preview() {
  const [services] = useState(() => createCardServices(inbox));
  return <CardApp layer={services.layer} now={services.now} />;
}
const meta = { title: "v1/Session/Journeys", component: Preview } satisfies Meta<
  typeof Preview
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Browse: Story = {};
export const Unpaired: Story = {
  render: () => {
    const [f] = useState(() => createCardServices(pairingInbox));
    return <CardApp layer={f.layer} now={f.now} />;
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("dialog", { name: pairingDecision.title }),
    ).toBeVisible();
  },
};
// C1: the claimed link lands on the pairing card, already open; a wrong emoji stores nothing.
export const PairByEmoji: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(pairingInbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await expect(
      await canvas.findByRole("dialog", { name: pairingDecision.title }),
    ).toBeVisible();
    expect(canvas.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    const wrong = pairingTarget === 1 ? 2 : 1;
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^Choose ${wrong}:`) }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Nothing was sent");
    expect(f.writes).toHaveLength(0);
    expect(f.read().session.paired).toBe(false);
    await userEvent.click(canvas.getByRole("button", { name: new RegExp(`^Choose ${pairingTarget}:`) }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(f.read().session.paired).toBe(true));
    // The sheet stays on the sent answer; close it to return to the queue.
    await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
    await expect(
      await canvas.findByRole("button", { name: new RegExp(pairingDecision.title) }),
    ).toHaveTextContent("Waiting for your agent");
    await waitFor(() => expect(canvas.getByText(/Session expires/)).toBeVisible());
  },
};
export const AnswerInAnyOrder: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Choose 1:/ }));
    expect(f.writes).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(f.read().open).toHaveLength(2));
    // The sheet stays on the sent answer; close it to return to the queue.
    await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
    expect(f.read().open[0].decisionId).toBe(inbox.open[0].decisionId);
    expect(f.writes[0].choice).toEqual({ kind: "option", number: 1 });
    await expect(
      canvas.getByRole("button", { name: /Send Maya the update/ }),
    ).toHaveTextContent("Waiting for your agent");
  },
};
// Send opens a five-second Undo window. Undo keeps the choice and sends nothing; the next Send goes when the window ends.
export const UndoThenSend: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} />);
    await userEvent.click(await canvas.findByRole("button", { name: /Send Maya the update/ }));
    await userEvent.click(canvas.getByRole("button", { name: /^Choose 2:/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    const undo = await canvas.findByRole("button", { name: /^Undo · \ds$/ });
    await expect(undo).toHaveFocus();
    await userEvent.click(undo);
    expect(f.writes).toHaveLength(0);
    await expect(canvas.getByRole("button", { name: /^Choose 2:/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await new Promise((r) => setTimeout(r, UNDO_MS - 1000));
    expect(f.writes).toHaveLength(0);
    await waitFor(() => expect(f.writes).toHaveLength(1), { timeout: 3000 });
    expect(f.writes[0].choice).toEqual({ kind: "option", number: 2 });
    await expect(await canvas.findByText("Waiting for your agent")).toBeVisible();
    f.acknowledge(inbox.open[1].decisionId, "Sending it at 9:00 tomorrow.");
    await expect(await canvas.findByText("Your agent confirmed", { selector: ".ap-ack .ap-confirmed" }, { timeout: 5000 })).toBeVisible();
    await expect(canvas.getByText("Sending it at 9:00 tomorrow.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
  },
};
// Closing the card in the Undo window cancels the answer: nothing is sent and the card stays open.
export const ClosingCancels: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} />);
    await userEvent.click(await canvas.findByRole("button", { name: /Merge PR #142/ }));
    await userEvent.click(canvas.getByRole("button", { name: /^Choose 1:/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog")).not.toBeInTheDocument());
    await new Promise((r) => setTimeout(r, UNDO_MS + 500));
    expect(f.writes).toHaveLength(0);
    await expect(canvas.getByRole("button", { name: /Merge PR #142/ })).not.toHaveTextContent("Waiting for your agent");
  },
};
export const Feedback: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Ask for changes" }),
    );
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.type(
      canvas.getByRole("textbox", { name: "What should your agent change?" }),
      "Please make it shorter.",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(f.read().history[0].status).toBe("feedback"));
    // The sheet stays on the sent answer; close it to return to the queue.
    await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
    expect(f.read().history[0].answer?.choice).toEqual({
      kind: "feedback",
      text: "Please make it shorter.",
    });
  },
};
export const HistoryUpdates: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Choose 1:/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(f.read().history[0].status).toBe("answered"));
    // The sheet stays on the sent answer; close it to return to the queue.
    await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
    await userEvent.click(
      canvas.getByRole("button", { name: /Send Maya the update/ }),
    );
    for (const option of within(canvas.getByRole("dialog")).getAllByRole("button", { name: /^Choose / })) await expect(option).toBeDisabled();
    expect(canvas.queryByRole("button", { name: "Send" })).toBeNull();
    f.acknowledge(
      inbox.open[1].decisionId,
      "I will send the exact email you approved.",
    );
    await waitFor(
      () =>
        expect(
          canvas.getByText("I will send the exact email you approved."),
        ).toBeVisible(),
      { timeout: 5000 },
    );
  },
};
// Every control on the generic card is at least 44 px tall.
export const General: Story = {
  render: () => {
    const [f] = useState(() =>
      createCardServices(
        Schema.decodeUnknownSync(Inbox)({ session, open: [question], history: [] }),
      ),
    );
    return <CardApp layer={f.layer} now={f.now} />;
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: new RegExp(question.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }),
    );
    for (const button of [
      ...canvas.getAllByRole("button", { name: /^Choose / }),
      canvas.getByRole("button", { name: "Ask for changes" }),
      canvas.getByRole("button", { name: "Send" }),
    ]) {
      // The sheet rises with a short animation, so measure once it settles.
      await waitFor(() => expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44));
    }
  },
};
export const EndSession: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await canvas.findByRole("heading", { name: session.name });
    await userEvent.click(canvas.getByRole("button", { name: "End session" }));
    expect(f.read().open).toHaveLength(3);
    await userEvent.click(
      within(canvas.getByRole("dialog")).getByRole("button", { name: "End session" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "Session ended" }),
    ).toBeVisible();
    await expect(canvas.getByText("You ended this session.")).toBeVisible();
    expect(f.read().open).toHaveLength(0);
    expect(f.read().history).toHaveLength(0);
  },
};
export const Expired: Story = {
  render: () => {
    const [f] = useState(() => {
      const f = createCardServices(inbox);
      f.advance(24 * 60 * 60 * 1000);
      return f;
    });
    return <CardApp layer={f.layer} now={f.now} />;
  },
};

export const LostReceiptRetry: Story = {
  play: async ({ mount, userEvent }) => {
    const fixture = createCardServices(inbox);
    let loseReceipt = true;
    const layer = Layer.succeed(CardApi, {
      ...fixture.service,
      answerCard: (decisionId, input) =>
        Effect.flatMap(
          fixture.service.answerCard(decisionId, input),
          (receipt) => {
            if (loseReceipt) {
              loseReceipt = false;
              return Effect.fail(new Unreachable());
            }
            return Effect.succeed(receipt);
          },
        ),
    });
    const canvas = await mount(<CardApp layer={layer} now={fixture.now} undoMs={0} sendRetries={0} />);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await userEvent.click(canvas.getByRole("button", { name: /^Choose 1:/ }));
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "not confirmed",
    );
    await waitFor(
      () =>
        expect(canvas.getByRole("alert")).toHaveTextContent(
          "original receipt was not confirmed",
        ),
      { timeout: 5000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(
      await canvas.findByRole("heading", { name: session.name }),
    ).toBeVisible();
    expect(fixture.writes).toHaveLength(1);
    expect(
      fixture
        .read()
        .history.filter((d) => d.decisionId === inbox.open[1].decisionId),
    ).toHaveLength(1);
  },
};
export const ExpiryClearsAnOpenDraft: Story = {
  play: async ({ mount, userEvent }) => {
    const fixture = createCardServices(inbox);
    const canvas = await mount(
      <CardApp layer={fixture.layer} now={fixture.now} undoMs={0} />,
    );
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Ask for changes" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "What should your agent change?" }),
      "Unsaved draft",
    );
    fixture.advance(24 * 60 * 60 * 1000);
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "Session expired" },
        { timeout: 5000 },
      ),
    ).toBeVisible();
    expect(canvas.queryByRole("textbox")).toBeNull();
    expect(canvas.queryByText("Unsaved draft")).toBeNull();
  },
};

export const KeyboardTray: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createCardServices(inbox),
      canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Send Maya the update/ }),
    );
    await expect(
      canvas.getByRole("dialog", { name: /Send Maya the update/ }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("dialog", { name: /Send Maya the update/ }),
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvas.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByRole("button", { name: /Send Maya the update/ }),
    ).toHaveFocus();
    expect(f.writes).toHaveLength(0);
  },
};


export const LongDetailRemainsReadable: Story = {
  play: async ({ mount, userEvent }) => {
    const detail = "Read this full explanation. ".repeat(40).slice(0, BODY_MAX_CHARACTERS - 12) + "END-SENTINEL";
    const decision = { ...updateQuestion, detail };
    const f = createCardServices(Schema.decodeUnknownSync(Inbox)({ session, open: [decision], history: [] }));
    const canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
    const read = async (text: string | RegExp) => {
      const dialog = await canvas.findByRole("dialog"),
        more = within(dialog).queryByRole("button", { name: "Show more" });
      // A long detail starts clamped; Show more opens all of it.
      if (more) await userEvent.click(more);
      const content = await within(dialog).findByText(text, {}, { timeout: 5000 });
      const scroller = content.closest(".ap-answer-scroll") as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(content);
      // The sheet scales in as it opens, so measure and scroll again until it settles.
      await waitFor(() => {
        const last = [...range.getClientRects()].at(-1)!;
        scroller.scrollTop += last.bottom - scroller.getBoundingClientRect().bottom + 8;
        const end = [...range.getClientRects()].at(-1)!, view = scroller.getBoundingClientRect();
        expect(end.top).toBeGreaterThanOrEqual(view.top - 1);
        expect(end.bottom).toBeLessThanOrEqual(Math.min(view.bottom, window.innerHeight) + 1);
      });
    };
    await userEvent.click(await canvas.findByRole("button", { name: new RegExp(decision.title) }));
    await expect(await canvas.findByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");
    await read(/END-SENTINEL$/);
    await expect(canvas.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    const choice = canvas.getByRole("button", { name: /^Choose 1:/ });
    choice.scrollIntoView({ block: "nearest" });
    expect(choice.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight);
    await userEvent.click(choice);
    expect(f.writes).toHaveLength(0);
    await userEvent.click(canvas.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(f.read().history).toHaveLength(1));
    // The sheet stays on the sent answer; close it to return to the queue.
    await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
    f.acknowledge(decision.decisionId, "EXACT AGENT ACKNOWLEDGEMENT");
    await userEvent.click(await canvas.findByRole("button", { name: new RegExp(decision.title) }));
    await read(/END-SENTINEL$/);
    await read("EXACT AGENT ACKNOWLEDGEMENT");
    expect(canvas.queryByRole("button", { name: "Send" })).toBeNull();
    expect(f.writes).toHaveLength(1);
  },
};

function longOptionStory(field: "title" | "detail"): Story {
  return {
    play: async ({ mount, userEvent }) => {
      const text = "x".repeat((field === "title" ? TEXT_MAX_CHARACTERS : TEXT_MAX_CHARACTERS) - 12) + "END-SENTINEL";
      const decision = { ...question, card: { ...question.card,
        options: question.card.options.map((option, index) => index === 0 ? { ...option, [field]: text } : option),
      } };
      const f = createCardServices(Schema.decodeUnknownSync(Inbox)({ session, open: [decision], history: [] }));
      const canvas = await mount(<CardApp layer={f.layer} now={f.now} undoMs={0} />);
      const read = async () => {
        const dialog = canvas.getByRole("dialog");
        if (field === "detail") {
          const choice = within(dialog).getByRole("button", { name: /^Choose 1:/ });
          if (choice.getAttribute("aria-pressed") !== "true") {
            expect(dialog.querySelector(".ap-option-detail")).toBeNull();
            await userEvent.click(choice);
          }
        }
        const options = dialog.querySelector<HTMLElement>(".ap-options")!;
        const content = options.querySelector<HTMLElement>(field === "title" ? "strong" : ".ap-option-detail")!;
        expect(content.textContent).toContain(text);
        expect(options.scrollWidth).toBeLessThanOrEqual(options.clientWidth + 1);
        const range = document.createRange();
        range.selectNodeContents(content);
        const bounds = options.getBoundingClientRect();
        for (const rect of range.getClientRects()) {
          expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
          expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
        }
        content.scrollIntoView({ block: "end" });
        const last = [...range.getClientRects()].at(-1)!;
        const view = dialog.querySelector(".ap-answer-scroll")!.getBoundingClientRect();
        expect(last.bottom).toBeLessThanOrEqual(Math.min(view.bottom, window.innerHeight) + 1);
        expect(last.top).toBeGreaterThanOrEqual(Math.max(view.top, 0) - 1);
      };
      await userEvent.click(await canvas.findByRole("button", { name: new RegExp(decision.title) }));
      await read();
      await userEvent.click(canvas.getByRole("button", { name: /^Choose 1:/ }));
      expect(f.writes).toHaveLength(0);
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(f.read().history).toHaveLength(1));
      // The sheet stays on the sent answer; close it to return to the queue.
      await userEvent.click(canvas.getByRole("button", { name: "Close decision" }));
      await userEvent.click(await canvas.findByRole("button", { name: new RegExp(decision.title) }));
      await read();
      expect(f.read().history[0].card).toEqual(decision.card);
    },
  };
}
export const LongOptionTitleRemainsReadable = longOptionStory("title");
export const LongOptionDetailRemainsReadable = longOptionStory("detail");
