// Writes vectors/alerts.json, the vectors every reader of an alert must pass: the phone's alert extension
// (packages/ios/AgentPagerCrypto, Alerts.swift) and the contract's own tests (alerts.test.ts). Run it with
//   node --experimental-strip-types packages/contract/vectors/alerts.ts
// It seals nothing: each payload carries a preview already sealed in vectors/envelope.json, whose plaintext and key
// are given there, so the words an alert shows follow from that plaintext alone. Running it again writes the same
// file; alerts.test.ts checks that it does.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Schema } from "effect";
import { ALERT_KEYS, alertPayload, alertWords, DECISION_BODY_MAX, PICKUP_MINUTES, PLAIN_BODIES, PLAIN_TITLE, PREVIEW_KINDS, type AlertKind, type AlertWords } from "../alerts.ts";
import { AcknowledgementPreview, DecisionPreview } from "../parts.ts";

export const ALERT_VECTORS_PATH = fileURLToPath(new URL("alerts.json", import.meta.url));
const envelope: { seal: { name: string; kind: string; context: { pagerId: string; decisionId?: string }; recipientPrivateKey: string; plaintext: string; envelope: string }[] } =
  JSON.parse(readFileSync(fileURLToPath(new URL("envelope.json", import.meta.url)), "utf8"));
const sealed = (name: string) => {
  const s = envelope.seal.find(v => v.name === name);
  if (!s?.context.decisionId) throw new Error(`vectors/envelope.json has no "${name}" with a decision`);
  return { ...s, decisionId: s.context.decisionId, json: Buffer.from(s.plaintext, "base64url").toString("utf8") };
};
const decision = sealed("decision preview"), acknowledgement = sealed("acknowledgement preview");

// Words: an opened preview's JSON, and what the alert shows.
type WordsCase = { name: string; kind: AlertKind; previewJSON: string; shows: AlertWords };
function words(name: string, kind: AlertKind, preview: object): WordsCase {
  const json = JSON.stringify(preview);
  const shows = kind === "acknowledgement"
    ? alertWords(kind, Schema.decodeUnknownSync(AcknowledgementPreview)(preview))
    : alertWords(kind, Schema.decodeUnknownSync(DecisionPreview)(preview));
  return { name, kind, previewJSON: json, shows };
}
// A body past the cut, which falls inside an emoji made of several code points: the cut counts code points, as
// JavaScript's Array.from does, not visible characters.
const long = { title: "Q".repeat(100), detail: "d".repeat(280), recommended: { letter: "C", title: "x".repeat(151) + "👩‍💻".repeat(100) + "y".repeat(29) }, app: "Codex", project: "shop" };
const cutCase = words("a decision whose body passes 600 characters, cut inside an emoji", "decision", long);
const kept = Array.from(cutCase.shows.body);
if (kept.length !== DECISION_BODY_MAX || kept.at(-1) !== "…" || kept.at(-2) !== "‍") throw new Error("the cut case no longer cuts inside an emoji");
const wordCases: WordsCase[] = [
  words("a decision with its detail and recommended option", "decision", JSON.parse(decision.json)),
  words("a decision with only its question", "decision", { title: "Merge the release branch?", app: "Codex", project: "shop" }),
  words("a decision with a recommended option and no detail", "decision", { title: "Which region?", recommended: { letter: "A", title: "us-east" }, app: "Claude Code", project: "infra", machine: "mini" }),
  words("a decision whose detail has lines of its own", "decision", { title: "Rename the table?", detail: "It holds 3 rows.\nNothing reads it yet.", app: "Codex", project: "db" }),
  cutCase,
  words("an acknowledgement", "acknowledgement", JSON.parse(acknowledgement.json)),
  words("a warning naming the computer", "warning", JSON.parse(decision.json)),
  words("a warning with no computer", "warning", { title: "Merge the release branch?", app: "Codex", project: "shop" }),
];

// Payloads: as the service sends them, with the key of the pager this phone holds for the alert's pagerId, and what
// the phone shows, or null when it can't read the preview and the alert shows as sent.
type PayloadCase = { name: string; payload: object; recipientPrivateKey: string; shows: AlertWords | null };
const AGENT = "aGentAGENTagent1234567890_-agent";
const OTHER_KEY = Buffer.from("agentpager alert vectors: a key that is not the pager's").subarray(0, 32).toString("base64url");
const ids = (s: typeof decision, change: { pagerId?: string; decisionId?: string } = {}) =>
  ({ pagerId: change.pagerId ?? s.context.pagerId, agentId: AGENT, decisionId: change.decisionId ?? s.decisionId });
const opened = (kind: AlertKind, s: typeof decision) => wordCases.find(w => w.kind === kind && w.previewJSON === s.json)?.shows ?? null;
const swap = (text: string, at: number) => text.slice(0, at) + (text[at] === "A" ? "B" : "A") + text.slice(at + 1);
const payloads: PayloadCase[] = [
  { name: "a decision", payload: alertPayload("decision", ids(decision), decision.envelope), recipientPrivateKey: decision.recipientPrivateKey, shows: opened("decision", decision) },
  { name: "an acknowledgement", payload: alertPayload("acknowledgement", ids(acknowledgement), acknowledgement.envelope), recipientPrivateKey: acknowledgement.recipientPrivateKey, shows: opened("acknowledgement", acknowledgement) },
  { name: "a warning, carrying its decision's preview", payload: alertPayload("warning", ids(decision), decision.envelope), recipientPrivateKey: decision.recipientPrivateKey, shows: opened("warning", decision) },
  { name: "a preview moved to another pager", payload: alertPayload("decision", ids(decision, { pagerId: "0".repeat(31) + "1" }), decision.envelope), recipientPrivateKey: decision.recipientPrivateKey, shows: null },
  { name: "a preview moved to another decision", payload: alertPayload("decision", ids(decision, { decisionId: "B".repeat(32) }), decision.envelope), recipientPrivateKey: decision.recipientPrivateKey, shows: null },
  { name: "an acknowledgement carrying a decision's preview", payload: alertPayload("acknowledgement", ids(decision), decision.envelope), recipientPrivateKey: decision.recipientPrivateKey, shows: null },
  { name: "a decision carrying an acknowledgement's preview", payload: alertPayload("decision", ids(acknowledgement), acknowledgement.envelope), recipientPrivateKey: acknowledgement.recipientPrivateKey, shows: null },
  { name: "a warning carrying an acknowledgement's preview", payload: alertPayload("warning", ids(acknowledgement), acknowledgement.envelope), recipientPrivateKey: acknowledgement.recipientPrivateKey, shows: null },
  { name: "a preview changed on the way", payload: alertPayload("decision", ids(decision), swap(decision.envelope, 80)), recipientPrivateKey: decision.recipientPrivateKey, shows: null },
  { name: "a preview cut short", payload: alertPayload("decision", ids(decision), decision.envelope.slice(0, -8)), recipientPrivateKey: decision.recipientPrivateKey, shows: null },
  { name: "a preview sealed to another key", payload: alertPayload("decision", ids(decision), decision.envelope), recipientPrivateKey: OTHER_KEY, shows: null },
  // As the service sends alerts before the switch: its own words, and no preview. The phone shows them as sent.
  {
    name: "an alert with no preview",
    payload: { aps: { alert: { title: "Codex · shop", body: "Merge the release branch?" }, sound: "default", "thread-id": decision.context.pagerId, "content-available": 1, "interruption-level": "time-sensitive" }, kind: "decision", ...ids(decision) },
    recipientPrivateKey: decision.recipientPrivateKey, shows: null,
  },
];

export function alertVectors(): string {
  const v = {
    about: "Alerts as the service sends them and as the phone shows them (packages/contract/alerts.ts). Written by vectors/alerts.ts from vectors/envelope.json's sealed previews; don't edit by hand.",
    plain: { title: PLAIN_TITLE, bodies: PLAIN_BODIES },
    keys: ALERT_KEYS,
    previewKinds: PREVIEW_KINDS,
    pickupMinutes: PICKUP_MINUTES,
    decisionBodyMax: DECISION_BODY_MAX,
    words: wordCases,
    payloads,
  };
  return JSON.stringify(v, null, 2) + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  writeFileSync(ALERT_VECTORS_PATH, alertVectors());
  console.log(`wrote ${ALERT_VECTORS_PATH}: ${wordCases.length} words, ${payloads.length} payloads`);
}
