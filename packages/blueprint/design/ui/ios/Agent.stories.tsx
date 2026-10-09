import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { AgentScreen } from "./AgentScreen.tsx";
import { NOW, OPEN, TIME_ZONE, claude, codex, confirmedFirst, merge, pi, research, trip } from "./fixtures.ts";
import { END_REASON, WORDS, endConfirmTitle, removedIn } from "./words.ts";

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
// However a pager ends, the screen says why. The phone keeps its own read-only copy of the decisions for 24 hours
// after the end: unanswered ones can't be opened to answer, answered ones still open as threads.
export const EndedAgentFinished: Story = {
  name: "Ended: agent finished",
  args: { pager: pi, open: [merge], answered: [confirmedFirst] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.ended)).toBeVisible();
    await expect(canvas.getByText(END_REASON.agentFinished)).toBeVisible();
    await expect(canvas.getByText(removedIn("23h"))).toBeVisible();
    await expect(canvas.getByRole("heading", { name: WORDS.notAnswered })).toBeVisible();
    await expect(canvas.getByText(merge.title)).toBeVisible();
    await expect(canvas.queryByRole("button", { name: new RegExp(merge.title.replace("?", "\\?")) })).toBeNull();
    await expect(canvas.getByRole("button", { name: /Which should I do first\?/ })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: WORDS.more })).toBeNull();
  },
};
export const EndedTimedOut: Story = {
  name: "Ended: timed out, nothing kept",
  args: { pager: trip, open: [], answered: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.noDecisionsOnPhone)).toBeVisible();
    await expect(canvas.getByText(removedIn("19h"))).toBeVisible();
  },
};
export const EndedByYou: Story = { name: "Ended: you ended it", args: { pager: research, open: [], answered: [confirmedFirst] } };
export const EndedPairingFailed: Story = { name: "Ended: pairing failed", args: { pager: { ...codex, status: "ended", endedAt: NOW, endReason: "pairingFailed" }, open: [], answered: [] } };
