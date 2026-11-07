import { Either, ParseResult, Schema } from "effect";
import { characters, OPTIONS_MAX, Text, Title, Token } from "./values.ts";
import { Choice, Label, PagerId, PublicKey } from "./exchange.ts";
import { ATTACHMENTS_MAX, AttachmentName, AttachmentType, attachmentTypes, letter, missingAttachment, named, Payload as BriefCard } from "./brief.ts";

// What travels encrypted between an agent's machine and the phone: each encrypted part's kind, what it is bound to,
// and the plaintext each kind holds. The format that seals and opens them is envelope.ts, which needs node:crypto;
// this module needs none, so the service can import it for a shape or size check without being able to read a part.
// The iPhone mirrors it in packages/ios/AgentPagerCrypto, and both sides read vectors/envelope.json.

// Encrypted to the pager's key: card, attachment, identity, acknowledgement and the two alert previews. Encrypted to
// the agent's key, the one its card names: answer.
export const PART_KINDS = ["card", "attachment", "identity", "acknowledgement", "answer", "decisionPreview", "acknowledgementPreview"] as const;
export const PartKind = Schema.Literal(...PART_KINDS);
export type PartKind = typeof PartKind.Type;

// What a part is bound to, besides its kind: its pager, its decision (all but identity, which is sealed at connect),
// and an attachment's slot, its place in its card's list. A part opened under any other binding is refused.
const strict = { parseOptions: { onExcessProperty: "error" as const } };
const OfPager = Schema.Struct({ pagerId: PagerId }).annotations(strict);
const OfDecision = Schema.Struct({ pagerId: PagerId, decisionId: Token }).annotations(strict);
export const AttachmentIndex = Schema.Number.pipe(Schema.int(), Schema.between(0, ATTACHMENTS_MAX - 1));
const OfAttachment = Schema.Struct({ pagerId: PagerId, decisionId: Token, index: AttachmentIndex }).annotations(strict);
export const PartContexts = {
  card: OfDecision, attachment: OfAttachment, identity: OfPager, acknowledgement: OfDecision, answer: OfDecision,
  decisionPreview: OfDecision, acknowledgementPreview: OfDecision,
} as const satisfies Record<PartKind, Schema.Schema.AnyNoContext>;
export type PartContext<K extends PartKind> = (typeof PartContexts)[K]["Type"];

// Sizes, for a check that needs no key: an encrypted part is a version byte, the sender's one-time public key (32
// bytes), a nonce (12) and the ciphertext with its tag (16), as base64url without padding.
export const ENVELOPE_OVERHEAD_BYTES = 61;
export const envelopeCharacters = (plaintextBytes: number) => Math.ceil(((plaintextBytes + ENVELOPE_OVERHEAD_BYTES) * 4) / 3);

const utf8 = new TextEncoder();
const utf8Length = (text: string) => utf8.encode(text).length;

// A Curve25519 public key whose base64url is canonical, so it names one key: 43 characters carry 258 bits, and the
// last character's 2 spare bits are zero.
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const canonicalKey = (text: string) => (BASE64URL.indexOf(text[42] ?? "") & 3) === 0 || "a public key is 32 bytes as canonical base64url";
export const AnswerKey = PublicKey.pipe(Schema.filter(canonicalKey));

// The plaintext of each kind but attachment is its shape's JSON, as UTF-8. An attachment's plaintext is the file's
// bytes, checked before sealing as today's attachment is (brief.ts AttachmentInput); its card gives its name and type.

// What a card names of each attachment, in slot order: attachment i is sealed with index i.
export const AttachmentEntry = Schema.Struct({ name: AttachmentName, type: AttachmentType }).annotations(strict).pipe(Schema.filter(named));
export type AttachmentEntry = typeof AttachmentEntry.Type;
const AttachmentEntries = Schema.Array(AttachmentEntry).pipe(
  Schema.maxItems(ATTACHMENTS_MAX),
  Schema.filter(list => new Set(list.map(a => a.name)).size === list.length || "attachment names must be unique"),
);
// A card: today's question with its attachments named, not carried, and the key the phone seals its answer to. The
// phone seals an answer only to the key in the card it answers, never to one the service hands it.
export const CardPart = Schema.Struct({
  title: Title,
  detail: Schema.optional(Text),
  card: BriefCard,
  attachments: Schema.optional(AttachmentEntries),
  answerKey: AnswerKey,
}).annotations(strict).pipe(Schema.filter(c => missingAttachment(c.card.markdown, attachmentTypes(c.attachments)) ?? true));
export type CardPart = typeof CardPart.Type;

// Who asked, the project and the computer, sealed once at connect.
export const IdentityPart = Schema.Struct({ app: Label, project: Label, machine: Schema.optional(Label) }).annotations(strict);
export type IdentityPart = typeof IdentityPart.Type;
export const AnswerPart = Schema.Struct({ choice: Choice }).annotations(strict);
export type AnswerPart = typeof AnswerPart.Type;
export const AcknowledgementPart = Schema.Struct({ nextSteps: Text }).annotations(strict);
export type AcknowledgementPart = typeof AcknowledgementPart.Type;

// An alert's preview, which the phone's alert extension opens to show the real question. Apple takes at most 4096
// bytes of payload: a preview of PREVIEW_MAX_BYTES seals to envelopeCharacters(PREVIEW_MAX_BYTES) = 2812 characters,
// leaving the rest for the alert's plain words and ids. decisionPreview() and acknowledgementPreview() shorten to fit.
export const PREVIEW_MAX_BYTES = 2048;
const fits = (preview: object) => utf8Length(JSON.stringify(preview)) <= PREVIEW_MAX_BYTES || `a preview may not exceed ${PREVIEW_MAX_BYTES} bytes as JSON`;
export const OptionLetter = Schema.Literal(...Array.from({ length: OPTIONS_MAX }, (_, i) => letter(i + 1)));
// A decision's: the question, its detail, the recommended option and who asked, from where. The service sends it
// again with the not-picked-up warning, so it carries what that alert names: who asked, the machine, the project and
// the question.
export const DecisionPreview = Schema.Struct({
  title: Title,
  detail: Schema.optional(Text),
  recommended: Schema.optional(Schema.Struct({ letter: OptionLetter, title: Text }).annotations(strict)),
  app: Label,
  project: Label,
  machine: Schema.optional(Label),
}).annotations(strict).pipe(Schema.filter(fits));
export type DecisionPreview = typeof DecisionPreview.Type;
// An acknowledgement's: the agent's next steps, who asked, the project and the question it answers.
export const AcknowledgementPreview = Schema.Struct({ nextSteps: Text, app: Label, project: Label, title: Title }).annotations(strict).pipe(Schema.filter(fits));
export type AcknowledgementPreview = typeof AcknowledgementPreview.Type;

export const PartShapes = {
  card: CardPart, identity: IdentityPart, answer: AnswerPart, acknowledgement: AcknowledgementPart,
  decisionPreview: DecisionPreview, acknowledgementPreview: AcknowledgementPreview,
} as const;
export type ShapedKind = keyof typeof PartShapes;
export type PartOf<K extends ShapedKind> = (typeof PartShapes)[K]["Type"];

// A part that isn't its kind's shape, said field by field as the service's refusals are.
export class PartInvalid extends Error {
  readonly _tag = "PartInvalid";
  readonly kind: ShapedKind;
  readonly problems: string;
  constructor(kind: ShapedKind, problems: string) {
    super(`This ${kind} part is invalid: ${problems}`);
    this.name = "PartInvalid";
    this.kind = kind;
    this.problems = problems;
  }
}
const problems = (error: ParseResult.ParseError) =>
  ParseResult.ArrayFormatter.formatErrorSync(error).map(i => (i.path.length ? `${i.path.map(String).join(".")}: ` : "") + i.message).join("; ");

// The bytes to seal for a part: checked against its shape, then JSON as UTF-8.
export function encodePart<K extends ShapedKind>(kind: K, value: PartOf<K>): Uint8Array {
  const shape: Schema.Schema.AnyNoContext = PartShapes[kind];
  const result = Schema.encodeUnknownEither(shape, { onExcessProperty: "error" })(value);
  if (Either.isLeft(result)) throw new PartInvalid(kind, problems(result.left));
  return utf8.encode(JSON.stringify(result.right));
}
// Whether valid JSON names a field twice in one object. JavaScript keeps the last and the phone's Foundation the
// first, so both sides refuse it rather than read one part two ways. Keys compare once unescaped, as JSON.parse
// reads them.
export function repeatsAField(json: string): boolean {
  const objects: (Set<string> | null)[] = [];
  let key = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i];
    if (c === '"') {
      let end = i + 1;
      while (json[end] !== '"') end += json[end] === "\\" ? 2 : 1;
      const fields = objects.at(-1);
      if (key && fields) {
        const name: string = JSON.parse(json.slice(i, end + 1));
        if (fields.has(name)) return true;
        fields.add(name);
        key = false;
      }
      i = end;
    } else if (c === "{") { objects.push(new Set()); key = true; }
    else if (c === "[") { objects.push(null); key = false; }
    else if (c === "}" || c === "]") { objects.pop(); key = false; }
    else if (c === ",") key = objects.at(-1) instanceof Set;
  }
  return false;
}

// An opened part's bytes as its kind's shape: UTF-8 (no byte-order mark), JSON naming no field twice, then the
// shape, strictly; a preview's bytes as they came, not as they encode again, are held to PREVIEW_MAX_BYTES, as the
// phone holds them. Anything else is refused.
export function decodePart<K extends ShapedKind>(kind: K, bytes: Uint8Array): PartOf<K> {
  if ((kind === "decisionPreview" || kind === "acknowledgementPreview") && bytes.length > PREVIEW_MAX_BYTES) throw new PartInvalid(kind, `a preview may not exceed ${PREVIEW_MAX_BYTES} bytes`);
  let value: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    value = JSON.parse(text);
    if (repeatsAField(text)) throw new Error("a field named twice");
  } catch { throw new PartInvalid(kind, "not JSON as UTF-8 naming each field once"); }
  const shape: Schema.Schema.AnyNoContext = PartShapes[kind];
  const result = Schema.decodeUnknownEither(shape, { onExcessProperty: "error" })(value);
  if (Either.isLeft(result)) throw new PartInvalid(kind, problems(result.left));
  return result.right;
}

// Shortening a preview to fit: a field keeps as many whole characters as fit, then "…", or only "…" when nothing of
// it fits yet. The most expendable go first: for a decision, its detail, the recommended option's title, the option,
// the machine, then the question, the project and who asked; for an acknowledgement, its next steps, then the
// question, the project and who asked. An optional field that can't keep even "…" is left out.
const ELLIPSIS = "…";
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const cut = (text: string, keep: number) => [...graphemes.segment(text)].slice(0, keep).map(s => s.segment).join("") + ELLIPSIS;
const size = (preview: object) => utf8Length(JSON.stringify(preview));
// The most of `text` that keeps `rebuild(text)` within the budget, found by halving, since the size grows with what
// is kept; undefined when even "…" alone doesn't fit.
function shorten<P extends object>(text: string, rebuild: (text: string) => P): P | undefined {
  if (size(rebuild(cut(text, 0))) > PREVIEW_MAX_BYTES) return undefined;
  let lo = 0, hi = characters(text) - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (size(rebuild(cut(text, mid))) <= PREVIEW_MAX_BYTES) lo = mid; else hi = mid - 1;
  }
  return rebuild(cut(text, lo));
}
// Each step runs only while the preview is still too big. A required field's step leaves at least "…", so once the
// last runs, every field before it is "…" or the preview already fit, and the last always fits.
function fit<P extends object>(preview: P, steps: ((p: P) => P)[]): P {
  let p = preview;
  for (const step of steps) if (size(p) > PREVIEW_MAX_BYTES) p = step(p);
  return p;
}
const required = <P extends object>(text: string, rebuild: (text: string) => P) => shorten(text, rebuild) ?? rebuild(ELLIPSIS);

export function decisionPreview(card: CardPart, identity: IdentityPart): DecisionPreview {
  const option = card.card.options.find(o => o.number === card.card.recommended);
  const full: DecisionPreview = {
    title: card.title,
    ...(card.detail === undefined ? {} : { detail: card.detail }),
    ...(option ? { recommended: { letter: letter(option.number), title: option.title } } : {}),
    app: identity.app,
    project: identity.project,
    ...(identity.machine === undefined ? {} : { machine: identity.machine }),
  };
  return Schema.decodeUnknownSync(DecisionPreview)(fit<DecisionPreview>(full, [
    ({ detail, ...p }) => detail === undefined ? p : shorten(detail, detail => ({ ...p, detail })) ?? p,
    ({ recommended, ...p }) => recommended === undefined ? p : shorten(recommended.title, title => ({ ...p, recommended: { letter: recommended.letter, title } })) ?? p,
    ({ machine, ...p }) => p,
    p => required(p.title, title => ({ ...p, title })),
    p => required(p.project, project => ({ ...p, project })),
    p => required(p.app, app => ({ ...p, app })),
  ]));
}

export function acknowledgementPreview(ack: AcknowledgementPart, identity: IdentityPart, title: string): AcknowledgementPreview {
  const full: AcknowledgementPreview = { nextSteps: ack.nextSteps, app: identity.app, project: identity.project, title };
  return Schema.decodeUnknownSync(AcknowledgementPreview)(fit<AcknowledgementPreview>(full, [
    p => required(p.nextSteps, nextSteps => ({ ...p, nextSteps })),
    p => required(p.title, title => ({ ...p, title })),
    p => required(p.project, project => ({ ...p, project })),
    p => required(p.app, app => ({ ...p, app })),
  ]));
}
