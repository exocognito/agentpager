import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AgentScreen } from "./AgentScreen.tsx";
import { NOW, OPEN_AFTER_SEND, TIME_ZONE, answeredUpdate, claude, confirmedFirst, confirmedUpdate } from "./fixtures.ts";
import { WORDS, notPickedUp, sendingIn } from "./words.ts";

// Send closes the decision sheet. Its row moves to Answered and shows where the answer is: Undo for 5 seconds,
// then sending, then waiting for the agent, then a green tick beside the answer once the agent confirms. If no agent has
// read the answer 3 minutes after Send, the wait turns to a warning naming the agent and its computer (I6).
const meta = {
  title: "iPhone/After you answer",
  component: AgentScreen,
  args: { pager: { ...claude, openCount: 2 }, open: OPEN_AFTER_SEND, now: NOW, timeZone: TIME_ZONE, dark: false },
} satisfies Meta<typeof AgentScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

const row = (canvas: Parameters<NonNullable<Story["play"]>>[0]["canvas"]) => canvas.getByRole("button", { name: /Send Maya the update\?/ });

export const Undo: Story = {
  args: { answered: [answeredUpdate({ kind: "undo", seconds: 5 }), confirmedFirst], undoSeconds: 5 },
  play: async ({ canvas }) => {
    await expect(row(canvas)).toHaveTextContent(sendingIn(5));
    await expect(canvas.getByRole("status")).toHaveTextContent(sendingIn(5));
    await expect(canvas.getByRole("button", { name: WORDS.undo })).toBeVisible();
  },
};
export const Sending: Story = {
  args: { answered: [answeredUpdate({ kind: "sending" }), confirmedFirst] },
  play: async ({ canvas }) => {
    await expect(row(canvas)).toHaveTextContent(WORDS.sending);
  },
};
export const NotConfirmed: Story = {
  name: "Answer not confirmed",
  args: { answered: [answeredUpdate({ kind: "sending" }), confirmedFirst], overlay: "notConfirmed" },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole("alertdialog", { name: WORDS.notConfirmed });
    await expect(alert).toHaveTextContent(WORDS.notConfirmedText);
    await expect(within(alert).getByRole("button", { name: WORDS.retry })).toBeVisible();
  },
};
export const Waiting: Story = {
  name: "Waiting for your agent",
  args: { answered: [answeredUpdate({ kind: "waiting" }), confirmedFirst] },
  play: async ({ canvas }) => {
    await expect(row(canvas)).toHaveTextContent(WORDS.waitingForAgent);
  },
};
export const NotPickedUp: Story = {
  name: "Not picked up",
  args: { answered: [answeredUpdate({ kind: "notPickedUp", who: "Claude Code on air" }), confirmedFirst] },
  play: async ({ canvas }) => {
    await expect(row(canvas)).toHaveTextContent(notPickedUp("Claude Code on air"));
    await expect(row(canvas)).not.toHaveTextContent(WORDS.agentConfirmed);
  },
};
export const Confirmed: Story = {
  name: "Agent confirmed",
  args: { answered: [confirmedUpdate, confirmedFirst] },
  play: async ({ canvas }) => {
    await expect(within(row(canvas)).getByRole("img", { name: WORDS.agentConfirmed })).toBeVisible();
    await expect(row(canvas)).toHaveTextContent("Send at 9:00 tomorrow");
  },
};
