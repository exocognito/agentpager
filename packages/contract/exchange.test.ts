import { expect, it } from "vitest";
import { Schema } from "effect";
import { AgentStatus, AskInput, Body, CLOSED_AGENT_FINISHED, ConnectInput, DECISION_CLOSED_MESSAGE, Decision, DecisionClosedRefusal, ENVELOPE_OVERHEAD_BYTES, Finished, PART_MAX_BYTES, PagerInbox, QuestionInput, REFUSAL_STATUS, Sealed, sealedBytes } from "./exchange.ts";
import { keyPair, seal, toBase64url } from "./envelope.ts";
const token = "a".repeat(32), answerId = "b".repeat(32);
const when = "2026-09-29T12:00:00.000Z";
const brief = {type:"brief",recommended:2,options:[{number:1,title:"First plan",prioritizes:"speed"},{number:2,title:"Second plan",prioritizes:"safety"}],markdown:"## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Recommendation: B\n**Why:** It is safer.\n"};
// An encrypted part of n plaintext bytes, as the format makes one.
const pager = keyPair(), pagerId = "0123456789abcdef0123456789abcdef";
const part = (n = 10) => seal(pager.publicKey, "card", { pagerId, decisionId: token }, new Uint8Array(n));
const question = {decisionId:token,status:"open",card:part(),attachments:[],askedAt:when};
const answer = {answerId,decisionId:token,requestId:"r".repeat(32),answer:part(),sentAt:when};
it("refuses HTML rich bodies instead of cleaning or executing them",()=>{expect(Schema.is(Body)("<script>alert(1)</script>")).toBe(false)});
it("counts body characters and refuses 1001 whole",()=>{expect(Schema.is(Body)("👨‍👩‍👧".repeat(1000))).toBe(true);expect(Schema.is(Body)("👨‍👩‍👧".repeat(1001))).toBe(false)});
it("refuses malformed Unicode and blank rich bodies",()=>{expect(Schema.is(Body)("\uD800")).toBe(false);expect(Schema.is(Body)(" ")).toBe(false)});
it("records collection and the pickup warning only for an answer, and neither is an acknowledgement",()=>{expect(Schema.is(Decision)({...question,status:"answered",answer,collectedAt:when,warnedAt:when})).toBe(true);expect(Schema.is(Decision)({...question,collectedAt:when})).toBe(false);expect(Schema.is(Decision)({...question,warnedAt:when})).toBe(false);expect(Schema.is(Decision)({...question,status:"acknowledged",answer,collectedAt:when})).toBe(false)});
it("refuses an acknowledgement of another decision or answer",()=>{
  const ack={decisionId:token,answerId,acknowledgement:part(),acknowledgedAt:when};
  expect(Schema.is(Decision)({...question,status:"acknowledged",answer,acknowledgement:ack})).toBe(true);
  expect(Schema.is(Decision)({...question,status:"acknowledged",answer,acknowledgement:{...ack,decisionId:answerId}})).toBe(false);
  expect(Schema.is(Decision)({...question,status:"acknowledged",answer,acknowledgement:{...ack,answerId:token}})).toBe(false);
});
// The service can't tell an option from a note: that is inside the answer.
it("has no feedback status and no kind: a decision that names either is refused, not read", () => {
  const strict = Schema.decodeUnknownEither(Decision, { onExcessProperty: "error" });
  expect(strict(question)._tag).toBe("Right");
  expect(strict({ ...question, kind: "card" })._tag).toBe("Left");
  expect(strict({ ...question, status: "feedback", answer })._tag).toBe("Left");
  expect(strict({ ...question, title: "Readable?" })._tag).toBe("Left");
});

// Every card is a brief: a new question admits no retired emoji card. The command holds every card to this before
// it seals it (I22.6).
const emojiCard = {type:"generic",options:[{number:1,emoji:"📨",title:"Send it"},{number:2,emoji:"🗑️",title:"Don’t send"}]};
it('takes only briefs as new questions', () => {
  expect(Schema.is(QuestionInput)({title:'Review',card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'Review',card:emojiCard})).toBe(false);
});
it('holds a title to 100 characters and the one-line detail to 280', () => {
  expect(Schema.is(QuestionInput)({title:'x'.repeat(100),card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'x'.repeat(101),card:brief})).toBe(false);
  expect(Schema.is(QuestionInput)({title:'Review',detail:'x'.repeat(280),card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'Review',detail:'x'.repeat(281),card:brief})).toBe(false);
});
it('refuses malformed Unicode in card prose', () => {
  expect(Schema.is(QuestionInput)({title:'Review',card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'Review'+String.fromCharCode(0xd800),card:brief})).toBe(false);
});
it('rejects excess card fields and unknown card types rather than silently dropping them', () => {
  const valid = {title:'Review',card:brief};
  const extra = {...valid,card:{...valid.card,body:'Hidden text'}};
  const product = {...valid,card:{...valid.card,type:'gmail'}};
  expect(Schema.is(QuestionInput)(valid)).toBe(true);
  for (const input of [extra, product]) {
    expect(Schema.is(QuestionInput)(input)).toBe(false);
    expect(() => Schema.decodeUnknownSync(QuestionInput)(input)).toThrow();
  }
});

// I4.1: what the service checks of an encrypted part is all it can read of one, its shape and its size.
it("I4.1 takes an encrypted part by its shape and its kind's size, and nothing readable", () => {
  const card = Sealed("card");
  expect(Schema.is(card)(part())).toBe(true);
  expect(sealedBytes(part(1234))).toBe(1234);
  // Not base64url, padded, a lone last character, spare bits set, another version, or holding nothing.
  const whole = part(5), spare = part(6);
  expect([whole.length % 4, spare.length % 4]).toEqual([0, 2]);
  for (const bad of ["Which plan?", whole + "=", whole + "A", spare.slice(0, -1) + "B", "B" + whole.slice(1), "AA" + whole.slice(2)]) {
    expect(Schema.is(card)(bad), bad.slice(0, 20)).toBe(false);
  }
  expect(Schema.is(card)(toBase64url(Uint8Array.of(1, ...new Uint8Array(ENVELOPE_OVERHEAD_BYTES - 1))))).toBe(false);
  // Each kind's limit, to the byte.
  expect(Schema.is(Sealed("decisionPreview"))(part(PART_MAX_BYTES.decisionPreview))).toBe(true);
  expect(Schema.is(Sealed("decisionPreview"))(part(PART_MAX_BYTES.decisionPreview + 1))).toBe(false);
  expect(Schema.is(Sealed("identity"))(part(PART_MAX_BYTES.identity + 1))).toBe(false);
});
it("I4.1 asks with the card, each attachment and the preview sealed, under a request id and a digest", () => {
  const ask = { requestId: "r".repeat(32), digest: "d".repeat(43), card: part(), preview: part() };
  expect(Schema.is(AskInput)(ask)).toBe(true);
  expect(Schema.is(AskInput)({ ...ask, attachments: [part(), part()] })).toBe(true);
  expect(Schema.is(AskInput)({ ...ask, attachments: Array.from({ length: 9 }, () => part()) })).toBe(false);
  // Three attachments of a million bytes are the most; one more byte is over.
  const big = (n: number) => part(n);
  expect(Schema.is(AskInput)({ ...ask, attachments: [big(1_000_000), big(1_000_000), big(1_000_000)] })).toBe(true);
  expect(Schema.is(AskInput)({ ...ask, attachments: [big(1_000_000), big(1_000_000), big(1_000_000), big(1)] })).toBe(false);
  for (const readable of [{ title: "Which?" }, { card: brief }, { detail: "Readable." }]) expect(Schema.is(AskInput)({ ...ask, ...readable })).toBe(false);
  for (const missing of ["requestId", "digest", "card", "preview"]) expect(Schema.is(AskInput)(Object.fromEntries(Object.entries(ask).filter(([k]) => k !== missing)))).toBe(false);
});
it("connects with the number and the identity sealed, never readable who asked or the agent's own key", () => {
  const connect = { number: "ap1_" + "A".repeat(32), identity: part() };
  expect(Schema.is(ConnectInput)(connect)).toBe(true);
  for (const readable of [{ app: "Codex" }, { project: "agentpager" }, { machine: "air" }, { publicKey: toBase64url(keyPair().publicKey) }]) {
    expect(() => Schema.decodeUnknownSync(ConnectInput)({ ...connect, ...readable })).toThrow();
  }
  expect(Schema.is(ConnectInput)({ number: connect.number, identity: "Codex" })).toBe(false);
});

// A decision that closed unanswered (M6, Sam's answers 2 and 4 in blueprint/milestones/M6-tidy.md): added fields only,
// so every reply an `m5` client reads decodes as before, and the new fields ride beside a status that doesn't change.
const closedAt = "2026-11-07T18:00:00.000Z", closed = { at: closedAt, reason: CLOSED_AGENT_FINISHED };
const agent = { agentId: answerId, identity: part(), createdAt: when, finishedAt: closedAt, lastActivityAt: closedAt, openCount: 0 };
it("a decision that closed unanswered stays open on the wire, with when and why; only one with no answer closes", () => {
  const strict = Schema.decodeUnknownEither(Decision, { onExcessProperty: "error" });
  expect(strict({ ...question, closed })._tag).toBe("Right");
  expect(Schema.decodeUnknownSync(Decision)({ ...question, closed }).closed).toEqual(closed);
  // An answered or acknowledged decision never closed unanswered.
  const ack = { decisionId: token, answerId, acknowledgement: part(), acknowledgedAt: when };
  expect(Schema.is(Decision)({ ...question, status: "answered", answer, closed })).toBe(false);
  expect(Schema.is(Decision)({ ...question, status: "acknowledged", answer, acknowledgement: ack, closed })).toBe(false);
  // A reason is an identifier the client needn't know; a time is a real one.
  expect(Schema.is(Decision)({ ...question, closed: { at: closedAt, reason: "agentForgotten" } })).toBe(true);
  for (const bad of [{ at: closedAt }, { reason: CLOSED_AGENT_FINISHED }, { at: "yesterday", reason: CLOSED_AGENT_FINISHED }, { at: closedAt, reason: "" }, { at: closedAt, reason: "agent finished" }, { ...closed, why: "Finished." }]) {
    expect(strict({ ...question, closed: bad })._tag, JSON.stringify(bad)).toBe("Left");
  }
});
it("the m5 shapes decode as before, and every reply with the new fields decodes", () => {
  // As the `m5` service sends them: no closed anywhere.
  const inbox = { pager: { pagerId, on: true, autoOff: "never", offAt: null, offSince: null, createdAt: when }, agents: [{ agent, open: [question], answered: [] }] };
  expect(Schema.decodeUnknownSync(PagerInbox)(inbox).agents[0].open[0].closed).toBeUndefined();
  expect(Schema.decodeUnknownSync(AgentStatus)({ agent, pager: { on: true } }).closed).toBeUndefined();
  expect(Schema.decodeUnknownSync(Finished)({ finishedAt: closedAt }).closed).toBeUndefined();
  // As the service sends them once finishing closes decisions.
  const listed = [{ decisionId: token, ...closed }];
  expect(Schema.decodeUnknownSync(PagerInbox)({ ...inbox, agents: [{ agent, open: [{ ...question, closed }], answered: [] }] }).agents[0].open[0].closed).toEqual(closed);
  expect(Schema.decodeUnknownSync(AgentStatus)({ agent, pager: { on: true }, closed: listed }).closed).toEqual(listed);
  expect(Schema.decodeUnknownSync(Finished)({ finishedAt: closedAt, closed: listed }).closed).toEqual(listed);
  expect(Schema.decodeUnknownSync(Finished)({ finishedAt: closedAt, closed: [] }).closed).toEqual([]);
  expect(Schema.is(Finished)({ finishedAt: closedAt, closed: [{ decisionId: "d_2x8w", ...closed }] })).toBe(false);
});
it("waiting on or answering a decision that closed unanswered is refused as DecisionClosed, with its record and words for the agent", () => {
  expect(REFUSAL_STATUS.DecisionClosed).toBe(409);
  const refusal = { error: "DecisionClosed", message: DECISION_CLOSED_MESSAGE, closed };
  expect(Schema.decodeUnknownSync(DecisionClosedRefusal)(refusal).closed).toEqual(closed);
  expect(Schema.is(DecisionClosedRefusal)({ ...refusal, closed: undefined })).toBe(false);
  expect(Schema.is(DecisionClosedRefusal)({ ...refusal, error: "NotAnswered" })).toBe(false);
  // One plain sentence for what happened, then what to do: an `m5` command prints it as it is.
  expect(DECISION_CLOSED_MESSAGE).toMatch(/^This decision closed unanswered when this agent finished, .+\. To ask about new work, connect again\.$/);
});
