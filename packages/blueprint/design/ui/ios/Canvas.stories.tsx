import type { Meta, StoryObj } from "@storybook/react-vite";
import { composeStories } from "@storybook/react-vite";
import type { ComponentType } from "react";
import { expect } from "storybook/test";
import * as AfterSendStories from "./AfterSend.stories.tsx";
import * as AgentStories from "./Agent.stories.tsx";
import * as AgentsStories from "./Agents.stories.tsx";
import * as AroundStories from "./Around.stories.tsx";
import * as ConnectStories from "./Connect.stories.tsx";
import * as DecisionStories from "./Decision.stories.tsx";
import * as PairingStories from "./Pairing.stories.tsx";
import * as SettingsStories from "./Settings.stories.tsx";

// Every iPhone story on one page, in rows, the way Sam's Claude Design canvas lays them out. Storybook is the
// canonical design: Claude Design sketches, these stories decide, and the app draws what they show.
const agents = composeStories(AgentsStories), settings = composeStories(SettingsStories), connect = composeStories(ConnectStories);
const around = composeStories(AroundStories), pairing = composeStories(PairingStories), agent = composeStories(AgentStories);
const decision = composeStories(DecisionStories), after = composeStories(AfterSendStories);
const ALL: Record<string, { id: string }>[] = [agents, settings, connect, around, pairing, agent, decision, after];

type Frame = ComponentType<{ dark?: boolean }> & { id: string };
// Picks stories for a row, captioned with the names the sidebar shows (composed stories keep only export names).
function pick<S extends Record<string, Frame>>(composed: S, module: Record<string, unknown>, keys: (keyof S & string)[]) {
  return keys.map((key) => {
    const story = module[key];
    const caption = typeof story === "object" && story !== null && "name" in story && typeof story.name === "string" ? story.name : key;
    return { Frame: composed[key], caption };
  });
}

const ROWS = [
  ["1 · Agents and Settings", [
    ...pick(agents, AgentsStories, ["ActiveAndEnded", "Empty", "CantReachServer"]),
    ...pick(settings, SettingsStories, ["PagerNumber", "Copied", "MakingNumber", "CantMakeNumber", "ChangeNumber", "Server", "ServerInvalid"]),
  ]],
  ["2 · Connecting an agent", [
    ...pick(connect, ConnectStories, ["LinkReady", "LifetimeMenu", "Copied", "MakingLink", "CantMakeLink"]),
    ...pick(around, AroundStories, ["LinkPageStory", "AgentShowsCode"]),
  ]],
  ["3 · Pairing", pick(pairing, PairingStories, ["Start", "PhoneMadeLink", "TwoEntered", "Ready", "Checking", "Wrong", "LastTry", "AfterWrong", "CouldntReachServer", "Failed", "Paired", "Loading", "WaitingForAgent", "AlreadyPaired", "AnotherPhonePaired", "LinkExpired", "PagerEnded", "CantReachServer"])],
  ["4 · Inside an agent", pick(agent, AgentStories, ["Decisions", "NoDecisionsYet", "Menu", "EndsMenu", "EndConfirm", "EndedAgentFinished", "EndedTimedOut", "EndedByYou", "EndedPairingFailed"])],
  ["5 · Answering a decision", pick(decision, DecisionStories, ["OptionChosen", "NothingChosen", "AskForChanges", "AskForChangesWithHtml", "Cleared"])],
  ["6 · After you answer", [
    ...pick(after, AfterSendStories, ["Undo", "Sending", "NotConfirmed", "Waiting", "Confirmed"]),
    ...pick(decision, DecisionStories, ["ThreadUndo", "ThreadSending", "ThreadWaiting", "ThreadConfirmed", "ThreadFeedback"]),
  ]],
] as const;

function Canvas({ dark, scale }: { dark: boolean; scale: number }) {
  return (
    <main className={dark ? "ios-canvas dark" : "ios-canvas"} style={{ zoom: scale }}>
      <h1>AgentPager for iPhone</h1>
      {ROWS.map(([row, frames]) => (
        <section key={row} aria-label={row}>
          <h2>{row}</h2>
          <div className="ios-canvas-row">
            {frames.map(({ Frame, caption }) => (
              <figure key={Frame.id}>
                <figcaption>{caption}</figcaption>
                <Frame dark={dark} />
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

const meta = {
  title: "iPhone/Canvas",
  component: Canvas,
  args: { dark: false, scale: 0.5 },
  argTypes: { scale: { control: { type: "range", min: 0.25, max: 1, step: 0.05 } } },
} satisfies Meta<typeof Canvas>;
export default meta;
type Story = StoryObj<typeof meta>;

const shown = new Set(ROWS.flatMap(([, frames]) => frames.map((f) => f.Frame.id)));
const missing = () => ALL.flatMap((stories) => Object.values(stories).map((s) => s.id)).filter((id) => !shown.has(id));

export const Light: Story = {
  play: async ({ canvas }) => {
    await expect(missing()).toEqual([]);
    await expect(canvas.getAllByRole("figure")).toHaveLength(shown.size);
  },
};
export const Dark: Story = { args: { dark: true } };
