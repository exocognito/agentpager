import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { PAGER_NUMBER, SERVER } from "./fixtures.ts";
import { ServerForm, SettingsSheet } from "./SettingsSheet.tsx";
import { WORDS, cantReachAt, serverNow } from "./words.ts";

const meta = {
  title: "iPhone/Settings",
  component: SettingsSheet,
  args: { number: PAGER_NUMBER, server: SERVER, status: WORDS.updatedJustNow, dark: false },
} satisfies Meta<typeof SettingsSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PagerNumber: Story = {
  name: "Pager number",
  play: async ({ canvas }) => {
    await expect(canvas.getByText(PAGER_NUMBER)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.copyForAgents })).toBeEnabled();
    await expect(canvas.getByText(WORDS.numberFooter)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Server/ })).toHaveTextContent("192.168.1.10");
    await expect(canvas.getByText(serverNow(WORDS.updatedJustNow))).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.changeNumber })).toBeEnabled();
  },
};
export const Copied: Story = { args: { copied: true } };
export const MakingNumber: Story = {
  name: "Making a number",
  args: { number: undefined, making: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.makingNumber)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.copyForAgents })).toBeDisabled();
  },
};
export const CantMakeNumber: Story = {
  name: "Can’t make a number",
  args: { number: undefined, error: cantReachAt(SERVER), status: WORDS.cantReach },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.noNumber)).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.tryAgain })).toBeVisible();
  },
};
export const ChangeNumber: Story = {
  name: "Change pager number?",
  args: { confirmChange: true },
  play: async ({ canvas }) => {
    const dialog = canvas.getByRole("dialog", { name: WORDS.changeNumberTitle });
    await expect(dialog).toHaveTextContent(WORDS.changeNumberText);
    await expect(within(dialog).getByRole("button", { name: WORDS.changeNumberConfirm })).toBeVisible();
  },
};
export const Server: Story = {
  render: (args) => <ServerForm value={args.server} dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("textbox", { name: WORDS.serverHeader })).toHaveValue(SERVER);
    await expect(canvas.getByText(WORDS.serverFooter)).toBeVisible();
  },
};
export const ServerInvalid: Story = {
  name: "Server, not an address",
  render: (args) => <ServerForm value="192.168.1.10" invalid dark={args.dark} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText(WORDS.serverInvalid)).toBeVisible();
  },
};
