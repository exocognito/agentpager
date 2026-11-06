// Writes vectors/envelope.json, the test vectors every implementation of the encrypted-part format must pass: the
// command's (envelope.ts, under Node and Bun) and the phone's (packages/ios/AgentPagerCrypto). Run it with
//   node --experimental-strip-types packages/contract/vectors/generate.ts
// It doesn't use envelope.ts: it builds each envelope again from the format as written there, with WebCrypto, so the
// file is a second reading of the format, not a copy of one implementation's output. Every input comes from a fixed
// seed, so running it again writes the same file; envelope.test.ts checks that it does.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { acknowledgementPreview, decisionPreview, decodePart, encodePart, PREVIEW_MAX_BYTES, type CardPart, type IdentityPart, type ShapedKind } from "../parts.ts";

const subtle = globalThis.crypto.subtle;
type Bytes = Uint8Array<ArrayBuffer>;
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const unhex = (h: string): Bytes => new Uint8Array(Buffer.from(h, "hex"));
const utf8 = (s: string): Bytes => new TextEncoder().encode(s);
const join = (...parts: Uint8Array[]): Bytes => new Uint8Array(Buffer.concat(parts));
const seed = (label: string, n = 32): Bytes => new Uint8Array(createHash("sha256").update(`agentpager envelope vectors: ${label}`).digest().subarray(0, n));

// The format, as envelope.ts states it.
const VERSION = 1;
const KINDS = { card: 1, attachment: 2, identity: 3, acknowledgement: 4, answer: 5, decisionPreview: 6, acknowledgementPreview: 7 } as const;
type Kind = keyof typeof KINDS;
type Context = { pagerId: string; decisionId?: string; index?: number };
const PKCS8 = unhex("302e020100300506032b656e04220420");
const infoOf = (kind: Kind, ephemeral: Bytes, recipient: Bytes) => join(utf8("agentpager/v1/part"), Uint8Array.of(KINDS[kind]), ephemeral, recipient);
const aadOf = (kind: Kind, c: Context) => join(
  Uint8Array.of(VERSION, KINDS[kind]), unhex(c.pagerId),
  c.decisionId === undefined ? new Uint8Array() : utf8(c.decisionId),
  c.index === undefined ? new Uint8Array() : Uint8Array.of(c.index),
);
async function publicOf(privateKey: Bytes) {
  const key = await subtle.importKey("pkcs8", join(PKCS8, privateKey), { name: "X25519" }, true, ["deriveBits"]);
  const jwk = await subtle.exportKey("jwk", key);
  return new Uint8Array(Buffer.from(jwk.x ?? "", "base64url"));
}
async function x25519(privateKey: Bytes, publicKey: Bytes) {
  const priv = await subtle.importKey("pkcs8", join(PKCS8, privateKey), { name: "X25519" }, false, ["deriveBits"]);
  const pub = await subtle.importKey("raw", publicKey, { name: "X25519" }, false, []);
  return new Uint8Array(await subtle.deriveBits({ name: "X25519", public: pub }, priv, 256));
}
async function hkdf(shared: Bytes, salt: Bytes, info: Bytes) {
  const ikm = await subtle.importKey("raw", shared, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, ikm, 256));
}
async function gcm(key: Bytes, nonce: Bytes, aad: Bytes, plaintext: Bytes) {
  const k = await subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  return new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: 128 }, k, plaintext));
}
// One envelope from its parts. `shared` replaces the agreement only for the low-order vectors, whose secret is zero.
async function build(kind: Kind, context: Context, recipientPublic: Bytes, ephemeralPrivate: Bytes, nonce: Bytes, plaintext: Bytes, shared?: { ephemeral: Bytes; secret: Bytes }) {
  const ephemeral = shared?.ephemeral ?? await publicOf(ephemeralPrivate);
  const secret = shared?.secret ?? await x25519(ephemeralPrivate, recipientPublic);
  const info = infoOf(kind, ephemeral, recipientPublic), aad = aadOf(kind, context);
  const key = await hkdf(secret, nonce, info);
  const envelope = b64(join(Uint8Array.of(VERSION), ephemeral, nonce, await gcm(key, nonce, aad, plaintext)));
  return { ephemeral, secret, info, aad, key, envelope };
}

// Keys. The pager's and the first one-time key are RFC 7748 §6.1's, so the first vector's shared secret is the RFC's.
const RFC_PRIVATE = { alice: "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a", bob: "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb" };
const RFC_SHARED = "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742";
const pagerKey = unhex(RFC_PRIVATE.bob), agentKey = seed("agent key"), otherKey = seed("another pager's key");
// Every point of small order on Curve25519, and the same with the top bit set, which X25519 ignores: any key agrees a
// zero secret with each.
const LOW_ORDER = [
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0100000000000000000000000000000000000000000000000000000000000000",
  "e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800",
  "5f9c95bca3508c24b1d0b1559c83ef5b04445cc4581c8e86d8224eddd09f1157",
  "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
  "eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
];
const LOW_ORDER_HIGH_BIT = LOW_ORDER.map(h => h.slice(0, 62) + (parseInt(h.slice(62), 16) | 0x80).toString(16).padStart(2, "0"));

const pagerId = hex(seed("pager id", 16)), otherPagerId = hex(seed("another pager id", 16));
const decisionId = b64(seed("decision id", 24)), otherDecisionId = b64(seed("another decision id", 24));

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Plaintexts: one real part of each kind, and the format's edges (empty, a byte or two, multi-KB, non-ASCII).
const PNG: Bytes = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const page = "# 背景 · Background\n\n" + Array.from({ length: 60 }, (_, i) => `${i + 1}. この計画は安全で、速く、読みやすいです — café ☕️ 👨‍👩‍👧 Ünïcödé.`).join("\n") + "\n";
const card: CardPart = {
  title: "Ship the 二つの計画 rollout? 🚀",
  detail: "Both plans are ready; B waits a day for the café crowd ☕️.",
  card: {
    type: "brief",
    options: [
      { number: 1, title: "Ship today", label: "Today", prioritizes: "speed" },
      { number: 2, title: "Ship tomorrow after the dry run", label: "Tomorrow", prioritizes: "safety" },
    ],
    recommended: 2,
    markdown: "## Context: 二つの計画 🚀\nBoth plans are ready. See ![the diagram](diagram.png) and [the background](background.md).\n\n## Options\n\n## Recommendation: B\n**Why:** It is safer — and café-tested ☕️.\n",
  },
  attachments: [{ name: "diagram.png", type: "image/png" }, { name: "background.md", type: "text/markdown" }],
  answerKey: "",
};
const longCard: CardPart = {
  title: "長い説明のカード",
  card: {
    type: "brief",
    options: [1, 2, 3, 4].map(number => ({ number, title: `計画 ${number} 👨‍👩‍👧`, prioritizes: ["速さ", "安全", "費用", "読みやすさ"][number - 1] })),
    markdown: "## Context: 長い説明\n" + "この計画は安全で、速く、そして読みやすいです。👨‍👩‍👧 Ünïcödé — ".repeat(120) + "\n\n## Options\n",
  },
  answerKey: "",
};
const identity: IdentityPart = { app: "Claude Code", project: "agentpager", machine: "pro" };
const identityNoMachine: IdentityPart = { app: "Codex", project: "日本語プロジェクト" };
const ack = { nextSteps: "Merging now; I'll report back with the pull request." };

type Valid = { name: string; kind: Kind; context: Context; recipient: Bytes; ephemeral: Bytes; nonce: Bytes; plaintext: Bytes; part: boolean };

export async function vectors(): Promise<string> {
  const answerKey = b64(await publicOf(agentKey));
  const cards = { card: { ...card, answerKey }, longCard: { ...longCard, answerKey } };
  const part = <K extends ShapedKind>(kind: K, value: Parameters<typeof encodePart<K>>[1]): Bytes => new Uint8Array(encodePart(kind, value));
  const ofDecision = { pagerId, decisionId };
  const slot = (index: number) => ({ pagerId, decisionId, index });
  const valid: Valid[] = [
    { name: "card, RFC 7748 keys, non-ASCII, with attachments", kind: "card", context: ofDecision, recipient: pagerKey, ephemeral: unhex(RFC_PRIVATE.alice), nonce: seed("nonce 1", 12), plaintext: part("card", cards.card), part: true },
    { name: "card, multi-KB non-ASCII brief, four options", kind: "card", context: ofDecision, recipient: pagerKey, ephemeral: seed("ephemeral 2"), nonce: seed("nonce 2", 12), plaintext: part("card", cards.longCard), part: true },
    { name: "attachment 0, a PNG", kind: "attachment", context: slot(0), recipient: pagerKey, ephemeral: seed("ephemeral 3"), nonce: seed("nonce 3", 12), plaintext: PNG, part: false },
    { name: "attachment 1, a multi-KB non-ASCII page", kind: "attachment", context: slot(1), recipient: pagerKey, ephemeral: seed("ephemeral 4"), nonce: seed("nonce 4", 12), plaintext: utf8(page), part: false },
    { name: "attachment 7, empty", kind: "attachment", context: slot(7), recipient: pagerKey, ephemeral: seed("ephemeral 5"), nonce: seed("nonce 5", 12), plaintext: new Uint8Array(), part: false },
    { name: "attachment 2, one byte", kind: "attachment", context: slot(2), recipient: pagerKey, ephemeral: seed("ephemeral 6"), nonce: seed("nonce 6", 12), plaintext: Uint8Array.of(0), part: false },
    { name: "attachment 3, two bytes", kind: "attachment", context: slot(3), recipient: pagerKey, ephemeral: seed("ephemeral 7"), nonce: seed("nonce 7", 12), plaintext: Uint8Array.of(0xff, 0xfe), part: false },
    { name: "identity, with machine", kind: "identity", context: { pagerId }, recipient: pagerKey, ephemeral: seed("ephemeral 8"), nonce: seed("nonce 8", 12), plaintext: part("identity", identity), part: true },
    { name: "identity, non-ASCII project, no machine", kind: "identity", context: { pagerId }, recipient: pagerKey, ephemeral: seed("ephemeral 9"), nonce: seed("nonce 9", 12), plaintext: part("identity", identityNoMachine), part: true },
    { name: "acknowledgement", kind: "acknowledgement", context: ofDecision, recipient: pagerKey, ephemeral: seed("ephemeral 10"), nonce: seed("nonce 10", 12), plaintext: part("acknowledgement", ack), part: true },
    { name: "answer, an option, to the card's answer key", kind: "answer", context: ofDecision, recipient: agentKey, ephemeral: seed("ephemeral 11"), nonce: seed("nonce 11", 12), plaintext: part("answer", { choice: { kind: "option", number: 2 } }), part: true },
    { name: "answer, non-ASCII feedback", kind: "answer", context: ofDecision, recipient: agentKey, ephemeral: seed("ephemeral 12"), nonce: seed("nonce 12", 12), plaintext: part("answer", { choice: { kind: "feedback", text: "Shorter please — keep the café ☕️ and 日本語." } }), part: true },
    { name: "decision preview", kind: "decisionPreview", context: ofDecision, recipient: pagerKey, ephemeral: seed("ephemeral 13"), nonce: seed("nonce 13", 12), plaintext: part("decisionPreview", decisionPreview(cards.card, identity)), part: true },
    { name: "acknowledgement preview", kind: "acknowledgementPreview", context: ofDecision, recipient: pagerKey, ephemeral: seed("ephemeral 14"), nonce: seed("nonce 14", 12), plaintext: part("acknowledgementPreview", acknowledgementPreview(ack, identity, card.title)), part: true },
  ];

  const seal = [];
  const built = new Map<string, Awaited<ReturnType<typeof build>> & { v: Valid }>();
  for (const v of valid) {
    const recipientPublic = await publicOf(v.recipient);
    const b = await build(v.kind, v.context, recipientPublic, v.ephemeral, v.nonce, v.plaintext);
    built.set(v.name, { ...b, v });
    seal.push({
      name: v.name, kind: v.kind, context: v.context, part: v.part,
      recipientPrivateKey: b64(v.recipient), recipientPublicKey: b64(recipientPublic),
      ephemeralPrivateKey: b64(v.ephemeral), ephemeralPublicKey: b64(b.ephemeral), nonce: b64(v.nonce),
      plaintext: b64(v.plaintext),
      sharedSecret: hex(b.secret), info: hex(b.info), key: hex(b.key), aad: hex(b.aad),
      envelope: b.envelope,
    });
  }
  if (seal[0].sharedSecret !== RFC_SHARED) throw new Error("the first vector's shared secret is not RFC 7748's");

  // Refused when sealing: a low-order recipient key, a key of the wrong length, or a binding the kind doesn't take.
  const pagerPublic = b64(await publicOf(pagerKey));
  const anyPlaintext = b64(utf8("{}"));
  const sealRefused = [
    ...[...LOW_ORDER, ...LOW_ORDER_HIGH_BIT].map((h, i) => ({ name: `recipient key of small order ${i + 1} (${h.slice(0, 8)}…${h.slice(-2)})`, kind: "card", context: ofDecision, recipientPublicKey: b64(unhex(h)) })),
    { name: "recipient key of 31 bytes", kind: "card", context: ofDecision, recipientPublicKey: b64(seed("short key", 31)) },
    { name: "recipient key of 33 bytes", kind: "card", context: ofDecision, recipientPublicKey: b64(join(seed("long key"), Uint8Array.of(1))) },
    { name: "card without a decision", kind: "card", context: { pagerId } },
    { name: "identity with a decision", kind: "identity", context: ofDecision },
    { name: "attachment without an index", kind: "attachment", context: ofDecision },
    { name: "attachment index 8, past the last slot", kind: "attachment", context: slot(8) },
    { name: "attachment index -1", kind: "attachment", context: slot(-1) },
    { name: "attachment index 1.5", kind: "attachment", context: slot(1.5) },
    { name: "card with an attachment index", kind: "card", context: slot(0) },
    { name: "pager id in upper case", kind: "card", context: { pagerId: pagerId.toUpperCase(), decisionId } },
    { name: "pager id of 15 bytes", kind: "card", context: { pagerId: pagerId.slice(2), decisionId } },
    { name: "decision id of 31 characters", kind: "card", context: { pagerId, decisionId: decisionId.slice(1) } },
    { name: "decision id with a character outside base64url", kind: "card", context: { pagerId, decisionId: "+" + decisionId.slice(1) } },
    { name: "context with an extra field", kind: "card", context: { ...ofDecision, agentId: decisionId } },
    { name: "unknown kind", kind: "preview", context: ofDecision },
  ].map(r => ({ recipientPublicKey: pagerPublic, plaintext: anyPlaintext, refusal: "EnvelopeError", ...r }));

  // Refused when opening: each binding changed, each region tampered, the wrong key or version, bad base64url.
  const base = built.get(valid[0].name)!, slot0 = built.get(valid[2].name)!, empty = built.get(valid[4].name)!, answer = built.get(valid[10].name)!, ident = built.get(valid[7].name)!;
  const bytesOf = (e: string) => new Uint8Array(Buffer.from(e, "base64url"));
  const flip = (e: string, at: number, mask = 0x01) => { const b = bytesOf(e); b[at < 0 ? b.length + at : at] ^= mask; return b64(b); };
  const withVersion = (e: string, v: number) => { const b = bytesOf(e); b[0] = v; return b64(b); };
  const cutTo = (e: string, n: number) => b64(bytesOf(e).subarray(0, n));
  const pagerPrivate = b64(pagerKey);
  const opened = (b: typeof base, over: Partial<{ name: string; kind: string; context: object; recipientPrivateKey: string; envelope: string; why: string }>) =>
    ({ kind: b.v.kind, context: b.v.context, recipientPrivateKey: b64(b.v.recipient), envelope: b.envelope, refusal: "EnvelopeError", ...over });
  // Sealed as a valid part would be, but with a low-order one-time key: the secret is zero, so only the zero check
  // refuses it.
  const lowOrder = async (h: string) => build("card", ofDecision, await publicOf(pagerKey), new Uint8Array(32), seed(`nonce low ${h}`, 12), base.v.plaintext, { ephemeral: unhex(h), secret: new Uint8Array(32) });
  const lowZero = await lowOrder(LOW_ORDER[0]), lowEight = await lowOrder(LOW_ORDER[2]), lowHigh = await lowOrder(LOW_ORDER_HIGH_BIT[3]);
  const sealed = bytesOf(base.envelope).length;
  const standard = Buffer.from(base.envelope, "base64url").toString("base64").replace(/=+$/, "");
  if (standard === base.envelope) throw new Error("pick a base envelope with - or _ in it");
  // A length that isn't a multiple of 3 leaves spare bits in the last character; setting one decodes to the same bytes.
  const spared = [...built.values()].find(b => bytesOf(b.envelope).length % 3 !== 0);
  if (!spared) throw new Error("no vector's length leaves spare bits");
  const nonCanonical = spared.envelope.slice(0, -1) + ALPHABET[ALPHABET.indexOf(spared.envelope.at(-1) ?? "A") | 1];
  const openRefused = [
    opened(base, { name: "card opened as an acknowledgement", kind: "acknowledgement", why: "kind" }),
    opened(base, { name: "card opened as an answer", kind: "answer", why: "kind" }),
    opened(base, { name: "card opened as a decision preview", kind: "decisionPreview", why: "kind" }),
    opened(base, { name: "card opened as an acknowledgement preview", kind: "acknowledgementPreview", why: "kind" }),
    opened(base, { name: "card opened as attachment 0", kind: "attachment", context: slot(0), why: "kind" }),
    opened(slot0, { name: "attachment 0 opened as a card", kind: "card", context: ofDecision, why: "kind" }),
    opened(ident, { name: "identity opened as a card", kind: "card", context: ofDecision, why: "kind" }),
    opened(base, { name: "card opened for another pager", context: { pagerId: otherPagerId, decisionId }, why: "pager" }),
    opened(base, { name: "card opened for another decision", context: { pagerId, decisionId: otherDecisionId }, why: "decision" }),
    opened(ident, { name: "identity opened for another pager", context: { pagerId: otherPagerId }, why: "pager" }),
    opened(slot0, { name: "attachment 0 opened as attachment 1", context: slot(1), why: "slot" }),
    opened(slot0, { name: "attachment 0 opened for another decision", context: { pagerId, decisionId: otherDecisionId, index: 0 }, why: "decision" }),
    opened(answer, { name: "answer opened for another decision", context: { pagerId, decisionId: otherDecisionId }, why: "decision" }),
    opened(base, { name: "card opened with another pager's key", recipientPrivateKey: b64(otherKey), why: "recipient" }),
    opened(answer, { name: "answer opened with the pager's key", recipientPrivateKey: pagerPrivate, why: "recipient" }),
    opened(base, { name: "version 0", envelope: withVersion(base.envelope, 0), why: "version" }),
    opened(base, { name: "version 2", envelope: withVersion(base.envelope, 2), why: "version" }),
    opened(base, { name: "version 255", envelope: withVersion(base.envelope, 255), why: "version" }),
    opened(base, { name: "one-time key, first byte flipped", envelope: flip(base.envelope, 1), why: "tampered" }),
    opened(base, { name: "one-time key, top bit flipped (X25519 ignores it, the key derivation doesn't)", envelope: flip(base.envelope, 32, 0x80), why: "tampered" }),
    opened(base, { name: "nonce, first byte flipped", envelope: flip(base.envelope, 33), why: "tampered" }),
    opened(base, { name: "nonce, last byte flipped", envelope: flip(base.envelope, 44), why: "tampered" }),
    opened(base, { name: "ciphertext, first byte flipped", envelope: flip(base.envelope, 45), why: "tampered" }),
    opened(base, { name: "ciphertext, last byte flipped", envelope: flip(base.envelope, -17), why: "tampered" }),
    opened(base, { name: "tag, first byte flipped", envelope: flip(base.envelope, -16), why: "tampered" }),
    opened(base, { name: "tag, last byte flipped", envelope: flip(base.envelope, -1, 0x80), why: "tampered" }),
    opened(base, { name: "truncated by one byte", envelope: cutTo(base.envelope, sealed - 1), why: "truncated" }),
    opened(base, { name: "tag removed", envelope: cutTo(base.envelope, sealed - 16), why: "truncated" }),
    opened(base, { name: "header only", envelope: cutTo(base.envelope, 45), why: "truncated" }),
    opened(base, { name: "the version byte alone", envelope: cutTo(base.envelope, 1), why: "truncated" }),
    opened(empty, { name: "empty part truncated to 60 bytes", envelope: cutTo(empty.envelope, 60), why: "truncated" }),
    opened(base, { name: "empty string", envelope: "", why: "truncated" }),
    opened(base, { name: "a byte appended", envelope: b64(join(bytesOf(base.envelope), Uint8Array.of(0))), why: "padded" }),
    opened(base, { name: "with = padding", envelope: base.envelope + "=", why: "padded" }),
    opened(base, { name: "with == padding", envelope: base.envelope + "==", why: "padded" }),
    opened(spared, { name: "a spare bit set in the last character", envelope: nonCanonical, why: "not canonical" }),
    opened(base, { name: "standard base64 alphabet", envelope: standard, why: "not base64url" }),
    opened(base, { name: "a newline inside", envelope: base.envelope.slice(0, 40) + "\n" + base.envelope.slice(40), why: "not base64url" }),
    opened(base, { name: "a trailing newline", envelope: base.envelope + "\n", why: "not base64url" }),
    opened(base, { name: "a leading space", envelope: " " + base.envelope, why: "not base64url" }),
    opened(base, { name: "one-time key of the other part spliced in", envelope: b64(join(bytesOf(base.envelope).subarray(0, 1), bytesOf(slot0.envelope).subarray(1, 33), bytesOf(base.envelope).subarray(33))), why: "tampered" }),
    opened(base, { name: "one-time key all zero, sealed with the zero secret", envelope: lowZero.envelope, why: "low order" }),
    opened(base, { name: "one-time key of order 8, sealed with the zero secret", envelope: lowEight.envelope, why: "low order" }),
    opened(base, { name: "one-time key of order 8 with its top bit set, sealed with the zero secret", envelope: lowHigh.envelope, why: "low order" }),
    opened(ident, { name: "identity opened with a decision", context: ofDecision, kind: "identity", why: "context" }),
    opened(slot0, { name: "attachment opened without an index", context: ofDecision, why: "context" }),
    opened(base, { name: "unknown kind", kind: "preview", why: "context" }),
    opened(base, { name: "private key of 31 bytes", recipientPrivateKey: b64(pagerKey.subarray(0, 31)), why: "recipient" }),
  ];

  // Plaintexts both sides decode as their kind's shape, and ones both refuse.
  const json = (value: unknown) => b64(utf8(JSON.stringify(value)));
  const four = (n: number) => "𝄞".repeat(n); // four UTF-8 bytes, one character
  const crowded = decisionPreview(
    { ...cards.card, title: four(100), detail: four(280), card: { ...cards.card.card, options: [cards.card.card.options[0], { ...cards.card.card.options[1], title: four(280) }] } },
    { app: four(60), project: four(60), machine: four(60) },
  );
  const partsValid = [
    ...seal.filter(s => s.part).map(s => ({ name: s.name, kind: s.kind, plaintext: s.plaintext })),
    { name: "card, no detail, no attachments, no recommendation", kind: "card", plaintext: json({ title: "Pick one", card: { type: "brief", options: [{ number: 1, title: "A plan", prioritizes: "speed" }, { number: 2, title: "B plan", prioritizes: "care" }], markdown: "## Options\n" }, answerKey }) },
    { name: "card, keys in another order", kind: "card", plaintext: json({ answerKey, card: { markdown: "## Options\n", options: [{ prioritizes: "speed", title: "A plan", number: 1 }, { prioritizes: "care", title: "B plan", number: 2 }], type: "brief" }, title: "Pick one" }) },
    { name: "answer as the phone encodes it, sorted keys", kind: "answer", plaintext: json({ choice: { kind: "option", number: 1 } }) },
    { name: "card recommending 2.0, a whole number", kind: "card", plaintext: b64(utf8(JSON.stringify(cards.card).replace('"recommended":2', '"recommended":2.0'))) },
    { name: "identity with spaces between its fields", kind: "identity", plaintext: b64(utf8(JSON.stringify(identity, null, 2) + "\n")) },
    { name: "decision preview shortened to fit, four-byte characters", kind: "decisionPreview", plaintext: json(crowded) },
    { name: "decision preview, no detail, recommendation or machine", kind: "decisionPreview", plaintext: json({ title: "Pick one", app: "Codex", project: "site" }) },
    { name: "title of 100 characters, one a family emoji", kind: "acknowledgementPreview", plaintext: json({ nextSteps: "Done.", app: "Codex", project: "site", title: "x".repeat(99) + "👨‍👩‍👧" }) },
  ];
  const c = cards.card;
  const partsInvalid = [
    { name: "card with an extra field", kind: "card", plaintext: json({ ...c, decisionId }) },
    { name: "card with an extra field in an option", kind: "card", plaintext: json({ ...c, card: { ...c.card, options: [{ ...c.card.options[0], emoji: "📨" }, c.card.options[1]] } }) },
    { name: "card of another type", kind: "card", plaintext: json({ ...c, card: { ...c.card, type: "generic" } }) },
    { name: "card with five options", kind: "card", plaintext: json({ ...c, card: { ...c.card, recommended: undefined, markdown: "## Options\n", options: [1, 2, 3, 4, 5].map(number => ({ number, title: "x", prioritizes: "y" })) }, attachments: undefined }) },
    { name: "card with options numbered 1 and 3", kind: "card", plaintext: json({ ...c, card: { ...c.card, options: [c.card.options[0], { ...c.card.options[1], number: 3 }], recommended: 1 } }) },
    { name: "card recommending an option it doesn't offer", kind: "card", plaintext: json({ ...c, card: { ...c.card, recommended: 3 } }) },
    { name: "card title of 101 characters", kind: "card", plaintext: json({ ...c, title: "x".repeat(101) }) },
    { name: "card detail null", kind: "card", plaintext: json({ ...c, detail: null }) },
    { name: "card without an answer key", kind: "card", plaintext: json({ ...c, answerKey: undefined }) },
    { name: "card answer key of 42 characters", kind: "card", plaintext: json({ ...c, answerKey: answerKey.slice(1) }) },
    { name: "card answer key not canonical", kind: "card", plaintext: json({ ...c, answerKey: answerKey.slice(0, 42) + ALPHABET[ALPHABET.indexOf(answerKey[42]) | 1] }) },
    { name: "card attachment of another type", kind: "card", plaintext: json({ ...c, attachments: [{ name: "diagram.gif", type: "image/gif" }, c.attachments?.[1]] }) },
    { name: "card attachment named against its type", kind: "card", plaintext: json({ ...c, attachments: [{ name: "diagram.png", type: "image/jpeg" }, c.attachments?.[1]] }) },
    { name: "card attachment name with a slash", kind: "card", plaintext: json({ ...c, attachments: [{ name: "a/diagram.png", type: "image/png" }, c.attachments?.[1]] }) },
    { name: "card with nine attachments", kind: "card", plaintext: json({ ...c, attachments: [...c.attachments ?? [], ...Array.from({ length: 7 }, (_, i) => ({ name: `extra${i}.md`, type: "text/markdown" }))] }) },
    { name: "card naming one attachment twice", kind: "card", plaintext: json({ ...c, attachments: [c.attachments?.[0], c.attachments?.[0], c.attachments?.[1]] }) },
    { name: "card option number as a string", kind: "card", plaintext: json({ ...c, card: { ...c.card, options: [{ ...c.card.options[0], number: "1" }, c.card.options[1]] } }) },
    { name: "card blank markdown", kind: "card", plaintext: json({ ...c, card: { ...c.card, markdown: " \n " } }) },
    { name: "identity without a project", kind: "identity", plaintext: json({ app: "Codex" }) },
    { name: "identity app of 61 characters", kind: "identity", plaintext: json({ app: "x".repeat(61), project: "site" }) },
    { name: "identity machine blank", kind: "identity", plaintext: json({ app: "Codex", project: "site", machine: "  " }) },
    { name: "identity app a byte-order mark only", kind: "identity", plaintext: json({ app: "﻿", project: "site" }) },
    { name: "answer of an unknown kind", kind: "answer", plaintext: json({ choice: { kind: "maybe" } }) },
    { name: "answer option 0", kind: "answer", plaintext: json({ choice: { kind: "option", number: 0 } }) },
    { name: "answer option 5", kind: "answer", plaintext: json({ choice: { kind: "option", number: 5 } }) },
    { name: "answer option 1.5", kind: "answer", plaintext: json({ choice: { kind: "option", number: 1.5 } }) },
    { name: "answer option with text too", kind: "answer", plaintext: json({ choice: { kind: "option", number: 1, text: "and this" } }) },
    { name: "answer feedback of 1001 characters", kind: "answer", plaintext: json({ choice: { kind: "feedback", text: "x".repeat(1001) } }) },
    { name: "answer with a lone surrogate", kind: "answer", plaintext: b64(utf8('{"choice":{"kind":"feedback","text":"bad \\ud800 text"}}')) },
    { name: "acknowledgement of 281 characters", kind: "acknowledgement", plaintext: json({ nextSteps: "x".repeat(281) }) },
    { name: "acknowledgement with HTML", kind: "acknowledgement", plaintext: json({ nextSteps: "<b>Done</b>" }) },
    { name: "acknowledgement as an array", kind: "acknowledgement", plaintext: json([{ nextSteps: "Done." }]) },
    { name: "acknowledgement not JSON", kind: "acknowledgement", plaintext: b64(utf8("{nextSteps: Done}")) },
    { name: "acknowledgement not UTF-8", kind: "acknowledgement", plaintext: b64(join(utf8('{"nextSteps":"Done '), Uint8Array.of(0xff), utf8('"}'))) },
    { name: "empty plaintext", kind: "identity", plaintext: "" },
    { name: "identity after a UTF-8 byte-order mark", kind: "identity", plaintext: b64(join(Uint8Array.of(0xef, 0xbb, 0xbf), utf8(JSON.stringify(identity)))) },
    { name: "identity as UTF-16 with a byte-order mark", kind: "identity", plaintext: b64(join(Uint8Array.of(0xff, 0xfe), new Uint8Array(Buffer.from(JSON.stringify(identity), "utf16le")))) },
    { name: "identity as UTF-16 without one", kind: "identity", plaintext: b64(new Uint8Array(Buffer.from(JSON.stringify(identity), "utf16le"))) },
    { name: "identity with a raw NUL byte in a field", kind: "identity", plaintext: b64(join(utf8('{"app":"Co'), Uint8Array.of(0), utf8('dex","project":"site"}'))) },
    { name: "decision preview recommending E", kind: "decisionPreview", plaintext: json({ title: "Pick", recommended: { letter: "E", title: "x" }, app: "Codex", project: "site" }) },
    { name: "decision preview over the byte limit, every field within its own", kind: "decisionPreview", plaintext: json({ title: four(100), detail: four(280), recommended: { letter: "B", title: four(280) }, app: four(60), project: four(60), machine: four(60) }) },
    { name: "acknowledgement preview without its title", kind: "acknowledgementPreview", plaintext: json({ nextSteps: "Done.", app: "Codex", project: "site" }) },
    { name: "decision preview within the byte limit as JSON, over it as sent with spaces", kind: "decisionPreview", plaintext: b64(utf8(JSON.stringify(crowded, null, 40))) },
  ];

  // The generator refuses to write a file whose part vectors its own shapes disagree with.
  const decodes = (kind: string, plaintext: string) => {
    try { decodePart(kind as ShapedKind, new Uint8Array(Buffer.from(plaintext, "base64url"))); return true; } catch { return false; }
  };
  for (const p of partsValid) if (!decodes(p.kind, p.plaintext)) throw new Error(`valid part refused: ${p.name}`);
  for (const p of partsInvalid) if (decodes(p.kind, p.plaintext)) throw new Error(`invalid part accepted: ${p.name}`);
  if (Buffer.from(json(crowded), "base64url").length > PREVIEW_MAX_BYTES) throw new Error("the shortened preview doesn't fit");

  const file = {
    about: "Test vectors for the encrypted-part format (envelope.ts; packages/ios/AgentPagerCrypto). Written by vectors/generate.ts; don't edit by hand. Keys, nonces, plaintexts and envelopes are base64url without padding; sharedSecret, info, key and aad are hex, for debugging. Every refusal is the format's one error.",
    format: { version: VERSION, overheadBytes: 61, infoLabel: "agentpager/v1/part", kinds: KINDS },
    seal, sealRefused, openRefused,
    parts: { valid: partsValid, invalid: partsInvalid },
  };
  return JSON.stringify(file, null, 2) + "\n";
}

export const VECTORS_PATH = fileURLToPath(new URL("envelope.json", import.meta.url));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(VECTORS_PATH, await vectors());
  console.log(`Wrote ${VECTORS_PATH}.`);
}
