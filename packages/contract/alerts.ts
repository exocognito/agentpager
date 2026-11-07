import { Schema } from "effect";
import { Token } from "./values.ts";
import { PagerId } from "./exchange.ts";
import { envelopeCharacters, PREVIEW_MAX_BYTES, type AcknowledgementPreview, type DecisionPreview } from "./parts.ts";

// Alerts through Apple's push service: what the service sends, and the words the phone shows. Apple carries the
// payload as text, so the service sends only plain words that say what kind of alert it is, and the alert's
// encrypted preview; the phone's alert extension opens the preview with the pager's key and shows the real words
// (B17). When it can't, the plain words show (B17.11). The service builds every payload with alertPayload(), and
// the phone's mirror (packages/ios/AgentPagerCrypto, Alerts.swift) reads it; both pass vectors/alerts.json.

export const ALERT_KINDS = ["decision", "acknowledgement", "warning"] as const;
export const AlertKind = Schema.Literal(...ALERT_KINDS);
export type AlertKind = typeof AlertKind.Type;

// What a phone that can't read an alert shows: only what kind of alert it is.
export const PLAIN_TITLE = "AgentPager";
export const PLAIN_BODIES = { decision: "New decision", acknowledgement: "New acknowledgement", warning: "Answer not picked up" } as const satisfies Record<AlertKind, string>;

// Which kind of encrypted part each alert's preview is. The warning that no agent picked up an answer carries that
// decision's own preview again, so the phone names who asked, the computer, the project and the question.
export const PREVIEW_KINDS = { decision: "decisionPreview", acknowledgement: "acknowledgementPreview", warning: "decisionPreview" } as const satisfies Record<AlertKind, "decisionPreview" | "acknowledgementPreview">;

// How long after Send an answer no agent has picked up is warned about (B17.8). The service's clock is
// packages/app/src/contract.ts PICKUP_MS; the phone's words name the same minutes.
export const PICKUP_MINUTES = 3;

// An encrypted preview as it travels: base64url, no longer than a preview of PREVIEW_MAX_BYTES seals to.
export const PREVIEW_MAX_CHARACTERS = envelopeCharacters(PREVIEW_MAX_BYTES);
export const Preview = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9_-]+$/), Schema.maxLength(PREVIEW_MAX_CHARACTERS));

// AgentPager's keys at the payload's top level, beside Apple's `aps`. The phone opens the decision from kind, pagerId,
// agentId and decisionId when the alert is tapped; the preview is bound to its kind, pager and decision.
export const ALERT_KEYS = ["kind", "pagerId", "agentId", "decisionId", "preview"] as const;
const strict = { parseOptions: { onExcessProperty: "error" as const } };
const fields = { kind: AlertKind, pagerId: PagerId, agentId: Token, decisionId: Token, preview: Preview };
// Apple takes at most 4096 bytes of payload.
export const PAYLOAD_MAX_BYTES = 4096;
const utf8Length = (text: string) => new TextEncoder().encode(text).length;
export const AlertPayload = Schema.Struct({
  aps: Schema.Struct({
    alert: Schema.Struct({ title: Schema.Literal(PLAIN_TITLE), body: Schema.Literal(PLAIN_BODIES.decision, PLAIN_BODIES.acknowledgement, PLAIN_BODIES.warning) }).annotations(strict),
    sound: Schema.Literal("default"),
    "thread-id": PagerId,
    // The alert extension runs only for an alert that says it may change it.
    "mutable-content": Schema.Literal(1),
    // Wakes the app in the background to refresh its list and badge (B17.7).
    "content-available": Schema.Literal(1),
    // A decision gets through a Focus mode (B17.3); the others don't.
    "interruption-level": Schema.Literal("time-sensitive", "active"),
  }).annotations(strict),
  ...fields,
}).annotations(strict).pipe(
  Schema.filter(p => p.aps.alert.body === PLAIN_BODIES[p.kind] || "the plain words are the kind's"),
  Schema.filter(p => p.aps["thread-id"] === p.pagerId || "an alert's thread is its pager"),
  Schema.filter(p => (p.aps["interruption-level"] === "time-sensitive") === (p.kind === "decision") || "only a decision is time sensitive"),
  Schema.filter(p => utf8Length(JSON.stringify(p)) <= PAYLOAD_MAX_BYTES || `a payload may not exceed ${PAYLOAD_MAX_BYTES} bytes`),
);
export type AlertPayload = typeof AlertPayload.Type;

// The payload the service sends for one alert. Throws when the ids or the preview aren't the contract's.
export function alertPayload(kind: AlertKind, ids: { pagerId: string; agentId: string; decisionId: string }, preview: string): AlertPayload {
  return Schema.decodeUnknownSync(AlertPayload)({
    aps: {
      alert: { title: PLAIN_TITLE, body: PLAIN_BODIES[kind] }, sound: "default", "thread-id": ids.pagerId,
      "mutable-content": 1, "content-available": 1, "interruption-level": kind === "decision" ? "time-sensitive" : "active",
    },
    kind, pagerId: ids.pagerId, agentId: ids.agentId, decisionId: ids.decisionId, preview,
  });
}

// The words an alert shows, as the service has written them since M1 and the phone writes them from the preview.
export type AlertWords = { title: string; body: string };
type Who = { app: string; project: string; machine?: string };
// The title: who asked and the project (B17.2).
export const alertTitle = (who: Who) => `${who.app} · ${who.project}`;
// A decision's body: the question, then its detail and the recommended option, which show when the alert is
// expanded. Cut to 600 characters, counted as JavaScript's Array.from counts them (code points).
export const DECISION_BODY_MAX = 600;
export function decisionBody(q: { title: string; detail?: string; recommended?: { letter: string; title: string } }) {
  const lines = [q.title, q.detail, q.recommended && `Recommended: ${q.recommended.letter}. ${q.recommended.title}`].filter(Boolean);
  const characters = Array.from(lines.join("\n"));
  return characters.length > DECISION_BODY_MAX ? characters.slice(0, DECISION_BODY_MAX - 1).join("") + "…" : characters.join("");
}
// The warning that no agent has collected an answer: who, where and what, so the owner knows which agent to go to.
export function pickupBody(who: Who, title: string) {
  const agent = `${who.app}${who.machine ? ` on ${who.machine}` : ""} (${who.project})`;
  return `${agent} hasn’t picked up your answer to “${title}” after ${PICKUP_MINUTES} min. AgentPager can’t reach it: it may be asleep, closed or disconnected. Check in with it directly.`;
}

// The words for an alert from its opened preview: a decision's and a warning's from the decision's preview, an
// acknowledgement's from its own (its body is the agent's next steps, B17.5).
export function alertWords(kind: "decision" | "warning", preview: DecisionPreview): AlertWords;
export function alertWords(kind: "acknowledgement", preview: AcknowledgementPreview): AlertWords;
export function alertWords(kind: AlertKind, preview: DecisionPreview | AcknowledgementPreview): AlertWords {
  const acknowledgement = (p: DecisionPreview | AcknowledgementPreview): p is AcknowledgementPreview => "nextSteps" in p;
  if (kind === "acknowledgement") {
    if (!acknowledgement(preview)) throw new Error("an acknowledgement's words come from its own preview");
    return { title: alertTitle(preview), body: preview.nextSteps };
  }
  if (acknowledgement(preview)) throw new Error("a decision's and a warning's words come from the decision's preview");
  return { title: alertTitle(preview), body: kind === "warning" ? pickupBody(preview, preview.title) : decisionBody(preview) };
}
