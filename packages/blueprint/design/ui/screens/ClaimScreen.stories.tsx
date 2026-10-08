import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CLAIM, ClaimScreen } from "./ClaimScreen.tsx";
import { ROUTES } from "../../effects/session.ts";

const meta = { title: "v1/Claim", component: ClaimScreen, args: { status: "claiming" } } satisfies Meta<typeof ClaimScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Claiming: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(CLAIM.claiming);
  },
};
export const Refused: Story = {
  args: { status: "refused" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: CLAIM.refused[0] })).toBeVisible();
    await expect(canvas.getByRole("link", { name: CLAIM.home })).toHaveAttribute("href", ROUTES.homeApp.path);
  },
};
export const Over: Story = {
  args: { status: "over" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: CLAIM.over[0] })).toBeVisible();
    await expect(canvas.getByRole("link", { name: CLAIM.home })).toHaveAttribute("href", ROUTES.homeApp.path);
  },
};
export const Offline: Story = {
  args: { status: "offline" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: CLAIM.offline[0] })).toBeVisible();
  },
};
