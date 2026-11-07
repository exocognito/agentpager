import { createHash, createHmac, hkdfSync } from 'node:crypto';
import { PART_MAX_BYTES, type Choice, type SealedKind } from '../../contract/exchange.ts';
import { fromBase64url, keyPair, open, publicKeyOf, seal, toBase64url } from '../../contract/envelope.ts';
import { acknowledgementPreview, decisionPreview, decodePart, encodePart, PartInvalid, type CardPart, type IdentityPart, type PartOf, type ShapedKind } from '../../contract/parts.ts';
import type { Attachment } from './card.ts';

// The command's side of end-to-end encryption (B30, blueprint/areas/6-privacy.md): what it seals to the pager's key,
// checked against the number and pinned in the agent file at connect (I19), and how it opens the answers sealed to its
// own key. The format is packages/contract/envelope.ts; each kind's plaintext, parts.ts.
export type Keys = { pager: string; pagerKey: string; privateKey: string };
const bytes = (key: string) => {
  const raw = fromBase64url(key);
  if (!raw || raw.length !== 32) throw new Error('not a key');
  return raw;
};

// The key the number names: its fingerprint is the first 8 bytes of the key's SHA-256.
export const fingerprint = (publicKey: string) => createHash('sha256').update(bytes(publicKey)).digest().subarray(0, 8).toString('hex');
export function newKeys() {
  const k = keyPair();
  return { privateKey: toBase64url(k.privateKey), publicKey: toBase64url(k.publicKey) };
}
export const publicOf = (privateKey: string) => toBase64url(publicKeyOf(bytes(privateKey)));

// A part's plaintext, checked against its kind's shape and size before anything is sealed. A problem is said field by
// field, as the service's refusals were when it could read them.
export class Unsendable extends Error {}
function plaintext<K extends ShapedKind & SealedKind>(kind: K, value: PartOf<K>, what: string): Uint8Array {
  let encoded: Uint8Array;
  try { encoded = encodePart(kind, value); } catch (e) { if (e instanceof PartInvalid) throw new Unsendable(e.problems); throw e; }
  if (encoded.length > PART_MAX_BYTES[kind]) throw new Unsendable(`${what} is ${encoded.length.toLocaleString('en-US')} bytes as sent; the limit is ${PART_MAX_BYTES[kind].toLocaleString('en-US')}`);
  return encoded;
}

// Who asked, the project and the computer, as the agent says them.
export type Who = { app: string; project: string; machine?: string };
// The identity names this agent's own public key too, the one each of its cards names: the phone takes a card as this
// agent's only when the two match (B30).
const identityOf = (k: Keys, who: Who): IdentityPart => ({ ...who, answerKey: publicOf(k.privateKey) });

export function sealIdentity(k: Keys, who: Who) {
  return seal(bytes(k.pagerKey), 'identity', { pagerId: k.pager }, plaintext('identity', identityOf(k, who), 'Who asked, the project and the computer'));
}

// What a card holds once compiled (card.ts Brief): the question, its brief and its attachments with their contents.
export type Question = { title: string; detail?: string; card: CardPart['card']; attachments?: readonly Attachment[] };
// A card, each attachment in its slot and the alert's preview, all bound to the decision the request id names.
export function sealAsk(k: Keys, who: Who, brief: Question, decisionId: string) {
  const to = bytes(k.pagerKey), at = { pagerId: k.pager, decisionId };
  const card: CardPart = {
    title: brief.title, ...(brief.detail ? { detail: brief.detail } : {}), card: brief.card,
    ...(brief.attachments?.length ? { attachments: brief.attachments.map(a => ({ name: a.name, type: a.type })) } : {}),
    answerKey: publicOf(k.privateKey),
  };
  const attachments = (brief.attachments ?? []).map((a, index) =>
    seal(to, 'attachment', { ...at, index }, 'text' in a ? new TextEncoder().encode(a.text) : new Uint8Array(Buffer.from(a.base64, 'base64'))));
  return {
    card: seal(to, 'card', at, plaintext('card', card, 'The card')),
    ...(attachments.length ? { attachments } : {}),
    preview: seal(to, 'decisionPreview', at, plaintext('decisionPreview', decisionPreview(card, who), 'The alert')),
  };
}

// A digest of the card that only this agent can make: the service compares it to tell the same card asked again,
// after a lost reply, from another card under the same request id, and learns nothing else from it.
export function askDigest(k: Keys, brief: Question) {
  const key = Buffer.from(hkdfSync('sha256', bytes(k.privateKey), new Uint8Array(0), 'agentpager/v1/ask-digest', 32));
  return createHmac('sha256', key).update(JSON.stringify(brief)).digest('base64url');
}

export function sealAcknowledgement(k: Keys, who: Who, decisionId: string, nextSteps: string, title: string) {
  const to = bytes(k.pagerKey), at = { pagerId: k.pager, decisionId };
  const ack = { nextSteps };
  return {
    acknowledgement: seal(to, 'acknowledgement', at, plaintext('acknowledgement', ack, 'The acknowledgement')),
    preview: seal(to, 'acknowledgementPreview', at, plaintext('acknowledgementPreview', acknowledgementPreview(ack, who, title), 'The alert')),
  };
}

// The owner's answer, opened with this agent's key and bound to its pager and decision. Null when it doesn't open or
// isn't an answer: then it isn't the phone's answer to this card.
export function openAnswer(k: Keys, decisionId: string, part: string): Choice | null {
  try { return decodePart('answer', open(bytes(k.privateKey), 'answer', { pagerId: k.pager, decisionId }, part)).choice; }
  catch { return null; }
}
