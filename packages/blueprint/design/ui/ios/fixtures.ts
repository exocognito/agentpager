import type { EndReason, Lifetime, PagerStatus } from "./words.ts";

// What the screens show, as plain values. Times are fixed so every story reads the same: it is 6:00 AM on
// Sep 29 in the phone's time zone.

export const TIME_ZONE = "America/Los_Angeles";
export const NOW = new Date("2026-09-29T13:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

export type Pager = { sessionId: string; name: string; status: PagerStatus; lifetime: Lifetime; endsAt?: Date; endedAt?: Date; endReason?: EndReason; openCount?: number };
export type Option = { number: number; emoji: string; title: string; detail?: string };
export type Decision = { decisionId: string; title: string; detail?: string; recommended?: number; options: Option[] };
export type Choice = { kind: "option"; number: number } | { kind: "feedback"; text: string };
// From Send: Undo is open, then the answer is sending, then it waits for the agent, then the agent confirms.
export type SendState = { kind: "undo"; seconds: number } | { kind: "sending" } | { kind: "waiting" } | { kind: "confirmed"; nextSteps: string; at: Date };
export type Answered = { decision: Decision; choice: Choice; sentAt: Date; state: SendState };

export const claude: Pager = { sessionId: "p1", name: "Claude Code · blueprint", status: "active", lifetime: "24h", endsAt: minutes(24 * 60), openCount: 3 };
export const codex: Pager = { sessionId: "p2", name: "Codex · agentpager", status: "unpaired", lifetime: "24h", endsAt: minutes(14) };
export const pi: Pager = { sessionId: "p3", name: "Pi · release notes", status: "ended", lifetime: "24h", endedAt: minutes(-40), endReason: "agentFinished" };
export const trip: Pager = { sessionId: "p4", name: "Claude · trip planner", status: "ended", lifetime: "7d", endedAt: minutes(-5 * 60), endReason: "timedOut" };
export const research: Pager = { sessionId: "p5", name: "Research agent", status: "ended", lifetime: "24h", endedAt: minutes(-20 * 60), endReason: "ownerEnded" };
export const AGENTS: Pager[] = [claude, codex, pi, trip, research];

export const aim: Decision = {
  decisionId: "d1",
  title: "What should we aim for first?",
  detail: "Maya’s team can start this week; reliability work can follow their first real session.",
  recommended: 1,
  options: [
    { number: 1, emoji: "🚀", title: "Ship to Maya’s team this week", detail: "Reliability work follows their first real session." },
    { number: 2, emoji: "🛠️", title: "Reliability first", detail: "Maya’s team starts a week later." },
  ],
};
export const update: Decision = {
  decisionId: "d2",
  title: "Send Maya the update?",
  detail: "Maya asked for an update once the phone flow was ready.",
  recommended: 1,
  options: [
    { number: 1, emoji: "📨", title: "Send now", detail: "As drafted." },
    { number: 2, emoji: "🌅", title: "Send at 9:00 tomorrow", detail: "It lands at the top of Maya’s morning." },
    { number: 3, emoji: "🗑️", title: "Don’t send it" },
  ],
};
export const merge: Decision = {
  decisionId: "d3",
  title: "Merge PR #142?",
  detail: "All 12 checks pass. Two files touch the webhook handler.",
  options: [
    { number: 1, emoji: "✅", title: "Merge it" },
    { number: 2, emoji: "👀", title: "Wait for my review", detail: "I’ll look at the webhook handler tonight." },
  ],
};
// The question /start shows agents as its example.
export const first: Decision = {
  decisionId: "d4",
  title: "Which should I do first?",
  detail: "The tests take 4 minutes.",
  recommended: 1,
  options: [
    { number: 1, emoji: "🧪", title: "Run the tests", detail: "Then update the docs." },
    { number: 2, emoji: "📖", title: "Update the docs" },
  ],
};

export const confirmedFirst: Answered = { decision: first, choice: { kind: "option", number: 1 }, sentAt: minutes(-12), state: { kind: "confirmed", nextSteps: "Running the tests now, then the docs.", at: minutes(-11) } };
export const answeredUpdate = (state: SendState, choice: Choice = { kind: "option", number: 2 }): Answered => ({ decision: update, choice, sentAt: minutes(-1), state });
export const confirmedUpdate = answeredUpdate({ kind: "confirmed", nextSteps: "Sending it at 9:00 tomorrow.", at: NOW });
export const feedbackUpdate = answeredUpdate({ kind: "confirmed", nextSteps: "Cutting it to three lines, then I’ll ask again.", at: NOW }, { kind: "feedback", text: "Please make it shorter." });

export const OPEN = [aim, update, merge];
export const OPEN_AFTER_SEND = [aim, merge];

export const PALETTE: readonly (readonly [string, string])[] = [
  ["🍋", "lemon"], ["🦊", "fox"], ["🚲", "bicycle"], ["🐙", "octopus"], ["🎈", "balloon"],
  ["🌙", "moon"], ["🔑", "key"], ["🌵", "cactus"], ["🐢", "turtle"], ["🍉", "watermelon"],
  ["⚓", "anchor"], ["🎸", "guitar"], ["🍄", "mushroom"], ["🚀", "rocket"], ["🧊", "ice"],
  ["🌻", "sunflower"], ["🦉", "owl"], ["🍩", "doughnut"], ["⛵", "sailboat"], ["🔔", "bell"],
  ["🐝", "bee"], ["🌈", "rainbow"], ["🧲", "magnet"], ["🥕", "carrot"], ["🪁", "kite"],
];
export const CODE = ["🦊", "🌵", "🦊"] as const;

export const LINK = "https://agentpager.me/start/k7Qm2vXa9LpR4tWn8ZcE1yHs5BdF3uJg";
export const SERVER = "http://192.168.1.10:8787";
export const PAGER_NUMBER = "Rk3vQ9mZt2LxW8nB5cYh7JpD4sFa6GuE";
