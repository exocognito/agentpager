import { Schema } from "effect";
import { Decision, Inbox, PAIRING_EMOJIS, PAIRING_OPTION_COUNT, PAIRING_TITLE, type Card } from "../../schemas/exchange.ts";
export const id = (letter: string) => letter.repeat(32).slice(0, 32);
export const NOW = "2026-09-29T06:00:00.000Z";
export const session = {
  sessionId: id("s"),
  name: "Claude Code · blueprint",
  paired: true,
  pairedAt: NOW,
  lastAcceptedAt: NOW,
  expiresAt: "2026-09-30T06:00:00.000Z",
  finishedAt: null,
};
const make = (
  key: string,
  title: string,
  detail: string,
  card: Card,
): Decision =>
  Schema.decodeUnknownSync(Decision)({
    decisionId: id(key),
    kind: "card",
    status: "open",
    title,
    detail,
    card,
    askedAt: NOW,
  });
export const question = make(
  "q",
  "What should we aim for first?",
  "Maya’s team can start this week; reliability work can follow their first real session.",
  {
    type: "generic",
    recommended: 1,
    options: [
      {
        number: 1,
        emoji: "🚀",
        title: "Get the first customer live",
        detail: "One useful workflow, from start to finish.",
      },
      {
        number: 2,
        emoji: "🛠️",
        title: "Make the phone flow reliable",
        detail: "Pairing and a decision that work together.",
      },
      {
        number: 3,
        emoji: "🧪",
        title: "Learn what people will pay for",
        detail: "Test demand before building more.",
      },
    ],
  },
);
export const commonQuestion = make(
  "c",
  "How should I handle the failing test?",
  "The new flow works, but an older test expects the previous screen.",
  {
    type: "generic",
    options: [
      { number: 1, emoji: "🧪", title: "Update the test with the new flow" },
      { number: 2, emoji: "📝", title: "Keep the old wording for now" },
    ],
  },
);
export const updateQuestion = make(
  "e",
  "Send Maya the update?",
  "Maya asked for an update once the phone flow was ready.",
  {
    type: "generic",
    options: [
      { number: 1, emoji: "📨", title: "Send now", detail: "As drafted." },
      { number: 2, emoji: "🌅", title: "Send at 9:00 tomorrow", detail: "It lands at the top of Maya’s morning." },
      { number: 3, emoji: "🗑️", title: "Don’t send it" },
    ],
  },
);
export const mergeQuestion = make(
  "p",
  "Merge PR #142?",
  "All 12 checks pass. Two files touch the webhook handler.",
  {
    type: "generic",
    options: [
      { number: 1, emoji: "🟣", title: "Squash and merge", detail: "Into main, then delete the branch." },
      { number: 2, emoji: "⏳", title: "Merge after the staging deploy", detail: "Waits for tonight’s deploy." },
      { number: 3, emoji: "👀", title: "Leave it open for review" },
    ],
  },
);
// The front page's example: one easy yes or no.
export const installPlaywrightQuestion = make(
  "i",
  "Install Playwright?",
  "I need it to screenshot the new signup page. It’s a free tool that lets me drive a browser.",
  {
    type: "generic",
    options: [
      { number: 1, emoji: "👍", title: "Yes, install it" },
      { number: 2, emoji: "⏭️", title: "Skip the screenshots" },
      { number: 3, emoji: "✋", title: "Wait until I’m back" },
    ],
  },
);
export const answered = Schema.decodeUnknownSync(Decision)({
  ...commonQuestion,
  decisionId: id("h"),
  title: "Install dependencies",
  status: "acknowledged",
  answer: {
    answerId: id("a"),
    decisionId: id("h"),
    choice: { kind: "option", number: 1 },
    sentAt: NOW,
  },
  acknowledgement: {
    decisionId: id("h"),
    answerId: id("a"),
    nextSteps: "I installed the dependencies and will run the checks.",
    acknowledgedAt: NOW,
  },
});
export const feedbackDecision = Schema.decodeUnknownSync(Decision)({
  ...question,
  decisionId: id("f"),
  title: "What should we build next?",
  status: "feedback",
  answer: {
    answerId: id("b"),
    decisionId: id("f"),
    choice: {
      kind: "feedback",
      text: "Focus on the phone flow before inviting customers.",
    },
    sentAt: NOW,
  },
});
export const inbox = Schema.decodeUnknownSync(Inbox)({
  session,
  open: [question, updateQuestion, mergeQuestion],
  history: [answered],
});

// Before pairing: the unpaired deadline, and the inbox holds only the pairing card the service created.
export const unpairedSession = {
  ...session,
  paired: false,
  pairedAt: null,
  expiresAt: new Date(Date.parse(NOW) + 14 * 60_000).toISOString(),
};
export const pairingDecision = Schema.decodeUnknownSync(Decision)({
  decisionId: id("g"),
  kind: "pairing",
  status: "open",
  title: PAIRING_TITLE,
  card: {
    type: "generic",
    options: PAIRING_EMOJIS.slice(0, PAIRING_OPTION_COUNT).map(([emoji, title], index) => ({ number: index + 1, emoji, title })),
  },
  askedAt: NOW,
});
// The option the agent tells the owner to choose; the phone never receives it.
export const pairingTarget: number = 2;
export const pairingInbox = Schema.decodeUnknownSync(Inbox)({
  session: unpairedSession,
  open: [pairingDecision],
  history: [],
});
// Right after pairing: the owner chose the agent's emoji and the agent confirmed; nothing else is asked yet.
export const pairedDecision = Schema.decodeUnknownSync(Decision)({
  ...pairingDecision,
  status: "acknowledged",
  answer: { answerId: id("o"), decisionId: pairingDecision.decisionId, choice: { kind: "option", number: pairingTarget }, sentAt: NOW },
  acknowledgement: { decisionId: pairingDecision.decisionId, answerId: id("o"), nextSteps: "Paired. Ready for decisions.", acknowledgedAt: NOW },
});
export const pairedInbox = Schema.decodeUnknownSync(Inbox)({
  session,
  open: [],
  history: [pairedDecision],
});
