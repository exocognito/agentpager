import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { createActor } from "xstate";
import {
  createCardMachine,
  type CardContext,
  type CardSnapshot,
} from "../../machines/cards.ts";
import { createCardServices } from "../fixtures/services.ts";
import { inbox, question, answered, feedbackDecision, pairingInbox, pairingDecision, pairedInbox, pairedDecision, updateQuestion, pairingTarget } from "../fixtures/decisions.ts";
import { CardScreen } from "./CardScreen.tsx";
import { optionDetail, optionMark } from "../components/cards/schemas.ts";

const services = createCardServices(inbox);
const machine = createCardMachine(services.layer, services.now);
const initial = createActor(machine).getSnapshot().context;
function ScreenState({
  value,
  patch = {},
}: {
  value: CardSnapshot["value"];
  patch?: Partial<CardContext>;
}) {
  const snapshot = machine.resolveState({
    value,
    context: {
      ...initial,
      inbox,
      viewing: question.decisionId,
      choice: { kind: "option", number: 1 },
      requestId: "r".repeat(32),
      pending: {
        requestId: "r".repeat(32),
        choice: { kind: "option", number: 1 },
      },
      ...patch,
    },
  });
  return <CardScreen snapshot={snapshot} send={fn()} />;
}
const meta = {
  title: "v1/Session/States",
  component: ScreenState,
  args: { value: { live: { screen: "queue", clock: "counting" } } },
} satisfies Meta<typeof ScreenState>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {
  args: { value: "loading", patch: { inbox: null, viewing: null } },
  tags: ["state:cards.loading"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Loading your decisions",
    );
  },
};
export const LoadFailed: Story = {
  args: { value: "failed", patch: { inbox: null, viewing: null } },
  tags: ["state:cards.failed"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Could not load your decisions" }),
    ).toBeVisible();
  },
};
export const Queue: Story = {
  args: { value: { live: { screen: "queue", clock: "counting" } }, patch: { viewing: null } },
  tags: ["state:cards.live.screen.queue", "state:cards.live.clock.counting"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: inbox.session.name! }),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "All sessions" })).toHaveAttribute("href", "/app");
  },
};
// Each row's mark: empty while open; the chosen option's emoji once answered; a speech bubble for asked changes.
export const RowMarks: Story = {
  args: { patch: { viewing: null, inbox: { ...inbox, open: [question], history: [feedbackDecision, answered, pairedDecision] } } },
  play: async ({ canvasElement }) => {
    const marks = [...canvasElement.querySelectorAll(".ap-mark")];
    await expect(marks.map((m) => m.className)).toEqual(["ap-mark ap-mark-open", "ap-mark", "ap-mark", "ap-mark"]);
    const emoji = (d: typeof answered) => { const o = d.card.options.find((o) => d.answer?.choice.kind === "option" && o.number === d.answer.choice.number)!; return optionMark(o); };
    await expect(marks[1].querySelector("svg")).not.toBeNull();
    await expect(marks.slice(2).map((m) => m.textContent)).toEqual([emoji(answered), emoji(pairedDecision)]);
  },
};
export const Viewing: Story = {
  args: { value: { live: { screen: "view", clock: "counting" } }, patch: { choice: null, pending: null } },
  tags: ["state:cards.live.screen.view"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: question.title }),
    ).toBeVisible();
    // The agent's pick shows under the question, but nothing starts chosen.
    await expect(canvas.getByText(/^Recommended:/)).toHaveTextContent(question.card.options[0].title);
    for (const option of canvas.getAllByRole("button", { name: /^Choose / })) await expect(option).toHaveAttribute("aria-pressed", "false");
  },
};
// Choosing an option shows its detail under it; the other options show only their titles.
export const Chosen: Story = {
  args: { value: { live: { screen: "view", clock: "counting" } }, patch: { choice: { kind: "option", number: 1 } } },
  play: async ({ canvas }) => {
    const [first, ...rest] = question.card.options;
    await expect(canvas.getByRole("button", { name: /^Choose 1:/ })).toHaveAccessibleDescription(optionDetail(first)!);
    await expect(canvas.getByText(optionDetail(first)!)).toBeVisible();
    for (const option of rest) expect(canvas.queryByText(optionDetail(option)!)).toBeNull();
  },
};
// A long question detail starts at four lines with Show more.
const longDetail = { ...question, detail: "Maya’s team can start this week, and they have asked twice already. " + "The reliability work matters too: two incidents last month came from the same retry path, and the fix touches the queue, the worker and the alerts. ".repeat(4) };
export const LongDetail: Story = {
  args: { value: { live: { screen: "view", clock: "counting" } }, patch: { inbox: { ...inbox, open: inbox.open.map((d) => (d.decisionId === question.decisionId ? longDetail : d)) }, choice: null, pending: null } },
  play: async ({ canvas, userEvent }) => {
    const more = canvas.getByRole("button", { name: "Show more" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    await expect(canvas.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Show less" }));
  },
};
// Send opens the Undo window: the answer shows, and nothing has gone yet.
export const Undoing: Story = {
  args: { value: { live: { screen: "undoing", clock: "counting" } } },
  tags: ["state:cards.live.screen.undoing"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /^Undo · \ds$/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Cancel and close" })).toBeEnabled();
    expect(canvas.queryByRole("group", { name: "Choices" })).toBeNull();
  },
};
export const Sending: Story = {
  args: { value: { live: { screen: "sending", clock: "counting" } } },
  tags: ["state:cards.live.screen.sending"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog")).toHaveTextContent("Sending…");
    await expect(canvas.getByRole("button", { name: "Close decision" })).toBeDisabled();
  },
};
// Stored: the card stays open on its answer until the agent confirms it.
export const Sent: Story = {
  args: { value: { live: { screen: "sent", clock: "counting" } } },
  tags: ["state:cards.live.screen.sent"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog")).toHaveTextContent("Waiting for your agent");
    expect(canvas.queryByRole("group", { name: "Choices" })).toBeNull();
    expect(canvas.queryByRole("button", { name: "Close" })).toBeNull();
  },
};
export const SentConfirmed: Story = {
  args: { value: { live: { screen: "sent", clock: "counting" } }, patch: { viewing: answered.decisionId, choice: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Your agent confirmed", { selector: ".ap-ack .ap-confirmed" })).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Your agent confirmed");
    await expect(canvas.getByText(answered.acknowledgement!.nextSteps)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Close" })).toBeVisible();
  },
};
export const SendingKeepsKeyboardFocus: Story = {
  args: { value: { live: { screen: "sending", clock: "counting" } } },
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole("dialog");
    const scroller = dialog.querySelector<HTMLElement>(".ap-card-scroll, .ap-answer-scroll")!;
    scroller.focus();
    for (let i = 0; i < 3; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await expect(dialog).toHaveTextContent("Sending…");
  },
};
export const SendFailed: Story = {
  args: { value: { live: { screen: "sendFailed", clock: "counting" } }, patch: { error: "Unreachable" } },
  tags: ["state:cards.live.screen.sendFailed"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("not confirmed");
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
  },
};
export const AnswerConflict: Story = {
  args: { value: { live: { screen: "sent", clock: "counting" } }, patch: { viewing: answered.decisionId, choice: null, pending: null, error: "AlreadyAnswered" } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("This decision already has an answer");
    await expect(canvas.getByText(answered.acknowledgement!.nextSteps)).toBeVisible();
  },
};
export const ConfirmEnd: Story = {
  args: { value: { live: { screen: "confirmEnd", clock: "counting" } }, patch: { viewing: null } },
  tags: ["state:cards.live.screen.confirmEnd"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "End this session?" }),
    ).toBeVisible();
  },
};
export const Ending: Story = {
  args: { value: { live: { screen: "ending", clock: "counting" } }, patch: { viewing: null } },
  tags: ["state:cards.live.screen.ending"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Ending…" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Keep session" })).toBeDisabled();
    await expect(canvas.getByRole("dialog")).toHaveFocus();
    await expect(canvas.getByRole("button", { name: "Close overlay", hidden: true })).toBeDisabled();
  },
};
export const EndFailed: Story = {
  args: {
    value: { live: { screen: "confirmEnd", clock: "counting" } },
    patch: { viewing: null, error: "Unreachable" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Ending was not confirmed",
    );
  },
};
export const Expired: Story = {
  args: {
    value: "expired",
    patch: { inbox: null, viewing: null, pending: null },
  },
  tags: ["state:cards.expired"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Session expired" }),
    ).toBeVisible();
  },
};
export const Ended: Story = {
  args: {
    value: "ended",
    patch: { inbox: null, viewing: null, pending: null, endedBy: "agent" },
  },
  tags: ["state:cards.ended"],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Session ended" }),
    ).toBeVisible();
  },
};
export const StoredAnswerAfterLostReceipt: Story = {
  args: {
    value: { live: { screen: "sendFailed", clock: "counting" } },
    patch: {
      viewing: answered.decisionId,
      pending: {
        requestId: "r".repeat(32),
        choice: { kind: "option", number: 1 },
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "original receipt was not confirmed",
    );
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
  },
};
export const Pairing: Story = {
  args: {
    value: { live: { screen: "view", clock: "unpaired" } },
    patch: { inbox: pairingInbox, viewing: pairingDecision.decisionId, choice: null, pending: null },
  },
  tags: ["state:cards.live.clock.unpaired"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: pairingDecision.title })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(canvas.queryByRole("button", { name: "Ask for changes" })).toBeNull();
    expect(canvas.queryByText(/Session expires/)).toBeNull();
  },
};
export const PairingRejected: Story = {
  args: {
    value: { live: { screen: "view", clock: "unpaired" } },
    patch: { inbox: pairingInbox, viewing: pairingDecision.decisionId, choice: null, pending: null, error: "InvalidInput" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent("Nothing was sent");
    await expect(canvas.getByRole("button", { name: "Send" })).toBeDisabled();
    for (const option of canvas.getAllByRole("button", { name: /^Choose / })) await expect(option).toBeEnabled();
  },
};
// The pairing card from Send to Close: the same card throughout, nothing else on screen.
const pairingSent = { inbox: pairingInbox, viewing: pairingDecision.decisionId, choice: { kind: "option" as const, number: pairingTarget }, pending: { requestId: "r".repeat(32), choice: { kind: "option" as const, number: pairingTarget } } };
export const PairingUndoing: Story = {
  args: { value: { live: { screen: "undoing", clock: "unpaired" } }, patch: pairingSent },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: pairingDecision.title })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Undo · \ds$/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Cancel and close" })).toBeEnabled();
  },
};
export const PairingSending: Story = {
  args: { value: { live: { screen: "sending", clock: "unpaired" } }, patch: pairingSent },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: pairingDecision.title })).toHaveTextContent("Sending…");
    expect(canvas.queryByRole("group", { name: "Choices" })).toBeNull();
  },
};
export const PairingDeadlineVerification: Story = {
  args: { value: { live: { screen: "sending", clock: "verifying" } }, patch: pairingSent },
  tags: ["state:cards.live.clock.verifying"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: pairingDecision.title })).toHaveTextContent("Sending…");
    expect(canvas.queryByText("Session expired")).toBeNull();
  },
};
export const PairingConfirmed: Story = {
  args: { value: { live: { screen: "sent", clock: "counting" } }, patch: { inbox: pairedInbox, viewing: pairedDecision.decisionId, choice: null, pending: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Your agent confirmed", { selector: ".ap-ack .ap-confirmed" })).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("Your agent confirmed");
    await expect(canvas.getByText("Paired. Ready for decisions.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Close" })).toBeVisible();
    expect(canvas.queryByRole("group", { name: "Choices" })).toBeNull();
  },
};
export const History: Story = {
  args: { value: { live: { screen: "view", clock: "counting" } }, patch: { viewing: answered.decisionId, choice: null, pending: null } },
  play: async ({ canvas }) => {
    for (const option of canvas.getAllByRole("button", { name: /^Choose / })) await expect(option).toBeDisabled();
    await expect(canvas.getByText(answered.acknowledgement!.nextSteps)).toBeVisible();
    expect(canvas.queryByRole("button", { name: "Send" })).toBeNull();
  },
};
// The happy path answers the second card first.
export const SecondCardOpen: Story = {
  args: {
    value: { live: { screen: "view", clock: "counting" } },
    patch: { inbox: { ...inbox, open: [question, updateQuestion] }, viewing: updateQuestion.decisionId, choice: { kind: "option", number: 2 }, pending: null },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: updateQuestion.title })).toBeVisible();
    await expect(canvas.getByRole("button", { name: /^Choose 2:/ })).toHaveAttribute("aria-pressed", "true");
  },
};
export const TwoOpenCards: Story = {
  args: {
    value: { live: { screen: "queue", clock: "counting" } },
    patch: { inbox: { ...inbox, open: [question, updateQuestion] }, viewing: null, choice: null, pending: null },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("2 waiting")).toBeVisible();
  },
};
// The agent finished: the whole session stays readable, and nothing more can be answered.
const finishedInbox = { ...inbox, session: { ...inbox.session, finishedAt: inbox.session.pairedAt } };
export const Finished: Story = {
  args: { value: { live: { screen: "queue", clock: "counting" } }, patch: { inbox: finishedInbox, viewing: null, choice: null, pending: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Your agent finished this session/)).toBeVisible();
  },
};
export const FinishedCard: Story = {
  args: { value: { live: { screen: "view", clock: "counting" } }, patch: { inbox: finishedInbox, choice: null, pending: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/This card can no longer be answered/)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Send" })).toBeNull();
  },
};
