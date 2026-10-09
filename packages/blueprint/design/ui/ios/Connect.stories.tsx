import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { ConnectSheet } from "./ConnectSheet.tsx";
import { LINK, SERVER } from "./fixtures.ts";
import { LIFETIME, WORDS, cantReachAt } from "./words.ts";

const meta = {
  title: "iPhone/Connect an Agent",
  component: ConnectSheet,
  args: { link: LINK, lifetime: "24h", dark: false },
} satisfies Meta<typeof ConnectSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LinkReady: Story = {
  name: "Link ready",
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: WORDS.qrLabel })).toBeVisible();
    await expect(canvas.getByText(LINK)).toBeVisible();
    await expect(canvas.getByRole("button", { name: new RegExp(WORDS.pagerEndsAfter) })).toHaveTextContent(LIFETIME["24h"].label);
    await expect(canvas.getByText(LIFETIME["24h"].note)).toBeVisible();
  },
};
// The lifetime counts from when the agent connects: 24 hours, 7 days or 30 days.
export const LifetimeMenu: Story = {
  name: "Lifetime menu",
  args: { menuOpen: true },
  play: async ({ canvas }) => {
    const items = canvas.getAllByRole("menuitemradio");
    await expect(items.map((i) => i.textContent)).toEqual(["24 Hours", "7 Days", "30 Days"]);
    await expect(items[0]).toHaveAttribute("aria-checked", "true");
  },
};
export const Copied: Story = { args: { copied: true } };
export const MakingLink: Story = {
  name: "Making a link",
  args: { link: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.makingLink)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.copy })).toBeDisabled();
  },
};
export const CantMakeLink: Story = {
  name: "Can’t make a link",
  args: { link: undefined, error: cantReachAt(SERVER) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(cantReachAt(SERVER))).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.tryAgain })).toBeVisible();
  },
};
