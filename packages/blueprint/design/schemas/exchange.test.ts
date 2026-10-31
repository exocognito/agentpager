import { expect, it } from "vitest";
import { Schema } from "effect";
import { Body, ConnectInput, Decision, LABEL_MAX_CHARACTERS, QuestionInput } from "./exchange.ts";
const token = "a".repeat(32), answerId = "b".repeat(32);
const when = "2026-09-29T12:00:00.000Z";
const brief = {type:"brief",recommended:2,options:[{number:1,title:"First plan",prioritizes:"speed"},{number:2,title:"Second plan",prioritizes:"safety"}],markdown:"## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Recommendation: B\n**Why:** It is safer.\n"};
const question = {decisionId:token,status:"open",title:"Send update?",askedAt:when,card:brief};
it("refuses HTML rich bodies instead of cleaning or executing them",()=>{expect(Schema.is(Body)("<script>alert(1)</script>")).toBe(false)});
it("counts body characters and refuses 1001 whole",()=>{expect(Schema.is(Body)("👨‍👩‍👧".repeat(1000))).toBe(true);expect(Schema.is(Body)("👨‍👩‍👧".repeat(1001))).toBe(false)});
it("refuses malformed Unicode and blank rich bodies",()=>{expect(Schema.is(Body)("\uD800")).toBe(false);expect(Schema.is(Body)(" ")).toBe(false)});
it("accepts a recommended option only when the card offers it",()=>{const card=(recommended:number)=>({...question,card:{...question.card,recommended,markdown:question.card.markdown.replace("Recommendation: B",`Recommendation: ${"ABCD"[recommended-1]}`)}});expect(Schema.is(Decision)(card(2))).toBe(true);expect(Schema.is(Decision)(card(3))).toBe(false)});
it("refuses an answer naming an option the card does not offer",()=>{expect(Schema.is(Decision)({...question,status:"answered",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"option",number:3}}})).toBe(false)});
it("refuses an acknowledgement of another decision",()=>{expect(Schema.is(Decision)({...question,status:"acknowledged",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"option",number:1}},acknowledgement:{decisionId:answerId,answerId,nextSteps:"Will send it.",acknowledgedAt:when}})).toBe(false)});
it("records collection and the pickup warning only for an answer, and neither is an acknowledgement",()=>{const answer={answerId,decisionId:token,sentAt:when,choice:{kind:"option",number:1}};expect(Schema.is(Decision)({...question,status:"answered",answer,collectedAt:when,warnedAt:when})).toBe(true);expect(Schema.is(Decision)({...question,collectedAt:when})).toBe(false);expect(Schema.is(Decision)({...question,warnedAt:when})).toBe(false);expect(Schema.is(Decision)({...question,status:"acknowledged",answer,collectedAt:when})).toBe(false)});
it("keeps feedback as a final immutable answer even after acknowledgement",()=>{expect(Schema.is(Decision)({...question,status:"feedback",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"feedback",text:"Please shorten it."}},acknowledgement:{decisionId:token,answerId,nextSteps:"Will revise.",acknowledgedAt:when}})).toBe(true)});

// Every card is a brief: neither a new question nor a decision admits the retired emoji card.
const emojiCard = {type:"generic",options:[{number:1,emoji:"📨",title:"Send it"},{number:2,emoji:"🗑️",title:"Don’t send"}]};
it('takes only briefs, as new questions and as decisions', () => {
  expect(Schema.is(QuestionInput)({title:'Review',card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'Review',card:emojiCard})).toBe(false);
  expect(Schema.is(Decision)(question)).toBe(true);
  expect(Schema.is(Decision)({...question,card:emojiCard})).toBe(false);
});
it('holds a title to 100 characters, as asked and as stored', () => {
  expect(Schema.is(QuestionInput)({title:'x'.repeat(100),card:brief})).toBe(true);
  expect(Schema.is(QuestionInput)({title:'x'.repeat(101),card:brief})).toBe(false);
  expect(Schema.is(Decision)({...question,title:'x'.repeat(101)})).toBe(false);
});

it('refuses malformed Unicode in card prose', () => {
  const bad = String.fromCharCode(0xd800);
  const ask = (title: string) => ({title,card:brief});
  expect(Schema.is(QuestionInput)(ask('Review'))).toBe(true);
  expect(Schema.is(QuestionInput)(ask('Review'+bad))).toBe(false);
});

it('rejects excess card fields and unknown card types rather than silently dropping them', () => {
  const valid = ask();
  function ask() { return {title:'Review',card:brief}; }
  const extra = {...valid,card:{...valid.card,body:'Hidden text'}};
  const product = {...valid,card:{...valid.card,type:'gmail'}};
  expect(Schema.is(QuestionInput)(valid)).toBe(true);
  for (const input of [extra, product]) {
    expect(Schema.is(QuestionInput)(input)).toBe(false);
    expect(() => Schema.decodeUnknownSync(QuestionInput)(input)).toThrow();
  }
});

it("has no kind: a stored decision that still names one is refused, not read", () => {
  const strict = Schema.decodeUnknownEither(Decision, { onExcessProperty: "error" });
  expect(strict(question)._tag).toBe("Right");
  expect(strict({ ...question, kind: "card" })._tag).toBe("Left");
});

it("names who asked and the project in short prose, and refuses unknown connect fields", () => {
  const connect = { number: "ap1_" + "A".repeat(32), app: "Codex", project: "agentpager" };
  expect(Schema.is(ConnectInput)(connect)).toBe(true);
  expect(Schema.is(ConnectInput)({ ...connect, project: "🦊".repeat(LABEL_MAX_CHARACTERS) })).toBe(true);
  for (const app of [" ", "<b>Agent</b>", "\uD800", "🦊".repeat(LABEL_MAX_CHARACTERS + 1)]) expect(Schema.is(ConnectInput)({ ...connect, app })).toBe(false);
  expect(() => Schema.decodeUnknownSync(ConnectInput)({ ...connect, name: "Codex" })).toThrow();
});
