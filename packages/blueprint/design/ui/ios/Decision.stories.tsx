import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AskChangesSheet, DecisionSheet, ThreadSheet } from "./DecisionSheet.tsx";
import { TIME_ZONE, claude, confirmedUpdate, feedbackUpdate, answeredUpdate, update } from "./fixtures.ts";
import { WORDS, agentConfirmedAt, youAt } from "./words.ts";

const meta = {
  title: "iPhone/Decision",
  component: DecisionSheet,
  args: { agent: claude.name, decision: update, dark: false },
} satisfies Meta<typeof DecisionSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OptionChosen: Story = {
  name: "Option chosen",
  args: { selection: 2 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: update.title })).toBeVisible();
    await expect(canvas.getByText(WORDS.recommended)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Send at 9:00 tomorrow/ })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: WORDS.send })).toBeEnabled();
  },
};
export const NothingChosen: Story = {
  name: "Nothing chosen yet",
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: WORDS.send })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: WORDS.askForChanges })).toBeVisible();
  },
};
// The agent's pager ended, or the decision was cleared, while the sheet was open.
export const Cleared: Story = {
  name: "Decision cleared",
  args: { decision: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.decisionCleared })).toBeVisible();
  },
};

// The two other sheets a decision opens, drawn here so each still shows beside the decision it belongs to.
export const AskForChanges: Story = {
  name: "Ask for Changes",
  render: (args) => <AskChangesSheet decision={update} text="Please make it shorter." dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: WORDS.changesHeader })).toHaveValue("Please make it shorter.");
    await expect(canvas.getByText(WORDS.changesFooter)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.send })).toBeEnabled();
  },
};
export const AskForChangesWithHtml: Story = {
  name: "Ask for Changes, HTML left out",
  render: (args) => <AskChangesSheet decision={update} text="Put the date in <b>bold</b>." dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.changesHtml)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.send })).toBeDisabled();
  },
};
export const ThreadConfirmed: Story = {
  name: "Answered: agent confirmed",
  render: (args) => <ThreadSheet agent={claude.name} answered={confirmedUpdate} timeZone={TIME_ZONE} dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("🌅 Send at 9:00 tomorrow")).toBeVisible();
    await expect(canvas.getByText(youAt("5:59 AM"))).toBeVisible();
    await expect(canvas.getByText("Sending it at 9:00 tomorrow.")).toBeVisible();
    await expect(canvas.getByText(agentConfirmedAt("6:00 AM"))).toBeVisible();
  },
};
export const ThreadWaiting: Story = {
  name: "Answered: waiting for your agent",
  render: (args) => <ThreadSheet agent={claude.name} answered={answeredUpdate({ kind: "waiting" })} timeZone={TIME_ZONE} dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.waitingForAgent)).toBeVisible();
  },
};
export const ThreadFeedback: Story = {
  name: "Answered with a note",
  render: (args) => <ThreadSheet agent={claude.name} answered={feedbackUpdate} timeZone={TIME_ZONE} dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Please make it shorter.")).toBeVisible();
  },
};
