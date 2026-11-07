import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { characters } from "./values.ts";
import { keyPair, seal } from "./envelope.ts";
import {
  acknowledgementPreview, AcknowledgementPreview, type CardPart, decisionPreview, DecisionPreview, decodePart, encodePart, envelopeCharacters,
  type IdentityPart, PartInvalid, PREVIEW_MAX_BYTES, type ShapedKind,
} from "./parts.ts";
import { VECTORS_PATH } from "./vectors/generate.ts";
import type { Vectors } from "./vectors/verify.ts";

const v: Vectors = JSON.parse(readFileSync(VECTORS_PATH, "utf8"));
const raw = (b64: string) => new Uint8Array(Buffer.from(b64, "base64url"));
const kindOf = (kind: string) => kind as ShapedKind;

describe("each kind's plaintext", () => {
  it.each(v.parts.valid)("decodes: $name", p => {
    expect(() => decodePart(kindOf(p.kind), raw(p.plaintext))).not.toThrow();
  });
  it.each(v.parts.invalid)("is refused: $name", p => {
    expect(() => decodePart(kindOf(p.kind), raw(p.plaintext))).toThrow(PartInvalid);
  });
  it("is refused by field, as the service refuses a request", () => {
    expect(() => encodePart("acknowledgement", { nextSteps: "x".repeat(281) })).toThrow(/nextSteps: text may not exceed 280 characters/);
    expect(() => decodePart("identity", new TextEncoder().encode('{"app":"Codex","project":"site","pager":"x"}'))).toThrow(/pager/);
  });
});

// An alert's payload as the service sends it today (packages/app/src/push.ts), with the preview and the flag that
// lets the phone's extension open it. Apple takes at most 4096 bytes.
const pagerId = "0123456789abcdef0123456789abcdef", id = "A".repeat(32);
const payload = (preview: string) => JSON.stringify({
  aps: { alert: { title: "AgentPager", body: "An answer hasn’t been picked up" }, sound: "default", "thread-id": pagerId, "content-available": 1, "mutable-content": 1, "interruption-level": "time-sensitive" },
  kind: "warning", pagerId, agentId: id, decisionId: id, preview,
});
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const pager = keyPair();
const sealedIn = (kind: "decisionPreview" | "acknowledgementPreview", preview: DecisionPreview | AcknowledgementPreview) =>
  payload(seal(pager.publicKey, kind, { pagerId, decisionId: id }, encodePart(kind, preview)));

const four = (n: number) => "𝄞".repeat(n); // one character, four bytes
const heavy = "a" + "́".repeat(3000); // one character of 6001 bytes: an accent stacked 3000 times
const escaped = (n: number) => '"\\\u0001'.repeat(Math.ceil(n / 3)).slice(0, n); // characters JSON writes as 2 to 6 bytes
const card = (title: string, detail: string, recommended: string): CardPart => ({
  title, detail, answerKey: "A".repeat(43),
  card: { type: "brief", recommended: 2, options: [{ number: 1, title: "One", prioritizes: "speed" }, { number: 2, title: recommended, prioritizes: "care" }], markdown: "## Options\n\n## Recommendation: B\n" },
});
const worst: [string, CardPart, Omit<IdentityPart, "answerKey">][] = [
  ["every field at its limit in four-byte characters", card(four(100), four(280), four(280)), { app: four(60), project: four(60), machine: four(60) }],
  ["every field at its limit in characters JSON escapes", card(escaped(100), escaped(280), escaped(280)), { app: escaped(60), project: escaped(60), machine: escaped(60) }],
  ["a single character of 6001 bytes in every field", card(heavy, heavy, heavy), { app: heavy, project: heavy, machine: heavy }],
];

describe("a preview", () => {
  it.each(worst)("fits Apple's alert once sealed, shortened as it must be: %s", (_, c, who) => {
    const d = decisionPreview(c, who), a = acknowledgementPreview({ nextSteps: c.detail ?? "Done." }, who, c.title);
    expect(Schema.is(DecisionPreview)(d) && Schema.is(AcknowledgementPreview)(a)).toBe(true);
    expect(Math.max(bytes(d), bytes(a))).toBeLessThanOrEqual(PREVIEW_MAX_BYTES);
    expect(new TextEncoder().encode(sealedIn("decisionPreview", d)).length).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(sealedIn("acknowledgementPreview", a)).length).toBeLessThanOrEqual(4096);
  });
  it("leaves the rest of Apple's 4096 bytes for the alert's own words", () => {
    expect(envelopeCharacters(PREVIEW_MAX_BYTES)).toBe(2812);
    expect(new TextEncoder().encode(payload("x".repeat(2812))).length).toBeLessThan(3300);
  });
  it("is the card's own words when they fit, with the recommended option and who asked", () => {
    const c = card("Ship it?", "Both plans are ready.", "Ship tomorrow");
    expect(decisionPreview(c, { app: "Codex", project: "site", machine: "pro" })).toEqual({
      title: "Ship it?", detail: "Both plans are ready.", recommended: { letter: "B", title: "Ship tomorrow" }, app: "Codex", project: "site", machine: "pro",
    });
    expect(decisionPreview({ ...c, detail: undefined, card: { ...c.card, recommended: undefined, markdown: "## Options\n" } }, { app: "Codex", project: "site" })).toEqual({ title: "Ship it?", app: "Codex", project: "site" });
    expect(acknowledgementPreview({ nextSteps: "Merging now." }, { app: "Codex", project: "site", machine: "pro" }, "Ship it?")).toEqual({ nextSteps: "Merging now.", app: "Codex", project: "site", title: "Ship it?" });
  });
  it("is shortened detail first, by whole characters, ending in …", () => {
    const family = "👨‍👩‍👧";
    const d = decisionPreview(card("Ship it?", family.repeat(280), "Ship tomorrow"), { app: "Codex", project: "site" });
    expect(d.title).toBe("Ship it?");
    expect(d.recommended?.title).toBe("Ship tomorrow");
    expect(d.detail?.endsWith("…")).toBe(true);
    expect(d.detail?.slice(0, -1)).toBe(family.repeat(characters(d.detail ?? "") - 1));
    expect(bytes(d)).toBeLessThanOrEqual(PREVIEW_MAX_BYTES);
    expect(bytes(d)).toBeGreaterThan(PREVIEW_MAX_BYTES - 20);
  });
});
