import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, diffieHellman, hkdfSync, randomBytes } from "node:crypto";
import { Schema } from "effect";
import { ENVELOPE_OVERHEAD_BYTES, PartContexts, PartKind, type PartContext } from "./parts.ts";

// The one format for every encrypted part, both ways (version 1). The sender makes a fresh X25519 key pair for each
// part and agrees a secret with the recipient's key: the pager's, or the key in the card an answer answers.
//
//   shared   = X25519(ephemeral private, recipient public)      refused when all zero (a low-order key)
//   key      = HKDF-SHA256(shared, salt = nonce, info = "agentpager/v1/part" ‖ kind ‖ ephemeral public ‖ recipient public)
//   aad      = 0x01 ‖ kind ‖ pager id (16 bytes) ‖ decision id (32 ASCII; not for identity) ‖ index (1; attachment only)
//   sealed   = AES-256-GCM(key, nonce, plaintext, aad)          ciphertext ‖ 16-byte tag
//   envelope = base64url, no padding, of 0x01 ‖ ephemeral public (32) ‖ nonce (12) ‖ sealed
//
// Kinds are one byte (KIND_CODES). The kind is bound twice, in the key and the aad; the pager, decision and slot in
// the aad, in fixed widths that the kind decides, so a part can't be opened as another kind or for another pager,
// decision or slot. Binding both public keys into the key ties it to this exchange, as ECIES and HPKE do.
//
// What it gives: only the recipient's private key opens a part, and a part opens only under its own binding. What
// it doesn't: proof of who sealed it. Anyone with a recipient's public key can seal to it, the service included, so
// an answer key that only ever travels inside cards is what keeps the service from sealing answers.
//
// The phone's mirror is packages/ios/AgentPagerCrypto; both must pass vectors/envelope.json.

export const VERSION = 1;
const INFO_LABEL = new TextEncoder().encode("agentpager/v1/part");
export const KIND_CODES: Record<PartKind, number> = {
  card: 1, attachment: 2, identity: 3, acknowledgement: 4, answer: 5, decisionPreview: 6, acknowledgementPreview: 7,
};
const KEY_BYTES = 32, NONCE_BYTES = 12, TAG_BYTES = 16;

// Every refusal to seal or open is this one error, whatever the cause, and carries nothing of the input.
export class EnvelopeError extends Error {
  readonly _tag = "EnvelopeError";
  constructor(action: "seal" | "open") {
    super(action === "seal" ? "This part can't be sealed." : "This encrypted part can't be opened.");
    this.name = "EnvelopeError";
  }
}

// base64url without padding, decoded only when canonical: the alphabet, no "=", and the spare bits zero.
export const toBase64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
export function fromBase64url(text: string): Uint8Array | null {
  if (typeof text !== "string" || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const bytes = Buffer.from(text, "base64url");
  return bytes.toString("base64url") === text ? new Uint8Array(bytes) : null;
}

// X25519 keys are 32 raw bytes, as CryptoKit's rawRepresentation is. Node takes them wrapped in DER.
const PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI = Buffer.from("302a300506032b656e032100", "hex");
const isKey = (key: unknown): key is Uint8Array => key instanceof Uint8Array && key.length === KEY_BYTES;
const privateKeyObject = (raw: Uint8Array) => createPrivateKey({ key: Buffer.concat([PKCS8, raw]), format: "der", type: "pkcs8" });
const publicKeyObject = (raw: Uint8Array) => createPublicKey({ key: Buffer.concat([SPKI, raw]), format: "der", type: "spki" });

export function publicKeyOf(privateKey: Uint8Array): Uint8Array {
  if (!isKey(privateKey)) throw new EnvelopeError("seal");
  const spki = createPublicKey(privateKeyObject(privateKey)).export({ format: "der", type: "spki" });
  return new Uint8Array(spki.subarray(SPKI.length));
}
export function keyPair(): { privateKey: Uint8Array; publicKey: Uint8Array } {
  const privateKey = new Uint8Array(randomBytes(KEY_BYTES));
  return { privateKey, publicKey: publicKeyOf(privateKey) };
}

// The library refuses a low-order key itself; the all-zero check holds whether or not it does.
function agree(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const shared = diffieHellman({ privateKey: privateKeyObject(privateKey), publicKey: publicKeyObject(publicKey) });
  if (shared.length !== KEY_BYTES || shared.every(b => b === 0)) throw new Error("low-order key");
  return new Uint8Array(shared);
}
const concat = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
function derive(shared: Uint8Array, nonce: Uint8Array, kind: PartKind, ephemeral: Uint8Array, recipient: Uint8Array) {
  return new Uint8Array(hkdfSync("sha256", shared, nonce, concat(INFO_LABEL, Uint8Array.of(KIND_CODES[kind]), ephemeral, recipient), KEY_BYTES));
}
// The aad. Throws on a kind or context the kind doesn't take: a context has exactly its kind's fields (parts.ts).
const Fields = Schema.Struct({ pagerId: Schema.String, decisionId: Schema.optional(Schema.String), index: Schema.optional(Schema.Number) });
function binding(kind: unknown, context: unknown): { kind: PartKind; aad: Uint8Array } {
  if (!Schema.is(PartKind)(kind)) throw new Error("unknown kind");
  const exact: Schema.Schema.AnyNoContext = PartContexts[kind];
  if (!Schema.is(exact, { onExcessProperty: "error" })(context)) throw new Error("context is not the kind's");
  const c = Schema.decodeUnknownSync(Fields)(context);
  const fields = [Uint8Array.of(VERSION, KIND_CODES[kind]), Buffer.from(c.pagerId, "hex")];
  if (c.decisionId !== undefined) fields.push(new TextEncoder().encode(c.decisionId));
  if (c.index !== undefined) fields.push(Uint8Array.of(c.index));
  return { kind, aad: concat(...fields) };
}

function sealWith(recipientPublicKey: Uint8Array, kind: unknown, context: unknown, plaintext: Uint8Array, ephemeralPrivateKey: Uint8Array, nonce: Uint8Array): string {
  try {
    const b = binding(kind, context);
    if (!isKey(recipientPublicKey) || !isKey(ephemeralPrivateKey) || !(nonce instanceof Uint8Array) || nonce.length !== NONCE_BYTES || !(plaintext instanceof Uint8Array)) throw new Error("bad input");
    const ephemeral = publicKeyOf(ephemeralPrivateKey);
    const key = derive(agree(ephemeralPrivateKey, recipientPublicKey), nonce, b.kind, ephemeral, recipientPublicKey);
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
    cipher.setAAD(b.aad);
    const sealed = concat(cipher.update(plaintext), cipher.final(), cipher.getAuthTag());
    return toBase64url(concat(Uint8Array.of(VERSION), ephemeral, nonce, sealed));
  } catch { throw new EnvelopeError("seal"); }
}

// Seals plaintext for the holder of the recipient's private key, bound to its kind and context.
export function seal<K extends PartKind>(recipientPublicKey: Uint8Array, kind: K, context: PartContext<K>, plaintext: Uint8Array): string {
  return sealWith(recipientPublicKey, kind, context, plaintext, new Uint8Array(randomBytes(KEY_BYTES)), new Uint8Array(randomBytes(NONCE_BYTES)));
}

// Opens an encrypted part sealed to this private key under the same kind and context, or throws EnvelopeError. The
// plaintext is returned only once the tag checks: nothing of a part that fails is returned.
export function open<K extends PartKind>(recipientPrivateKey: Uint8Array, kind: K, context: PartContext<K>, envelope: string): Uint8Array {
  try {
    const b = binding(kind, context);
    const bytes = fromBase64url(envelope);
    if (!bytes || bytes.length < ENVELOPE_OVERHEAD_BYTES || bytes[0] !== VERSION || !isKey(recipientPrivateKey)) throw new Error("not an envelope");
    const ephemeral = bytes.subarray(1, 1 + KEY_BYTES), nonce = bytes.subarray(1 + KEY_BYTES, 1 + KEY_BYTES + NONCE_BYTES);
    const ciphertext = bytes.subarray(1 + KEY_BYTES + NONCE_BYTES, bytes.length - TAG_BYTES), tag = bytes.subarray(bytes.length - TAG_BYTES);
    const key = derive(agree(recipientPrivateKey, ephemeral), nonce, b.kind, ephemeral, publicKeyOf(recipientPrivateKey));
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(b.aad);
    decipher.setAuthTag(tag);
    const head = decipher.update(ciphertext);
    try { return concat(head, decipher.final()); } catch (error) { head.fill(0); throw error; }
  } catch { throw new EnvelopeError("open"); }
}

// For vectors/envelope.json only: sealing with a given one-time key and nonce, so a test can check the bytes. A
// test (envelope.test.ts) fails if anything but the vector tests and their Bun check names it.
export const sealForTestVectors = sealWith;
