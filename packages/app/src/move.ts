import { Schema } from 'effect';
import * as C from './contract.ts';
import { PushTarget } from './push.ts';

// The move (M6, blueprint/milestones/M6-tidy.md, Sam's answer 1): what M5 stored in the Registry and in each agent's
// store, as those stores hand it to the pager's own store (pager.ts), which keeps it from then on. Both sides decode
// with these schemas. Every value is copied exactly as it was stored, its times' spelling included, so the phone and
// each agent read the same replies after the move as before it.

export const Digest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/));
export const Fingerprint = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{16}$/));
const Millis = Schema.Number.pipe(Schema.int(), Schema.nonNegative());
// A push target as the Registry stored it: its JSON text.
const isPush = (text: string) => { try { return Schema.is(PushTarget)(JSON.parse(text)); } catch { return false; } };
const PushText = Schema.String.pipe(Schema.filter(text => isPush(text) || 'not a push target'));

// One agent as M5 stored it (agent.ts, agent_v3): its identity part, its key and its pager's phone key as digests, and
// when it connected, finished and was last active.
export const Meta = Schema.Struct({
  agentId: C.Token, pagerId: C.PagerId, identity: C.Sealed('identity'),
  createdAt: C.Timestamp, finishedAt: Schema.NullOr(C.Timestamp), lastActivityAt: C.Timestamp,
  agentHash: Digest, phoneHash: Digest,
});
export type Meta = typeof Meta.Type;

// The Registry's row for one pager, with the agents it lists for it in connect order. No row: no such pager, never
// made or deleted before the move, and no agent listed.
export const RegistryExport = Schema.Struct({
  pager: Schema.NullOr(Schema.Struct({
    fingerprint: Fingerprint, publicKey: C.PublicKey, phoneHash: Digest, enabled: Schema.Literal(0, 1), autoOff: C.AutoOff,
    offAt: Schema.NullOr(Millis), offSince: Schema.NullOr(Millis), push: Schema.NullOr(PushText), createdAt: Millis,
  })),
  agents: Schema.Array(C.Token),
});
export type RegistryExport = typeof RegistryExport.Type;

// Everything one agent's store holds, decisions in the order they were asked, but for its attachments' parts, which
// the agent's store gives one at a time (AttachmentPart), so the move never holds more than one in memory. No agent:
// it was forgotten.
const Of = { decisionId: C.Token };
export const AgentExport = Schema.Struct({
  agent: Schema.NullOr(Meta),
  decisions: Schema.Array(Schema.Struct({ ...Of, card: C.Sealed('card'), preview: C.Sealed('decisionPreview'), digest: C.AskDigest, askedAt: C.Timestamp })),
  attachments: Schema.Array(Schema.Struct({ ...Of, slot: Schema.Number.pipe(Schema.int(), Schema.between(0, 9)) })),
  answers: Schema.Array(Schema.Struct({ ...Of, requestId: C.Token, answerId: C.Token, part: C.Sealed('answer'), sentAt: C.Timestamp })),
  acknowledgements: Schema.Array(Schema.Struct({ ...Of, part: C.Sealed('acknowledgement'), acknowledgedAt: C.Timestamp })),
  pickups: Schema.Array(Schema.Struct({ ...Of, due: Millis })),
  collections: Schema.Array(Schema.Struct({ ...Of, at: C.Timestamp })),
  warnings: Schema.Array(Schema.Struct({ ...Of, at: C.Timestamp })),
});
export type AgentExport = typeof AgentExport.Type;
export const AttachmentPart = C.Sealed('attachment');
