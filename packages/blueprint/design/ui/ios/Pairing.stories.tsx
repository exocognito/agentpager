import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { CODE, codex } from "./fixtures.ts";
import { PairingSheet } from "./PairingSheet.tsx";
import { UNAVAILABLE, WORDS, pairedText, pairingHint } from "./words.ts";

const meta = {
  title: "iPhone/Pairing",
  component: PairingSheet,
  args: { name: codex.name, phase: "entering", entered: [null, null, null], focus: 0, triesLeft: 3, dark: false },
} satisfies Meta<typeof PairingSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

const [fox, cactus] = CODE;
const status = (canvas: { getByRole: (role: string) => HTMLElement }) => canvas.getByRole("status");

export const Start: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.pairTitle })).toBeVisible();
    await expect(canvas.getAllByRole("button", { name: /^Emoji \d: empty/ })).toHaveLength(3);
    await expect(canvas.getByRole("group", { name: WORDS.palette }).querySelectorAll("button")).toHaveLength(25);
    await expect(status(canvas)).toHaveTextContent(pairingHint());
    await expect(canvas.getByRole("button", { name: WORDS.pair })).toBeDisabled();
  },
};
// A phone-made link: the window started when the phone made it, so less of it is left once the agent joins.
export const PhoneMadeLink: Story = {
  name: "Phone-made link, 9 minutes left",
  args: { minutesLeft: 9 },
  play: async ({ canvas }) => {
    await expect(status(canvas)).toHaveTextContent("Pair within 9 minutes, or this pager ends.");
  },
};
export const TwoEntered: Story = { name: "2 of 3 entered", args: { entered: [fox, cactus, null], focus: 2 } };
export const Ready: Story = {
  name: "Ready to pair",
  args: { entered: [...CODE], focus: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: WORDS.pair })).toBeEnabled();
  },
};
export const Checking: Story = {
  args: { phase: "checking", entered: [...CODE], focus: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: WORDS.checking })).toBeDisabled();
  },
};
export const Wrong: Story = {
  name: "Wrong, 2 tries left",
  args: { phase: "wrong", entered: [fox, cactus, "🐢"], focus: null, triesLeft: 2 },
  play: async ({ canvas }) => {
    await expect(status(canvas)).toHaveTextContent("Those don’t match. 2 tries left.");
  },
};
export const LastTry: Story = {
  name: "Wrong, last try",
  args: { phase: "wrong", entered: [fox, "🐙", fox], focus: null, triesLeft: 1 },
  play: async ({ canvas }) => {
    await expect(status(canvas)).toHaveTextContent(WORDS.lastTry);
  },
};
// After a wrong code the first emoji tapped starts again; the pad then counts the tries left.
export const AfterWrong: Story = {
  name: "After a wrong code, 2 tries left",
  args: { entered: [fox, null, null], focus: 1, triesLeft: 2 },
  play: async ({ canvas }) => {
    await expect(status(canvas)).toHaveTextContent("2 tries left.");
  },
};
export const CouldntReachServer: Story = {
  name: "Couldn’t reach the server",
  args: { entered: [...CODE], focus: null, note: WORDS.pairOffline },
};
export const Failed: Story = {
  name: "Pairing failed",
  args: { phase: "failed", triesLeft: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: WORDS.pairingFailed })).toBeVisible();
    await expect(canvas.getByRole("button", { name: WORDS.connectAgain })).toBeVisible();
  },
};
export const Paired: Story = {
  args: { phase: "paired" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(pairedText(codex.name, "24h"))).toBeVisible();
  },
};
export const Loading: Story = { args: { phase: "loading" } };
export const WaitingForAgent: Story = {
  name: "Waiting for your agent",
  args: { phase: "unavailable", unavailable: "waiting" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: UNAVAILABLE.waiting[0] })).toBeVisible();
  },
};
// Opening the link of a pager that is already paired, and losing the race to another phone, say different things.
export const AlreadyPaired: Story = {
  name: "Already paired",
  args: { phase: "unavailable", unavailable: "alreadyPaired" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNAVAILABLE.alreadyPaired[1])).toBeVisible();
  },
};
export const AnotherPhonePaired: Story = { name: "Another phone paired", args: { phase: "unavailable", unavailable: "otherPhone" } };
export const LinkExpired: Story = { name: "Link expired", args: { phase: "unavailable", unavailable: "expired" } };
export const PagerEnded: Story = { name: "Pager ended", args: { phase: "unavailable", unavailable: "ended" } };
export const CantReachServer: Story = { name: "Can’t reach server", args: { phase: "unavailable", unavailable: "offline" } };
