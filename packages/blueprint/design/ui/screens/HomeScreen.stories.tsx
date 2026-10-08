import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { createActor } from "xstate";
import { createHomeMachine, type HomeContext, type HomeSnapshot } from "../../machines/home.ts";
import { connectIds, connectIdsInTurn, createHomeServices, endedRow, expiredRow, finishedRow, joinedRow, liveRow, unpairedRow } from "../fixtures/home.ts";
import { HOME, HomeApp, HomeScreen } from "./HomeScreen.tsx";
import { connectUrl } from "./StartScreen.tsx";
import { PHONE_POLL_MS } from "../../schemas/exchange.ts";

const services = createHomeServices([liveRow]);
const machine = createHomeMachine(services.layer);
const initial = createActor(machine).getSnapshot().context;
function HomeState({ value, patch = {}, copyText }: { value: HomeSnapshot["value"]; patch?: Partial<HomeContext>; copyText?: (text: string) => Promise<void> }) {
  const snapshot = machine.resolveState({ value, context: { ...initial, sessions: [liveRow], ...patch } });
  return <HomeScreen snapshot={snapshot} send={fn()} now={services.now()} copyText={copyText} />;
}
const meta = {
  title: "v1/Home",
  component: HomeState,
  args: { value: { list: "browse" } },
} satisfies Meta<typeof HomeState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { value: "loading", patch: { sessions: null } },
  tags: ["state:home.loading"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading your sessions");
  },
};
export const LoadFailed: Story = {
  args: { value: "failed", patch: { sessions: null, error: "Unreachable" } },
  tags: ["state:home.failed"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: HOME.failed })).toBeVisible();
  },
};
// The usual home: the one session this phone holds, under the brand bar, with + to connect another agent.
export const OneSession: Story = {
  tags: ["state:home.list.browse"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: HOME.brand })).toBeVisible();
    const link = canvas.getByRole("link", { name: new RegExp(liveRow.name!) });
    await expect(link).toHaveAttribute("href", `/s/${liveRow.sessionId}`);
    await expect(link).toHaveTextContent(`${liveRow.openCount} open`);
    await expect(canvas.getByRole("button", { name: HOME.connect })).toBeVisible();
    expect(canvas.queryByRole("heading", { name: HOME.ended })).toBeNull();
  },
};
export const ActiveAndEnded: Story = {
  args: { patch: { sessions: [unpairedRow, liveRow, finishedRow, endedRow, expiredRow] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: HOME.active })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: HOME.ended })).toBeVisible();
    await expect(canvas.getByRole("link", { name: new RegExp(unpairedRow.name!) })).toHaveTextContent(HOME.unpaired);
    await expect(canvas.getByRole("link", { name: new RegExp(finishedRow.name!) })).toHaveTextContent(HOME.finished);
    const ended = canvas.getByRole("heading", { name: HOME.ended }).closest("section")!;
    for (const row of [endedRow, expiredRow]) await expect(within(ended).getByRole("button", { name: new RegExp(row.name!) })).toHaveTextContent(new RegExp(`^${row.name}\\w{3} \\d+$`));
  },
};
export const Empty: Story = {
  args: { patch: { sessions: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(HOME.empty)).toBeVisible();
  },
};
export const Stale: Story = {
  args: { patch: { stale: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(HOME.stale);
    await expect(canvas.getByRole("link", { name: new RegExp(liveRow.name!) })).toBeVisible();
  },
};
const connecting = { list: { connect: "listening" } } as const;
// The sheet shows what to do with an agent's QR code, and the link to give an agent instead.
export const Connect: Story = {
  args: { value: connecting, patch: { connectId: connectIds[0] } },
  tags: ["state:home.list.connect.listening"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: HOME.connect })).toBeVisible();
    await expect(canvas.getByText(HOME.scan)).toBeVisible();
    await expect(canvas.getByText(connectUrl(connectIds[0]))).toBeVisible();
    await expect(canvas.getByRole("button", { name: HOME.copy })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: HOME.close })).toBeVisible();
    expect(canvas.queryByRole("alert")).toBeNull();
  },
};
// Before the first id is registered there is no link to give or copy.
export const ConnectMaking: Story = {
  args: { value: connecting },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(HOME.making)).toBeVisible();
    await expect(canvas.getByRole("button", { name: HOME.copy })).toBeDisabled();
  },
};
export const ConnectOffline: Story = {
  args: { value: connecting, patch: { connectId: connectIds[0], offline: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveTextContent(HOME.offline);
  },
};
export const CopyRefused: Story = {
  args: { value: connecting, patch: { connectId: connectIds[0] }, copyText: fn(async () => { throw new Error("denied"); }) },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: HOME.copy }));
    await expect(window.getSelection()?.toString()).toBe(connectUrl(connectIds[0]));
    await expect(canvas.getByRole("status")).toHaveTextContent("");
    await expect(canvas.getByRole("button", { name: HOME.copy })).toBeVisible();
  },
};
// An agent joined: HomeApp opens its pairing card at /s/:id, and the sheet stays only until that page loads.
export const ConnectOpening: Story = {
  args: { value: { list: { connect: "opening" } }, patch: { connectId: connectIds[0], sessions: [joinedRow, liveRow], joined: joinedRow } },
  tags: ["state:home.list.connect.opening"],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("dialog", { name: HOME.connect })).toBeVisible();
  },
};
// Focus starts on the title; Shift+Tab stays inside the sheet.
export const ConnectKeepsFocus: Story = {
  args: { value: connecting, patch: { connectId: connectIds[0] } },
  play: async ({ canvas, userEvent }) => {
    const dialog = canvas.getByRole("dialog", { name: HOME.connect });
    await waitFor(() => expect(canvas.getByRole("heading", { name: HOME.connect })).toHaveFocus());
    await userEvent.tab({ shift: true });
    await expect(dialog.contains(document.activeElement)).toBe(true);
  },
};

// The real machine against in-memory rows: + registers a connect id, Copy copies it, X closes, and an agent joining
// with it opens that session's pairing card.
export const ConnectAnAgent: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createHomeServices([liveRow]),
      copyText = fn(async () => {}),
      open = fn(),
      canvas = await mount(<HomeApp layer={f.layer} now={f.now} copyText={copyText} makeId={connectIdsInTurn()} open={open} />);
    await userEvent.click(await canvas.findByRole("button", { name: HOME.connect }));
    await userEvent.click(canvas.getByRole("button", { name: HOME.close }));
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await userEvent.click(canvas.getByRole("button", { name: HOME.connect }));
    await userEvent.click(await canvas.findByRole("button", { name: HOME.copy }));
    await expect(copyText).toHaveBeenCalledWith(connectUrl(connectIds[1]));
    await expect(canvas.getByRole("button", { name: HOME.copied })).toBeVisible();
    f.join();
    await waitFor(() => expect(open).toHaveBeenCalledWith(`/s/${joinedRow.sessionId}`), { timeout: 5000 });
    await expect(open).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByRole("link", { name: new RegExp(joinedRow.name) })).toHaveTextContent(HOME.unpaired);
  },
};
// The sheet registers one id and keeps showing it.
export const ConnectKeepsOneLink: Story = {
  play: async ({ mount, userEvent }) => {
    const f = createHomeServices([liveRow]),
      canvas = await mount(<HomeApp layer={f.layer} now={f.now} makeId={connectIdsInTurn()} />);
    await userEvent.click(await canvas.findByRole("button", { name: HOME.connect }));
    await expect(await canvas.findByText(connectUrl(connectIds[0]))).toBeVisible();
    await new Promise((r) => setTimeout(r, PHONE_POLL_MS * 2));
    await expect(canvas.getByText(connectUrl(connectIds[0]))).toBeVisible();
    await expect(f.opened()).toEqual([connectIds[0]]);
  },
  parameters: { test: { timeout: PHONE_POLL_MS * 2 + 5000 } },
};
// After the owner ends their only session: the row stays under Ended with its name.
// The happy path's home: its one session with both cards answered.
export const AllAnswered: Story = {
  args: { patch: { sessions: [{ ...liveRow, openCount: 0 }] } },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: new RegExp(liveRow.name!) });
    await expect(link).toBeVisible();
    await expect(link).not.toHaveTextContent(/\d+ open/);
  },
};
export const AfterEnding: Story = {
  args: { patch: { sessions: [{ name: liveRow.name, endedAt: liveRow.lastActivityAt }] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: HOME.ended })).toBeVisible();
    expect(canvas.queryByRole("heading", { name: HOME.active })).toBeNull();
  },
};
