// The iPhone app's words. The app says agent and pager, never session, and one verb, end. Subtitles read
// "Status · time" in the Agents list and in an agent's header alike. The stories read these back, and the app
// (packages/ios, Wording.swift and its views) must say the same.

export type Lifetime = "24h" | "7d" | "30d";
export type EndReason = "timedOut" | "ownerEnded" | "agentFinished" | "pairingFailed";
export type PagerStatus = "waiting" | "unpaired" | "active" | "ended";

export const LIFETIMES: readonly Lifetime[] = ["24h", "7d", "30d"];

export const LIFETIME: Record<Lifetime, { label: string; note: string }> = {
  "24h": { label: "24 Hours", note: "The pager ends 24 hours after your agent connects, unless you or your agent end it sooner." },
  "7d": { label: "7 Days", note: "The pager ends 7 days after your agent connects, unless you or your agent end it sooner." },
  "30d": { label: "30 Days", note: "The pager ends 30 days after your agent connects, unless you or your agent end it sooner." },
};

export const END_REASON: Record<EndReason, string> = {
  timedOut: "It reached its end time.",
  ownerEnded: "You ended it.",
  agentFinished: "Your agent finished and ended it.",
  pairingFailed: "Pairing failed after 3 wrong codes.",
};

export const WORDS = {
  agents: "Agents",
  activePagers: "Active pagers",
  endedPagers: "Ended pagers",
  noAgents: "No Agents connected",
  noAgentsText: "Connect an agent to get its decisions on this phone.",
  connectAgent: "Connect an agent",
  settings: "Settings",
  updatedJustNow: "Updated Just Now",
  updating: "Updating…",
  cantReach: "Can’t Reach Server",
  back: "Agents",
  more: "More",
  close: "Close",

  connectTitle: "Connect an Agent",
  connectIntro: "Give this AgentPager link to your agent. Your agent can also make one for you to scan.",
  linkHeader: "AgentPager link",
  makingLink: "Making a link…",
  copy: "Copy",
  copied: "Copied",
  pagerEndsAfter: "Pager ends after",
  shareLink: "Share Link…",
  tryAgain: "Try Again",
  qrLabel: "QR code for the AgentPager link",

  pairTitle: "Pair This Agent",
  pairIntro: "Tap the 3 emojis your agent shows you, in order.",
  pair: "Pair",
  checking: "Checking…",
  lastTry: "Last try. If it’s wrong, this pager ends.",
  pairOffline: "Couldn’t reach the server. Tap Pair to try again.",
  pairingFailed: "Pairing Failed",
  pairingFailedText: "That was the third wrong code, so this pager has ended. Try connecting an agent again.",
  connectAgain: "Connect an Agent",
  paired: "Paired",
  palette: "Emoji palette",

  open: "Open",
  answered: "Answered",
  noDecisions: "No decisions yet. Your agent’s questions appear here.",
  ends: "Ends",
  endPager: "End Pager",
  cancel: "Cancel",
  endConfirmText: "Your agent keeps running, but it can’t page you anymore. Open decisions are cleared.",
  agentConfirmed: "Agent confirmed",
  sending: "Sending…",
  waitingForAgent: "Waiting for your agent…",
  ended: "This pager has ended",
  backToAgents: "Back to Agents",

  chooseOne: "Choose one",
  recommended: "Recommended",
  askForChanges: "Ask for Changes",
  send: "Send",
  undo: "Undo",
  changesHeader: "What should your agent change?",
  changesFooter: "Your agent gets this note instead of one of the options.",
  changesHtml: "Leave out HTML tags; your agent gets plain text.",
  decisionCleared: "Decision Cleared",
  decisionClearedText: "This decision is no longer on your pager.",
  options: "Options",
  notConfirmed: "Answer Not Confirmed",
  notConfirmedText: "Your answer is not confirmed. Retry sends the same prepared answer.",
  retry: "Retry",

  pagerNumber: "Pager number",
  makingNumber: "Making a number…",
  noNumber: "No number yet",
  copyForAgents: "Copy for Your Agents",
  share: "Share…",
  numberFooter: "Agents with this number open a pager on this phone without pairing. Put it only where agents you trust read it, such as your AGENTS.md. Copy or Share gives you a line to paste there.",
  server: "Server",
  changeNumber: "Change Pager Number…",
  changeNumberFooter: "Agents using the old number can no longer open pagers. Pagers already open keep working.",
  changeNumberTitle: "Change your pager number?",
  changeNumberText: "The old number stops working at once. Give your agents the new one.",
  changeNumberConfirm: "Change Number",
  serverHeader: "AgentPager server",
  serverFooter: "Your pagers are kept per server.",
  serverInvalid: "Enter a full http:// or https:// address.",
  save: "Save",

  linkPageTitle: "AgentPager link",
  linkPageText: "Open this link in the AgentPager app on your iPhone to pair with your agent.",
  openInApp: "Open in AgentPager",
  noApp: "Don’t have the app? AgentPager for iPhone is in testing and is not in the App Store yet.",
  areYouAnAgent: "Are you an agent?",
} as const;

// The phone shows these when a link can't be paired; the title, then the text.
export const UNAVAILABLE = {
  waiting: ["Waiting for Your Agent", "Give your agent this AgentPager link first. Pairing opens once it connects."],
  alreadyPaired: ["Already Paired", "This agent is already paired with a phone."],
  otherPhone: ["Already Paired", "Another phone already paired with this agent."],
  ended: ["This Pager Has Ended", "Try connecting an agent again."],
  expired: ["Link Expired", "This AgentPager link has expired. Ask your agent for a new one, or connect an agent again."],
  offline: ["Can’t Reach Server", "Check that your AgentPager server is running, then try again."],
} as const satisfies Record<string, readonly [string, string]>;
export type Unavailable = keyof typeof UNAVAILABLE;

const MINUTE = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

// "14m", "24h", "7d": minutes under an hour, hours under two days, then days.
export function remaining(end: Date, now: Date): string {
  const ms = Math.max(0, end.getTime() - now.getTime());
  const minutes = Math.floor(ms / MINUTE);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(ms / HOUR);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(ms / DAY)}d`;
}

export function ago(date: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - date.getTime());
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

export type PagerTimes = { status: PagerStatus; endsAt?: Date; endedAt?: Date };
export function subtitle(p: PagerTimes, now: Date): string {
  if (p.status === "ended") return `Pager ended · ${ago(p.endedAt ?? now, now)}`;
  if (p.status === "active") return `Pager active · Ends in ${remaining(p.endsAt ?? now, now)}`;
  return `Pager not paired · Ends in ${remaining(p.endsAt ?? now, now)}`;
}

// The ⋯ menu's title: "Pager ends Sep 30 at 6:00 AM", in the phone's time zone.
export function exactEnd(date: Date, timeZone?: string): string {
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(date);
  return `Pager ends ${day} at ${time(date, timeZone)}`;
}

// "6:00 AM", with a plain space as the app's formatter writes it (Intl puts a narrow no-break space there).
export function time(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(date).replace("\u202f", " ");
}

// "Claude Code · blueprint" -> "Claude Code"
export const shortName = (name: string) => name.split(" · ")[0] ?? name;

export const endConfirmTitle = (name: string) => `End ${shortName(name)}’s pager?`;
export const endedText = (name: string) => `${shortName(name)} can’t page you anymore, and its decisions have been cleared.`;
export const pairedText = (name: string, ends: string) => `${name} can now page you. Pager ends in ${ends}.`;
export const sendingIn = (seconds: number) => `Sending in ${seconds}s`;
export const notPickedUp = (who: string) => `${who} hasn’t picked up your answer. It may be asleep, closed or disconnected: check in with it directly.`;
export const youAt = (at: string) => `You · ${at}`;
export const agentConfirmedAt = (at: string) => `Your agent confirmed · ${at}`;
export const serverNow = (status: string) => `Your pagers and pager number are kept per server. Now: ${status}.`;
export const cantReachAt = (server: string) => `Can’t reach your AgentPager server at ${server}.`;

// The pairing window is the pager's first 15 minutes, so a phone-made link has less left by the time its agent joins.
export function pairingHint(minutesLeft?: number): string {
  if (minutesLeft === undefined) return "Pair within 15 minutes, or this pager ends.";
  const m = Math.max(1, Math.ceil(minutesLeft));
  return `Pair within ${m} minute${m === 1 ? "" : "s"}, or this pager ends.`;
}
export const wrongCode = (triesLeft: number) => (triesLeft === 1 ? WORDS.lastTry : `Those don’t match. ${triesLeft} tries left.`);
export const triesLeftText = (triesLeft: number) => `${triesLeft} tries left.`;
