import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { MARKETING, MarketingScreen } from "./MarketingScreen.tsx";

const meta = {
  title: "v1/Front page",
  component: MarketingScreen,
} satisfies Meta<typeof MarketingScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FrontPage: Story = {
  args: { copyText: fn(async () => {}) },
  play: async ({ canvas, userEvent, args }) => {
    const rich = canvas.getByText(MARKETING.instruction);
    rich.scrollIntoView();
    await expect(rich).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Copy the agent instruction" }),
    );
    await expect(args.copyText).toHaveBeenCalledWith(MARKETING.instruction);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      MARKETING.copied,
    );
  },
};
export const Preview: Story = { args: { copyText: fn(async () => {}) } };
export const PreviewPhone: Story = {
  args: { copyText: fn(async () => {}) },
  globals: { viewport: { value: "phone" } },
};
