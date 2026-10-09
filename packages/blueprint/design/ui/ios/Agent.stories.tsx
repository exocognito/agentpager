import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AgentScreen } from "./AgentScreen.tsx";
import { NOW, OPEN, TIME_ZONE, claude, confirmedFirst, pi, research, trip, codex } from "./fixtures.ts";
import { END_REASON, WORDS, endConfirmTitle, endedText } from "./words.ts";

const meta = {
  title: "iPhone/Agent",
  component: AgentScreen,
  args: { pager: claude, open: OPEN, answered: [confirmedFirst], now: NOW, timeZone: TIME_ZONE, dark: false },
} satisfies Meta<typeof AgentScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Decisions: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(claude.name)).toBeVisible();
    await expect(canvas.getByText("Pager active · Ends in 24h")).toBeVisible();
    await expect(canvas.getByRole("heading", { name: WORDS.open })).toBeVisible();
    const answered = canvas.getByRole("button", { name: /Which should I do first\?/ });
    await expect(within(answered).getByRole("img", { name: WORDS.agentConfirmed })).toBeVisible();
    await expect(answered).toHaveTextContent("Run the tests");
  },
};
// Cards wait on the service until the phone pairs, so a new pager can already have decisions; this one has none.
export const NoDecisionsYet: Story = {
  name: "No decisions yet",
  args: { open: [], answered: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.noDecisions)).toBeVisible();
  },
};
// The ⋯ menu's title is the exact end time; Ends changes it, counted from now.
export const Menu: Story = {
  name: "⋯ menu",
  args: { overlay: "menu" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Pager ends Sep 30 at 6:00 AM")).toBeVisible();
    await expect(canvas.getByRole("menuitem", { name: /Ends/ })).toHaveTextContent("in 24h");
    await expect(canvas.getByRole("menuitem", { name: WORDS.endPager })).toBeVisible();
  },
};
export const EndsMenu: Story = {
  name: "⋯ menu, Ends",
  args: { overlay: "endsMenu" },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("menuitemradio").map((i) => i.textContent)).toEqual(["24 Hours", "7 Days", "30 Days"]);
  },
};
export const EndConfirm: Story = {
  name: "End pager?",
  args: { overlay: "endConfirm" },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole("dialog", { name: endConfirmTitle(claude.name) });
    await expect(dialog).toHaveTextContent(WORDS.endConfirmText);
    await expect(within(dialog).getByRole("button", { name: WORDS.endPager })).toBeVisible();
  },
};
// However a pager ends, its decisions are gone and the screen says why.
export const EndedAgentFinished: Story = {
  name: "Ended: agent finished",
  args: { pager: pi },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.ended })).toBeVisible();
    await expect(canvas.getByText(END_REASON.agentFinished)).toBeVisible();
    await expect(canvas.getByText(endedText(pi.name))).toBeVisible();
    await expect(canvas.queryByRole("button", { name: WORDS.more })).toBeNull();
  },
};
export const EndedTimedOut: Story = { name: "Ended: timed out", args: { pager: trip } };
export const EndedByYou: Story = { name: "Ended: you ended it", args: { pager: research } };
export const EndedPairingFailed: Story = { name: "Ended: pairing failed", args: { pager: { ...codex, status: "ended", endedAt: NOW, endReason: "pairingFailed" } } };
