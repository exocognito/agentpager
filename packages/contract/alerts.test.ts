import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { ALERT_KEYS, AlertPayload, alertPayload, alertWords, PAYLOAD_MAX_BYTES, PLAIN_BODIES, PLAIN_TITLE, PREVIEW_KINDS, PREVIEW_MAX_CHARACTERS, type AlertKind } from "./alerts.ts";
import { EnvelopeError, fromBase64url, keyPair, open, seal, toBase64url } from "./envelope.ts";
import { AcknowledgementPreview, DecisionPreview, decodePart, encodePart, PartInvalid, PREVIEW_MAX_BYTES } from "./parts.ts";
import { alertVectors, ALERT_VECTORS_PATH } from "./vectors/alerts.ts";

type Words = { title: string; body: string };
const text = readFileSync(ALERT_VECTORS_PATH, "utf8");
const v: {
  words: { name: string; kind: AlertKind; previewJSON: string; shows: Words }[];
  payloads: { name: string; payload: { kind: AlertKind; pagerId: string; decisionId: string; preview?: string }; recipientPrivateKey: string; shows: Words | null }[];
} = JSON.parse(text);
const ids = { pagerId: "5254d8586ca9073ac4d4854e48971373", agentId: "aGentAGENTagent1234567890_-agent", decisionId: "a8Z6yhijm1nporqyjY8k3gzUwvvci4bl" };
const utf8Length = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

// What a phone with this key shows for a payload, read with the command's side of the format: the words, or null
// when the alert shows as sent.
function shown(payload: { kind: AlertKind; pagerId: string; decisionId: string; preview?: string }, key: string): Words | null {
  if (payload.preview === undefined) return null;
  const kind = PREVIEW_KINDS[payload.kind];
  try {
    const bytes = open(fromBase64url(key) ?? new Uint8Array(), kind, { pagerId: payload.pagerId, decisionId: payload.decisionId }, payload.preview);
    return kind === "acknowledgementPreview"
      ? alertWords("acknowledgement", decodePart("acknowledgementPreview", bytes))
      : alertWords(payload.kind === "warning" ? "warning" : "decision", decodePart("decisionPreview", bytes));
  } catch (error) {
    if (error instanceof EnvelopeError || error instanceof PartInvalid) return null;
    throw error;
  }
}

describe("the alert vectors", () => {
  it("are what vectors/alerts.ts writes", () => {
    expect(alertVectors()).toBe(text);
  });
  it.each(v.payloads)("show what the preview says, or the plain words when it can't be read: $name", p => {
    expect(shown(p.payload, p.recipientPrivateKey)).toEqual(p.shows);
  });
  it("cover each kind read, and each way a preview can't be", () => {
    expect(v.payloads.filter(p => p.shows).map(p => p.payload.kind).sort()).toEqual(["acknowledgement", "decision", "warning"]);
    expect(v.payloads.filter(p => !p.shows).length).toBe(9);
  });
});

describe("alert words", () => {
  const cases = (kind: AlertKind) => v.words.filter(w => w.kind === kind);
  it.each(cases("decision"))("B17.2 A decision's title names who asked and the project; its body is the question, then its detail and the recommended option: $name", w => {
    expect(alertWords("decision", Schema.decodeUnknownSync(DecisionPreview)(JSON.parse(w.previewJSON)))).toEqual(w.shows);
  });
  it.each(cases("acknowledgement"))("B17.5 An acknowledgement's alert has the agent's words: $name", w => {
    expect(alertWords("acknowledgement", Schema.decodeUnknownSync(AcknowledgementPreview)(JSON.parse(w.previewJSON)))).toEqual(w.shows);
  });
  it.each(cases("warning"))("B17.8 The not-picked-up alert names who asked, its computer, its project and the question: $name", w => {
    expect(alertWords("warning", Schema.decodeUnknownSync(DecisionPreview)(JSON.parse(w.previewJSON)))).toEqual(w.shows);
  });
  it("come from the preview of their own kind", () => {
    const decision = Schema.decodeUnknownSync(DecisionPreview)({ title: "Ship?", app: "Codex", project: "shop" });
    const ack = Schema.decodeUnknownSync(AcknowledgementPreview)({ nextSteps: "Shipping.", app: "Codex", project: "shop", title: "Ship?" });
    expect(() => Reflect.apply(alertWords, undefined, ["acknowledgement", decision])).toThrow();
    expect(() => Reflect.apply(alertWords, undefined, ["decision", ack])).toThrow();
    expect(() => Reflect.apply(alertWords, undefined, ["warning", ack])).toThrow();
  });
});

describe("the payload", () => {
  const pager = keyPair();
  const preview = (bytes: number) => seal(pager.publicKey, "decisionPreview", { pagerId: ids.pagerId, decisionId: ids.decisionId }, new Uint8Array(bytes).fill(0x61));
  it("B17.11 says only what kind of alert it is, as text", () => {
    for (const kind of ["decision", "acknowledgement", "warning"] as const) {
      const p = alertPayload(kind, ids, preview(10));
      expect(p.aps.alert).toEqual({ title: PLAIN_TITLE, body: PLAIN_BODIES[kind] });
      expect(Object.keys(p).sort()).toEqual(["aps", ...ALERT_KEYS].sort());
      expect(p.aps["mutable-content"]).toBe(1);
      expect(p.aps["thread-id"]).toBe(ids.pagerId);
    }
  });
  it("B17.3 A decision's alert is time sensitive; the others aren't", () => {
    expect(alertPayload("decision", ids, preview(10)).aps["interruption-level"]).toBe("time-sensitive");
    expect(alertPayload("acknowledgement", ids, preview(10)).aps["interruption-level"]).toBe("active");
    expect(alertPayload("warning", ids, preview(10)).aps["interruption-level"]).toBe("active");
  });
  it("fits Apple's 4096 bytes with the largest preview", () => {
    const largest = preview(PREVIEW_MAX_BYTES);
    expect(largest.length).toBe(PREVIEW_MAX_CHARACTERS);
    expect(utf8Length(alertPayload("decision", ids, largest))).toBeLessThanOrEqual(PAYLOAD_MAX_BYTES);
    expect(() => alertPayload("decision", ids, largest + "AAAA")).toThrow();
  });
  it("refuses ids and previews that aren't the contract's", () => {
    expect(() => alertPayload("decision", { ...ids, pagerId: "NOT-HEX" }, preview(10))).toThrow();
    expect(() => alertPayload("decision", { ...ids, decisionId: "short" }, preview(10))).toThrow();
    expect(() => alertPayload("decision", { ...ids, agentId: "short" }, preview(10))).toThrow();
    expect(() => alertPayload("decision", ids, "not base64url!")).toThrow();
    expect(() => alertPayload("decision", ids, "")).toThrow();
  });
  it("is refused when its words, thread, level or keys aren't the contract's", () => {
    const good = alertPayload("acknowledgement", ids, preview(10));
    const decode = (p: unknown) => Schema.decodeUnknownEither(AlertPayload)(p)._tag;
    expect(decode(good)).toBe("Right");
    expect(decode({ ...good, aps: { ...good.aps, alert: { title: PLAIN_TITLE, body: "Codex · shop: Ship?" } } })).toBe("Left");
    expect(decode({ ...good, aps: { ...good.aps, alert: { title: PLAIN_TITLE, body: PLAIN_BODIES.decision } } })).toBe("Left");
    expect(decode({ ...good, aps: { ...good.aps, "thread-id": "0".repeat(32) } })).toBe("Left");
    expect(decode({ ...good, aps: { ...good.aps, "interruption-level": "time-sensitive" } })).toBe("Left");
    expect(decode({ ...good, title: "Ship?" })).toBe("Left");
    const { preview: _, ...withoutPreview } = good;
    expect(decode(withoutPreview)).toBe("Left");
  });
  it("carries a preview the pager's key opens, bound to its pager and decision", () => {
    const words = { title: "Ship?", app: "Codex", project: "shop" };
    const sealed = seal(pager.publicKey, "decisionPreview", { pagerId: ids.pagerId, decisionId: ids.decisionId }, encodePart("decisionPreview", words));
    const p = alertPayload("decision", ids, sealed);
    expect(shown(p, toBase64url(pager.privateKey))).toEqual({ title: "Codex · shop", body: "Ship?" });
    expect(shown({ ...p, decisionId: "B".repeat(32) }, toBase64url(pager.privateKey))).toBeNull();
    expect(shown(p, toBase64url(keyPair().privateKey))).toBeNull();
  });
});
