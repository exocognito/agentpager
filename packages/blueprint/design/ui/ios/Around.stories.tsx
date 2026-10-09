import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { AgentTerminal, LinkPage } from "./WebAndAgent.tsx";
import { WORDS } from "./words.ts";

// Around the app: the page an AgentPager link opens on a phone, and what an agent shows its owner.
const meta = {
  title: "iPhone/Around the app",
  component: LinkPage,
  args: { dark: false },
} satisfies Meta<typeof LinkPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LinkPageStory: Story = {
  name: "Link page",
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.linkPageTitle })).toBeVisible();
    await expect(canvas.getByRole("link", { name: WORDS.openInApp })).toHaveAttribute("href", expect.stringMatching(/^agentpager:\/\/start\//));
    await expect(canvas.getByText(WORDS.areYouAnAgent)).toBeVisible();
  },
};
export const AgentShowsCode: Story = {
  name: "What your agent shows",
  render: () => <AgentTerminal />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("(1. fox    2. cactus    3. fox)", { normalizer: (text) => text })).toBeVisible();
    await expect(canvas.getByText("3 tries. Pair within 15 minutes, or this pager ends.")).toBeVisible();
  },
};
