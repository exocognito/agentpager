// Runs vectors/envelope.json against envelope.ts and parts.ts and says what failed. The Node tests run it in
// process (envelope.test.ts), and check.ts compiles it with Bun as the agentpager command is compiled, so both
// runtimes the command meets are held to the same vectors.
import { EnvelopeError, fromBase64url, KIND_CODES, open, publicKeyOf, seal, sealForTestVectors, toBase64url } from "../envelope.ts";
import { decodePart, encodePart, PartInvalid, PART_KINDS, PartShapes, type PartContext, type PartKind, type ShapedKind } from "../parts.ts";

type Context = { pagerId: string; decisionId?: string; index?: number };
export type Vectors = {
  format: { version: number; overheadBytes: number; infoLabel: string; kinds: Record<string, number> };
  seal: { name: string; kind: string; context: Context; part: boolean; recipientPrivateKey: string; recipientPublicKey: string; ephemeralPrivateKey: string; ephemeralPublicKey: string; nonce: string; plaintext: string; envelope: string }[];
  sealRefused: { name: string; kind: string; context: object; recipientPublicKey: string; plaintext: string; refusal: string }[];
  openRefused: { name: string; kind: string; context: object; recipientPrivateKey: string; envelope: string; refusal: string; why: string }[];
  parts: { valid: { name: string; kind: string; plaintext: string }[]; invalid: { name: string; kind: string; plaintext: string }[] };
};
export type Report = { sealed: number; opened: number; sealRefused: number; openRefused: number; partsDecoded: number; partsRefused: number; failures: string[] };

// Vector fields are base64url as the file writes it; one that isn't is the vector's fault, so it fails loudly.
const bytes = (text: string) => {
  const b = fromBase64url(text);
  if (!b) throw new Error(`not canonical base64url in the vectors: ${text.slice(0, 20)}`);
  return b;
};
// seal and open are typed by kind, and check kind and context again at run time; a vector's are file data, some
// deliberately wrong, so they are passed as typed and left to that check.
const as = (kind: string, context: object) => [kind as PartKind, context as PartContext<PartKind>] as const;
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const shaped = (kind: string): kind is ShapedKind => kind in PartShapes;
// Only EnvelopeError counts as a refusal; any other error, or a result, is a failure.
function refuses(run: () => unknown): string | undefined {
  try { run(); return "was not refused"; } catch (error) { return error instanceof EnvelopeError ? undefined : `threw ${error instanceof Error ? error.name : "something"}, not EnvelopeError`; }
}

export function verify(v: Vectors): Report {
  const failures: string[] = [];
  const r: Report = { sealed: 0, opened: 0, sealRefused: 0, openRefused: 0, partsDecoded: 0, partsRefused: 0, failures };
  const fail = (what: string) => failures.push(what);
  if (v.format.version !== 1 || v.format.overheadBytes !== 61) fail("format: version or overhead differs");
  if (JSON.stringify(v.format.kinds) !== JSON.stringify(KIND_CODES) || PART_KINDS.some(k => !(k in v.format.kinds))) fail("format: kind codes differ");
  for (const s of v.seal) {
    try {
      if (toBase64url(publicKeyOf(bytes(s.recipientPrivateKey))) !== s.recipientPublicKey) fail(`seal ${s.name}: recipient public key differs`);
      if (toBase64url(publicKeyOf(bytes(s.ephemeralPrivateKey))) !== s.ephemeralPublicKey) fail(`seal ${s.name}: one-time public key differs`);
      const envelope = sealForTestVectors(bytes(s.recipientPublicKey), s.kind, s.context, bytes(s.plaintext), bytes(s.ephemeralPrivateKey), bytes(s.nonce));
      if (envelope === s.envelope) r.sealed++; else fail(`seal ${s.name}: envelope differs`);
      const opened = open(bytes(s.recipientPrivateKey), ...as(s.kind, s.context), s.envelope);
      if (same(opened, bytes(s.plaintext))) r.opened++; else fail(`open ${s.name}: plaintext differs`);
      if (s.part) {
        if (!shaped(s.kind)) fail(`seal ${s.name}: part of a kind with no shape`);
        else { decodePart(s.kind, opened); r.partsDecoded++; }
      }
    } catch (error) { fail(`seal ${s.name}: ${error instanceof Error ? error.message : "failed"}`); }
  }
  for (const s of v.sealRefused) {
    const why = refuses(() => seal(bytes(s.recipientPublicKey), ...as(s.kind, s.context), bytes(s.plaintext)));
    if (why) fail(`seal refused ${s.name}: ${why}`); else r.sealRefused++;
  }
  for (const o of v.openRefused) {
    const why = refuses(() => open(bytes(o.recipientPrivateKey), ...as(o.kind, o.context), o.envelope));
    if (why) fail(`open refused ${o.name}: ${why}`); else r.openRefused++;
  }
  for (const p of v.parts.valid) {
    try {
      if (!shaped(p.kind)) throw new Error("no shape");
      const value = decodePart(p.kind, bytes(p.plaintext));
      // What decodes encodes again to a value that decodes the same.
      if (JSON.stringify(decodePart(p.kind, encodePart(p.kind, value))) !== JSON.stringify(value)) throw new Error("does not encode back");
      r.partsDecoded++;
    } catch (error) { fail(`part ${p.name}: ${error instanceof Error ? error.message : "refused"}`); }
  }
  for (const p of v.parts.invalid) {
    try {
      if (!shaped(p.kind)) throw new Error("no shape");
      decodePart(p.kind, bytes(p.plaintext));
      fail(`invalid part ${p.name}: was not refused`);
    } catch (error) { if (error instanceof PartInvalid) r.partsRefused++; else fail(`invalid part ${p.name}: threw ${error instanceof Error ? error.message : "something"}, not PartInvalid`); }
  }
  return r;
}
