import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EnvelopeError, fromBase64url, keyPair, open, publicKeyOf, seal, sealForTestVectors, toBase64url } from "./envelope.ts";
import { envelopeCharacters, ENVELOPE_OVERHEAD_BYTES, PART_KINDS, type PartContext, type PartKind } from "./parts.ts";
import { ATTACHMENTS_MAX, ATTACHMENTS_MAX_BYTES, IMAGE_MAX_BYTES } from "./brief.ts";
import { verify, type Vectors } from "./vectors/verify.ts";
import { vectors as generate, VECTORS_PATH } from "./vectors/generate.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const text = readFileSync(VECTORS_PATH, "utf8");
const v: Vectors = JSON.parse(text);
const bytes = (b64: string) => fromBase64url(b64) ?? new Uint8Array(1);
// Vector kinds and contexts are file data, some deliberately wrong; seal and open check them at run time.
const as = (kind: string, context: object) => [kind as PartKind, context as PartContext<PartKind>] as const;
const refusal = (run: () => unknown) => { try { run(); return "accepted"; } catch (error) { return error instanceof EnvelopeError ? "EnvelopeError" : String(error); } };

describe("the vectors", () => {
  it("are what vectors/generate.ts writes, from the format as written and not from envelope.ts", async () => {
    expect(await generate()).toBe(text);
  });
  it.each(v.seal)("seal to the same bytes, and open: $name", s => {
    expect(toBase64url(publicKeyOf(bytes(s.recipientPrivateKey)))).toBe(s.recipientPublicKey);
    expect(sealForTestVectors(bytes(s.recipientPublicKey), s.kind, s.context, bytes(s.plaintext), bytes(s.ephemeralPrivateKey), bytes(s.nonce))).toBe(s.envelope);
    expect(toBase64url(open(bytes(s.recipientPrivateKey), ...as(s.kind, s.context), s.envelope))).toBe(s.plaintext);
    expect(bytes(s.envelope).length).toBe(bytes(s.plaintext).length + ENVELOPE_OVERHEAD_BYTES);
    expect(s.envelope.length).toBe(envelopeCharacters(bytes(s.plaintext).length));
  });
  it.each(v.sealRefused)("refuse to seal: $name", s => {
    expect(refusal(() => seal(bytes(s.recipientPublicKey), ...as(s.kind, s.context), bytes(s.plaintext)))).toBe(s.refusal);
  });
  it.each(v.openRefused)("refuse to open: $name", o => {
    expect(refusal(() => open(bytes(o.recipientPrivateKey), ...as(o.kind, o.context), o.envelope))).toBe(o.refusal);
  });
  it("cover every kind, in sealing and opening", () => {
    expect(new Set(v.seal.map(s => s.kind))).toEqual(new Set(PART_KINDS));
    expect(new Set(v.openRefused.map(o => o.why))).toEqual(new Set(["kind", "pager", "decision", "slot", "recipient", "version", "tampered", "truncated", "padded", "not canonical", "not base64url", "low order", "context"]));
  });
  it("pass in full under Node, through the check the Bun build runs", () => {
    expect(verify(v)).toEqual({ sealed: 14, opened: 14, sealRefused: 29, openRefused: 48, partsDecoded: 179, partsRefused: 137, failures: [] });
  });
  // The agentpager command is a Bun-compiled binary (packages/cli/scripts/build.sh): a crypto call that works in Node
  // but not in Bun would break it, so the same check is compiled the same way and run over the same file.
  it("pass in full in a Bun-compiled binary, as the agentpager command is built", () => {
    if (spawnSync("bun", ["--version"]).error) throw new Error("bun is missing: the agentpager command is compiled with Bun (packages/cli/scripts/build.sh). Install Bun to run this test.");
    const out = path.join(here, "node_modules/.cache/agentpager-vectors");
    mkdirSync(out, { recursive: true });
    execFileSync("bun", ["build", "--compile", "--minify", path.join(here, "vectors/check.ts"), "--outfile", path.join(out, "check")], { stdio: "pipe" });
    const run = spawnSync(path.join(out, "check"), [VECTORS_PATH], { encoding: "utf8" });
    const report = JSON.parse(run.stdout);
    expect(report.runtime).toMatch(/^bun /);
    expect({ ...report, runtime: undefined }).toEqual({ runtime: undefined, ...verify(v) });
    expect(run.status).toBe(0);
  }, 60_000);
});

describe("sealing", () => {
  const pager = keyPair(), agent = keyPair();
  const ofDecision = { pagerId: "0123456789abcdef0123456789abcdef", decisionId: "D".repeat(32) };
  const contexts: { [K in PartKind]: PartContext<K> } = {
    card: ofDecision, attachment: { ...ofDecision, index: 3 }, identity: { pagerId: ofDecision.pagerId }, acknowledgement: ofDecision,
    answer: ofDecision, decisionPreview: ofDecision, acknowledgementPreview: ofDecision,
  };
  it.each(PART_KINDS)("opens what it sealed, with fresh keys: %s", kind => {
    const recipient = kind === "answer" ? agent : pager, plaintext = new TextEncoder().encode(`a ${kind}, ☕️`);
    expect(open(recipient.privateKey, kind, contexts[kind], seal(recipient.publicKey, kind, contexts[kind], plaintext))).toEqual(plaintext);
  });
  it("makes a fresh one-time key and nonce for every part, even of the same plaintext", () => {
    const sealed = Array.from({ length: 200 }, () => bytes(seal(pager.publicKey, "card", ofDecision, new Uint8Array(8))));
    const ephemeral = new Set(sealed.map(b => toBase64url(b.subarray(1, 33)))), nonces = new Set(sealed.map(b => toBase64url(b.subarray(33, 45))));
    expect([ephemeral.size, nonces.size]).toEqual([200, 200]);
    expect(ephemeral.has(toBase64url(pager.publicKey))).toBe(false);
  });
  it("never puts the plaintext or the recipient's key in the envelope", () => {
    const plaintext = new TextEncoder().encode("the owner's secret plan, the owner's secret plan");
    const envelope = Buffer.from(bytes(seal(pager.publicKey, "card", ofDecision, plaintext)));
    expect(envelope.includes(Buffer.from(plaintext.subarray(0, 8)))).toBe(false);
    expect(envelope.includes(Buffer.from(pager.publicKey))).toBe(false);
  });
  it("refuses plaintext that isn't bytes", () => {
    expect(refusal(() => seal(pager.publicKey, "card", ofDecision, JSON.parse('"text"')))).toBe("EnvelopeError");
  });
});

// The service stores an attachment's envelope in one SQLite row of a Durable Object, which holds at most 2 MB
// (Cloudflare's Durable Object limits), and takes it in a request of at most 100 MB (Workers limits, Free and Pro).
describe("sizes", () => {
  const ROW_MAX_BYTES = 2_000_000, REQUEST_MAX_BYTES = 100_000_000;
  it("adds 61 bytes to a part, then base64url's third", () => {
    expect(ENVELOPE_OVERHEAD_BYTES).toBe(1 + 32 + 12 + 16);
    const pager = keyPair();
    for (const n of [0, 1, 2, 3, 1000]) expect(seal(pager.publicKey, "identity", { pagerId: "0".repeat(32) }, new Uint8Array(n)).length).toBe(envelopeCharacters(n));
  });
  it("still fits the largest image the contract allows in one row, as bytes or as text", () => {
    const pager = keyPair();
    const envelope = seal(pager.publicKey, "attachment", { pagerId: "0".repeat(32), decisionId: "D".repeat(32), index: 0 }, new Uint8Array(IMAGE_MAX_BYTES));
    expect(envelope.length).toBe(envelopeCharacters(IMAGE_MAX_BYTES));
    expect(envelope.length).toBe(1_333_415);
    expect(envelope.length).toBeLessThan(ROW_MAX_BYTES);
  });
  // A Markdown page is held to 20,000 characters, not to a byte size: only the 3 MB total bounds one page's bytes,
  // and a page over 2 MB doesn't fit one row as plaintext either. That gap is today's, not the envelope's.
  it("fits every attachment of the largest ask in one request", () => {
    const sealedAttachments = envelopeCharacters(ATTACHMENTS_MAX_BYTES) + ATTACHMENTS_MAX * envelopeCharacters(0);
    expect(sealedAttachments).toBe(4_000_738);
    expect(sealedAttachments).toBeLessThan(REQUEST_MAX_BYTES);
  });
});

// Sealing with a chosen one-time key and nonce makes the same envelope twice, so it is for the vectors alone. The
// service never seals or opens a part, so it never imports the format.
describe("reach", () => {
  const repo = path.resolve(here, "../..");
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repo, encoding: "utf8" }).split("\0").filter(f => /\.(ts|tsx|mjs|js|swift)$/.test(f));
  const naming = (pattern: RegExp) => files.filter(f => { try { return pattern.test(readFileSync(path.join(repo, f), "utf8")); } catch { return false; } }).sort();
  it("leaves sealing with a chosen key and nonce to the vector tests", () => {
    expect(naming(/sealForTestVectors/)).toEqual(["packages/contract/envelope.test.ts", "packages/contract/envelope.ts", "packages/contract/vectors/verify.ts"]);
    expect(naming(/vectors\/(verify|check)(\.ts)?['"]/)).toEqual(["packages/contract/envelope.test.ts", "packages/contract/parts.test.ts"]);
    expect(naming(/@testable\s+import\s+AgentPagerCrypto/)).toEqual(["packages/ios/AgentPagerCrypto/Tests/AgentPagerCryptoTests/EnvelopeTests.swift"]);
  });
  it("keeps the service from importing the format", () => {
    expect(naming(/envelope\.ts['"]/).filter(f => f.startsWith("packages/app/"))).toEqual([]);
  });
});
