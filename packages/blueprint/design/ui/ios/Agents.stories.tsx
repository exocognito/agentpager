import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AgentsScreen } from "./AgentsScreen.tsx";
import { AGENTS, NOW, claude, codex, pi } from "./fixtures.ts";
import { WORDS, subtitle } from "./words.ts";

const meta = {
  title: "iPhone/Agents",
  component: AgentsScreen,
  args: { agents: AGENTS, now: NOW, dark: false },
} satisfies Meta<typeof AgentsScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

// Active pagers first, with their open decisions counted; one not paired yet says how long pairing stays open.
export const ActiveAndEnded: Story = {
  name: "Active and ended",
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1, name: WORDS.agents })).toBeVisible();
    await expect(canvas.getByRole("button", { name: new RegExp(claude.name) })).toHaveTextContent(`${subtitle(claude, NOW)}3`);
    await expect(canvas.getByRole("button", { name: new RegExp(codex.name) })).toHaveTextContent("Pager not paired · Ends in 14m");
    await expect(canvas.getByRole("button", { name: new RegExp(pi.name) })).toHaveTextContent("Pager ended · 40m ago");
    await expect(canvas.getByRole("status")).toHaveTextContent(WORDS.updatedJustNow);
    await expect(canvas.getByRole("button", { name: WORDS.settings })).toBeVisible();
  },
};
export const Empty: Story = {
  args: { agents: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.noAgents })).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.connectAgent })).toBeVisible();
    await expect(canvas.queryByRole("status")).toBeNull();
  },
};
export const CantReachServer: Story = {
  name: "Can’t reach server",
  args: { status: WORDS.cantReach },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(WORDS.cantReach);
  },
};
