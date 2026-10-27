import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { Body, ClaimedSession, ConnectStatus, Decision, HomeSession, Inbox, QuestionInput, MCP_TOOLS, SessionInput, SESSION_NAME_MAX_CHARACTERS, PAIRING_TITLE, SESSION_LIFETIME_MS, LOCAL_LIFETIME_FLOOR_MS, LOCAL_LIFETIMES, SessionSummary } from "./exchange.ts";
import { inbox, pairingDecision, pairingInbox, unpairedSession, NOW } from "../ui/fixtures/decisions.ts";
const token = "a".repeat(32), answerId = "b".repeat(32);
const when = "2026-09-29T12:00:00.000Z";
const question = {decisionId:token,kind:"card",status:"open",title:"Send update?",askedAt:when,card:{type:"generic",options:[{number:1,emoji:"📨",title:"Send it"},{number:2,emoji:"🗑️",title:"Don’t send"}]}};
const session = {sessionId:token,name:"Codex · agentpager",paired:true,pairedAt:when,lastAcceptedAt:when,expiresAt:"2026-09-30T12:00:00.000Z",finishedAt:null};
it("refuses HTML rich bodies instead of cleaning or executing them",()=>{expect(Schema.is(Body)("<script>alert(1)</script>")).toBe(false)});
it("counts body characters and refuses 1001 whole",()=>{expect(Schema.is(Body)("👨‍👩‍👧".repeat(1000))).toBe(true);expect(Schema.is(Body)("👨‍👩‍👧".repeat(1001))).toBe(false)});
it("refuses malformed Unicode and blank rich bodies",()=>{expect(Schema.is(Body)("\uD800")).toBe(false);expect(Schema.is(Body)(" ")).toBe(false)});
it("accepts a recommended option only when the card offers it",()=>{const card=(recommended:number)=>({...question,card:{...question.card,recommended}});expect(Schema.is(Decision)(card(2))).toBe(true);expect(Schema.is(Decision)(card(3))).toBe(false)});
it("refuses an answer naming an option the card does not offer",()=>{expect(Schema.is(Decision)({...question,status:"answered",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"option",number:3}}})).toBe(false)});
it("refuses an acknowledgement of another decision",()=>{expect(Schema.is(Decision)({...question,status:"acknowledged",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"option",number:1}},acknowledgement:{decisionId:answerId,answerId,nextSteps:"Will send it.",acknowledgedAt:when}})).toBe(false)});
it("keeps feedback as a final immutable answer even after acknowledgement",()=>{expect(Schema.is(Decision)({...question,status:"feedback",answer:{answerId,decisionId:token,sentAt:when,choice:{kind:"feedback",text:"Please shorten it."}},acknowledgement:{decisionId:token,answerId,nextSteps:"Will revise.",acknowledgedAt:when}})).toBe(true)});
it("refuses duplicated decision identities across queue and history",()=>{expect(Schema.is(Inbox)({session,open:[question,question],history:[]})).toBe(false)});
it("refuses cards before correct pairing",()=>{expect(Schema.is(Inbox)({session:{...session,paired:false,pairedAt:null,expiresAt:null},open:[question],history:[]})).toBe(false)});

it('refuses malformed Unicode in card prose', () => {
  const bad = String.fromCharCode(0xd800);
  const ask = (title: string) => ({title,card:{type:'generic',options:[{number:1,emoji:'📨',title:'Send it'},{number:2,emoji:'🗑️',title:'Don’t send'}]}});
  expect(Schema.is(QuestionInput)(ask('Review'))).toBe(true);
  expect(Schema.is(QuestionInput)(ask('Review'+bad))).toBe(false);
});

it('rejects excess card fields and unknown card types rather than silently dropping them', () => {
  const valid = ask();
  function ask() { return {title:'Review',card:{type:'generic',options:[{number:1,emoji:'📨',title:'Send it'},{number:2,emoji:'🗑️',title:'Don’t send'}]}}; }
  const extra = {...valid,card:{...valid.card,body:'Hidden text'}};
  const product = {...valid,card:{...valid.card,type:'gmail'}};
  expect(Schema.is(QuestionInput)(valid)).toBe(true);
  for (const input of [extra, product]) {
    expect(Schema.is(QuestionInput)(input)).toBe(false);
    expect(() => Schema.decodeUnknownSync(QuestionInput)(input)).toThrow();
  }
});

it('rejects unknown MCP argument fields at the outer boundary', () => {
  const agent={sessionId:'s'.repeat(32),agentKey:'a'.repeat(32)},extra={unexpected:'must not be dropped'};
  const inputs={ask_card:{...agent,question:{title:'Review',card:{type:'generic',options:[{number:1,emoji:'🍋',title:'One'},{number:2,emoji:'🦊',title:'Two'}]}},...extra},wait_for_card_answer:{...agent,decisionId:'d'.repeat(32),...extra},acknowledge_card:{...agent,decisionId:'d'.repeat(32),acknowledgement:{answerId:'b'.repeat(32),nextSteps:'Continue'},...extra}};
  const decoders={ask_card:Schema.decodeUnknownSync(MCP_TOOLS.ask_card.input),wait_for_card_answer:Schema.decodeUnknownSync(MCP_TOOLS.wait_for_card_answer.input),acknowledge_card:Schema.decodeUnknownSync(MCP_TOOLS.acknowledge_card.input)};
  for(const name of ['ask_card','wait_for_card_answer','acknowledge_card'] as const)expect(()=>decoders[name](inputs[name])).toThrow();
});

it("names every session with short prose the owner can read on one row", () => {
  expect(Schema.is(SessionInput)({ name: "Claude Code · blueprint" })).toBe(true);
  expect(Schema.is(SessionInput)({ name: "🦊".repeat(SESSION_NAME_MAX_CHARACTERS) })).toBe(true);
  expect(Schema.is(SessionInput)({ name: "🦊".repeat(SESSION_NAME_MAX_CHARACTERS + 1) })).toBe(false);
  for (const name of [" ", "<b>Agent</b>", "\uD800"]) expect(Schema.is(SessionInput)({ name })).toBe(false);
  expect(Schema.is(SessionInput)({})).toBe(false);
  expect(() => Schema.decodeUnknownSync(MCP_TOOLS.start_session.input)({ name: "Codex", unexpected: true })).toThrow();
  expect(Schema.is(SessionSummary)({ ...session, name: undefined })).toBe(false);
});

it("names every session, and takes a join only with a connect id", () => {
  expect(Schema.is(SessionSummary)({ ...session, name: null, paired: false, pairedAt: null, expiresAt: null })).toBe(false);
  expect(Schema.is(HomeSession)({ sessionId: token, name: "Codex", status: "invited", openCount: 1, lastActivityAt: when })).toBe(false);
  const join = { connectId: token, name: "Codex" };
  expect(Schema.is(MCP_TOOLS.join_session.input)(join)).toBe(true);
  expect(() => Schema.decodeUnknownSync(MCP_TOOLS.join_session.input)({ ...join, unexpected: true })).toThrow();
  for (const connectId of [token.slice(1), `${token}x`, `${token.slice(1)}/`])
    expect(Schema.is(MCP_TOOLS.join_session.input)({ ...join, connectId })).toBe(false);
});

it("keeps only name and end time on a terminal home row", () => {
  const row = { sessionId: token, name: "Codex", status: "active", openCount: 2, lastActivityAt: when };
  expect(Schema.is(HomeSession)(row)).toBe(true);
  expect(Schema.is(HomeSession)({ ...row, status: "ended" })).toBe(false);
  expect(Schema.is(HomeSession)({ ...row, status: "expired", openCount: 0 })).toBe(false);
  const label = { name: row.name, endedAt: when };
  expect(Schema.is(HomeSession)(label)).toBe(true);
  for (const extra of [{ sessionId: token }, { phoneKey: token }, { status: 'expired' }, { openCount: 0 }]) {
    expect(Schema.is(HomeSession)({ ...label, ...extra })).toBe(false);
    expect(() => Schema.decodeUnknownSync(HomeSession)({ ...label, ...extra })).toThrow();
  }
});

it("requires the real name whenever discovery grants membership", () => {
  expect(Schema.is(ConnectStatus)({ sessionId: null })).toBe(true);
  expect(Schema.is(ConnectStatus)({ sessionId: token })).toBe(false);
  expect(Schema.is(ConnectStatus)({ sessionId: token, name: session.name })).toBe(true);
  expect(Schema.is(ClaimedSession)({ sessionId: token, phoneKey: answerId })).toBe(false);
  expect(Schema.is(ClaimedSession)({ sessionId: token, phoneKey: answerId, name: session.name })).toBe(true);
});

describe("pairing", () => {
  it("requires five choices and no target disclosure, without narrowing ordinary cards", () => {
    expect(Schema.is(Decision)(question)).toBe(true);
    expect(Schema.is(Decision)({ ...question, kind: 'pairing' })).toBe(false);
    expect(Schema.is(Decision)(pairingDecision)).toBe(true);
    for (const n of [2, 3, 4]) expect(Schema.is(Decision)({ ...pairingDecision, card: { ...pairingDecision.card, options: pairingDecision.card.options.slice(0, n) } })).toBe(false);
    expect(Schema.is(Decision)({ ...pairingDecision, card: { ...pairingDecision.card, recommended: 1 } })).toBe(false);
  });
  it("holds only the open pairing decision before pairing, and none open after", () => {
    expect(Schema.is(Inbox)(pairingInbox)).toBe(true);
    expect(Schema.is(Inbox)({ ...pairingInbox, open: [] })).toBe(false);
    expect(Schema.is(Inbox)({ ...pairingInbox, open: [pairingDecision, question] })).toBe(false);
    expect(Schema.is(Inbox)({ ...inbox, open: [pairingDecision] })).toBe(false);
  });
  it("refuses feedback as the pairing decision", () => {
    const feedback = { answerId, decisionId: pairingDecision.decisionId, sentAt: NOW, choice: { kind: "feedback", text: "Lemon" } };
    expect(Schema.is(Decision)({ ...pairingDecision, status: "feedback", answer: feedback })).toBe(false);
  });
  it("accepts the production or a local session lifetime and refuses any other", () => {
    const at = (ms: number) => ({ ...inbox.session, expiresAt: new Date(Date.parse(inbox.session.pairedAt!) + ms).toISOString() });
    for (const ms of [SESSION_LIFETIME_MS, LOCAL_LIFETIMES.sessionMs, LOCAL_LIFETIME_FLOOR_MS, 20_000]) expect(Schema.is(SessionSummary)(at(ms))).toBe(true);
    for (const ms of [LOCAL_LIFETIMES.sessionMs + 1000, LOCAL_LIFETIME_FLOOR_MS - 1000, SESSION_LIFETIME_MS - 1000]) expect(Schema.is(SessionSummary)(at(ms))).toBe(false);
  });
  it("starts a fixed 24-hour lifetime only after correct pairing", () => {
    expect(SESSION_LIFETIME_MS).toBe(24 * 60 * 60 * 1000);
    expect(unpairedSession).toMatchObject({ paired: false, pairedAt: null });
    expect(Schema.is(SessionSummary)({ ...unpairedSession, expiresAt: null })).toBe(false);
    expect(Date.parse(inbox.session.expiresAt!) - Date.parse(inbox.session.pairedAt!)).toBe(SESSION_LIFETIME_MS);
    expect(Schema.is(SessionSummary)({ ...inbox.session, paired: false })).toBe(false);
    expect(Schema.is(SessionSummary)({ ...inbox.session, pairedAt: null })).toBe(false);
    expect(Schema.is(SessionSummary)({ ...inbox.session, expiresAt: "2026-09-30T07:00:00.000Z" })).toBe(false);
  });
  it("uses the canonical pairing words", () => {
    expect(pairingDecision.title).toBe(PAIRING_TITLE);
    expect(pairingDecision.detail).toBeUndefined();
  });
});
