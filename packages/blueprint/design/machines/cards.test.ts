import { afterEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";
import { Effect, Layer } from "effect";
import { createCardMachine, newToken } from "./cards.ts";
import { CardApi, Unreachable, type CardApiService } from "../effects/cards.ts";
import { createCardServices } from "../ui/fixtures/services.ts";
import { inbox, pairingInbox, pairingTarget } from "../ui/fixtures/decisions.ts";
import { InvalidInput, SessionEnded, SessionExpired } from "../effects/session.ts";
import { PHONE_POLL_MS, SEND_RETRIES, SEND_RETRY_BASE_MS, UNDO_MS, type AnswerInput } from "../schemas/exchange.ts";
const t="a".repeat(32), when="2026-09-29T12:00:00.000Z";
const question={decisionId:t,kind:"card" as const,status:"open" as const,title:"Choose a plan",askedAt:when,card:{type:"generic" as const,options:[{number:1,emoji:"🍋",title:"First"},{number:2,emoji:"🦊",title:"Second"}]}};
const seed={session:{sessionId:t,name:"Codex · agentpager",paired:true,pairedAt:when,lastAcceptedAt:when,expiresAt:"2026-09-30T12:00:00.000Z",finishedAt:null},open:[question],history:[]};
const settle=()=>new Promise(r=>setTimeout(r,20));
function fixture(){let inbox:any=structuredClone(seed); const writes:AnswerInput[]=[];let error:any=null;const layer=Layer.succeed(CardApi,{readCards:()=>error?Effect.fail(error):Effect.succeed(inbox),answerCard:(_,input)=>{writes.push(input);return Effect.succeed({decisionId:t,answerId:"b".repeat(32),sentAt:when})},endSession:()=>Effect.succeed({endedAt:when})});return {layer,writes,change:(next:any)=>inbox=next,fail:(next:any)=>error=next}}
it("sends the exact prepared choice only after Send and its Undo window",async()=>{const f=fixture(),actor=createActor(createCardMachine(f.layer,()=>Date.parse(when),60)).start();try{await settle();actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:2});expect(f.writes).toHaveLength(0);actor.send({type:"SEND"});await settle();expect(f.writes).toHaveLength(0);expect(actor.getSnapshot().matches({live:{screen:"undoing"}})).toBe(true);await new Promise(r=>setTimeout(r,80));expect(f.writes).toHaveLength(1);expect(f.writes[0].choice).toEqual({kind:"option",number:2});expect(actor.getSnapshot().matches({live:{screen:"sent"}})).toBe(true)}finally{actor.stop()}});
it("refreshes an open view without dropping its prepared choice",async()=>{const f=fixture(),actor=createActor(createCardMachine(f.layer,()=>Date.parse(when))).start();try{await settle();actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:2});f.change({...seed,open:[{...question,title:"New title"}]});actor.send({type:"REFRESH"});await settle();expect(actor.getSnapshot().context.inbox?.open[0].title).toBe("New title");expect(actor.getSnapshot().context.choice).toEqual({kind:"option",number:2})}finally{actor.stop()}});
it("rejects a blank feedback submission",async()=>{const f=fixture(),actor=createActor(createCardMachine(f.layer,()=>Date.parse(when))).start();try{await settle();actor.send({type:"OPEN",decisionId:t});actor.send({type:"FEEDBACK"});actor.send({type:"EDIT",text:" "});actor.send({type:"SEND"});await settle();expect(f.writes).toHaveLength(0)}finally{actor.stop()}});
it("clears the prepared answer when expiry interrupts a view",async()=>{const f=fixture(),actor=createActor(createCardMachine(f.layer,()=>Date.parse(when))).start();try{await settle();actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:2});f.fail(new SessionExpired({expiredAt:seed.session.expiresAt}));actor.send({type:"REFRESH"});await settle();expect(actor.getSnapshot().value).toBe("expired");expect(actor.getSnapshot().context.inbox).toBeNull();expect(actor.getSnapshot().context.choice).toBeNull()}finally{actor.stop()}});
it("keeps only who ended the session, never the queue or draft",async()=>{const f=fixture(),actor=createActor(createCardMachine(f.layer,()=>Date.parse(when))).start();try{await settle();actor.send({type:"OPEN",decisionId:t});f.fail(new SessionEnded({endedBy:"owner",endedAt:when}));actor.send({type:"REFRESH"});await settle();expect(actor.getSnapshot().value).toBe("ended");expect(actor.getSnapshot().context.endedBy).toBe("owner");expect(actor.getSnapshot().context.inbox).toBeNull()}finally{actor.stop()}});
it("retries the same answer after a lost receipt and a refresh showing it stored",async()=>{
 const writes:AnswerInput[]=[];let stored=false;
 const layer=Layer.succeed(CardApi,{readCards:()=>Effect.succeed(stored?{...seed,open:[],history:[{...question,status:"answered" as const,answer:{answerId:"b".repeat(32),decisionId:t,sentAt:when,choice:{kind:"option" as const,number:2}}}]}:seed),answerCard:(_,input)=>{writes.push(input);stored=true;return writes.length===1?Effect.fail({_tag:"Unreachable"} as any):Effect.succeed({decisionId:t,answerId:"b".repeat(32),sentAt:when})},endSession:()=>Effect.succeed({endedAt:when})});
 const actor=createActor(createCardMachine(layer,()=>Date.parse(when),0,0)).start();try{await settle();actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:2});actor.send({type:"SEND"});await settle();actor.send({type:"REFRESH"});await settle();actor.send({type:"RETRY"});await settle();expect(writes).toHaveLength(2);expect(writes[1]).toEqual(writes[0]);}finally{actor.stop()}
});

describe("pairing and the session clock", () => {
 const actors:{stop():void}[]=[];
 const tick=()=>vi.advanceTimersByTimeAsync(0);
 function start(seed=inbox,overrides:Partial<CardApiService>={},undoMs=0){
  const f=createCardServices(seed);
  const layer=Layer.succeed(CardApi,{...f.service,...overrides});
  const actor=createActor(createCardMachine(layer,f.now,undoMs));actors.push(actor);actor.start();
  return {f,actor};
 }
 afterEach(()=>{actors.splice(0).forEach(a=>a.stop());vi.useRealTimers()});
 it("mints 32-character URL-safe tokens",()=>{expect(newToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);expect(newToken()).not.toBe(newToken())});
 it("opens the pairing card at once, refuses a wrong emoji and feedback without storing, then pairs on the correct Send",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(pairingInbox);await tick();
  expect(actor.getSnapshot().matches({live:{screen:"view",clock:"unpaired"}})).toBe(true);
  expect(actor.getSnapshot().context.viewing).toBe(pairingInbox.open[0].decisionId);
  actor.send({type:"FEEDBACK"});
  expect(actor.getSnapshot().context.choice).toBeNull();
  const wrong=pairingTarget===1?2:1;
  actor.send({type:"SELECT",number:wrong});const firstRequest=actor.getSnapshot().context.requestId;
  actor.send({type:"SEND"});await tick();
  expect(actor.getSnapshot().matches({live:{screen:"view"}})).toBe(true);expect(actor.getSnapshot().context.error).toBe("InvalidInput");
  expect(actor.getSnapshot().context.choice).toBeNull();
  expect(actor.getSnapshot().context.requestId).not.toBe(firstRequest);
  expect(f.read()).toEqual(pairingInbox);
  actor.send({type:"SEND"});await tick();
  expect(actor.getSnapshot().matches({live:{screen:"view"}})).toBe(true);expect(actor.getSnapshot().context.error).toBe("InvalidInput");
  actor.send({type:"SELECT",number:pairingTarget});actor.send({type:"SEND"});await tick();
  const paired=f.read().session;
  expect(paired.paired).toBe(true);
  expect(Date.parse(paired.expiresAt!)-Date.parse(paired.pairedAt!)).toBe(24*60*60*1000);
  expect(actor.getSnapshot().matches({live:{screen:"sent",clock:"counting"}})).toBe(true);
 });
 it(`holds an answer for ${UNDO_MS} ms, sends nothing on Undo and keeps the choice`,async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(inbox,{},UNDO_MS);await tick();
  const card=inbox.open[0].decisionId;
  actor.send({type:"OPEN",decisionId:card});actor.send({type:"SELECT",number:2});actor.send({type:"SEND"});
  await vi.advanceTimersByTimeAsync(UNDO_MS-1);
  expect(f.read().open.map(d=>d.decisionId)).toContain(card);
  actor.send({type:"UNDO"});await vi.advanceTimersByTimeAsync(UNDO_MS);
  expect(actor.getSnapshot().matches({live:{screen:"view"}})).toBe(true);
  expect(actor.getSnapshot().context.choice).toEqual({kind:"option",number:2});
  expect(f.read().open.map(d=>d.decisionId)).toContain(card);
  actor.send({type:"SEND"});await vi.advanceTimersByTimeAsync(UNDO_MS);
  expect(f.read().history.find(d=>d.decisionId===card)?.answer?.choice).toEqual({kind:"option",number:2});
  expect(actor.getSnapshot().matches({live:{screen:"sent"}})).toBe(true);
  expect(actor.getSnapshot().context.viewing).toBe(card);
 });
 it("cancels the answer when the card closes in the Undo window, then shows the queue",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(inbox,{},UNDO_MS);await tick();
  const card=inbox.open[0].decisionId;
  actor.send({type:"OPEN",decisionId:card});actor.send({type:"SELECT",number:1});actor.send({type:"SEND"});actor.send({type:"BACK"});
  await vi.advanceTimersByTimeAsync(UNDO_MS*2);
  expect(f.read().open.map(d=>d.decisionId)).toContain(card);
  expect(f.read().history.find(d=>d.decisionId===card)).toBeUndefined();
  expect(actor.getSnapshot().matches({live:{screen:"queue"}})).toBe(true);
  expect(actor.getSnapshot().context).toMatchObject({viewing:null,choice:null,pending:null});
 });
 it("keeps the pairing deadline through later answers and acknowledgements",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(pairingInbox);await tick();
  actor.send({type:"SELECT",number:pairingTarget});actor.send({type:"SEND"});await tick();
  const deadline=f.read().session.expiresAt;
  f.acknowledge(f.read().history[0].decisionId,"Connected.");
  const card=f.ask({title:"Choose",card:{type:"brief",recommended:2,options:[{number:1,title:"First plan",prioritizes:"speed"},{number:2,title:"Second plan",prioritizes:"safety"}],markdown:"## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Recommendation: B\n**Why:** It is safer.\n"}});
  f.advance(5000);await vi.advanceTimersByTimeAsync(3000);
  actor.send({type:"OPEN",decisionId:card.decisionId});actor.send({type:"SELECT",number:1});actor.send({type:"SEND"});await tick();
  f.acknowledge(card.decisionId,"Acting now.");
  expect(f.read().session.expiresAt).toBe(deadline);
  expect(f.read().session.lastAcceptedAt).toBe(new Date(f.now()).toISOString());
 });
 it(`loads the cards and polls every ${PHONE_POLL_MS} ms`,async()=>{
  vi.useFakeTimers();
  const f=createCardServices(inbox);const readCards=vi.fn(f.service.readCards);
  const {actor}=start(inbox,{readCards});await tick();
  expect(actor.getSnapshot().matches({live:{screen:"queue"}})).toBe(true);
  expect(readCards).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(PHONE_POLL_MS-1);expect(readCards).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);expect(readCards).toHaveBeenCalledTimes(2);
 });
 it("keeps a finished session readable and takes no more answers",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start();await tick();
  f.finishByAgent();
  await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
  expect(actor.getSnapshot().matches({live:{screen:"queue"}})).toBe(true);
  expect(actor.getSnapshot().context.inbox?.session.finishedAt).not.toBeNull();
  expect(actor.getSnapshot().context.inbox?.history).toEqual(inbox.history);
  actor.send({type:"OPEN",decisionId:inbox.open[0].decisionId});actor.send({type:"SELECT",number:1});actor.send({type:"FEEDBACK"});actor.send({type:"SEND"});
  expect(actor.getSnapshot().context.choice).toBeNull();
  expect(actor.getSnapshot().matches({live:{screen:"view"}})).toBe(true);
  expect(f.writes).toHaveLength(0);
 });
 it("stores nothing when the agent finishes inside the Undo window",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(inbox,{},UNDO_MS);await tick();
  actor.send({type:"OPEN",decisionId:inbox.open[0].decisionId});actor.send({type:"SELECT",number:1});actor.send({type:"SEND"});
  f.finishByAgent();
  await vi.advanceTimersByTimeAsync(UNDO_MS);
  expect(f.writes).toHaveLength(0);
  expect(actor.getSnapshot().matches({live:{screen:"view"}})).toBe(true);
  expect(actor.getSnapshot().context.error).toBe("AgentFinished");
 });
 it("ends a session the agent finishes before pairing",async()=>{
  vi.useFakeTimers();
  const {f,actor}=start(pairingInbox);await tick();
  f.finishByAgent();
  await vi.advanceTimersByTimeAsync(PHONE_POLL_MS);
  expect(actor.getSnapshot().matches("ended")).toBe(true);
  expect(actor.getSnapshot().context.endedBy).toBe("agent");
 });
 it("keeps the last cards and marks them stale when a poll fails",async()=>{
  vi.useFakeTimers();
  let fail=false;const f=createCardServices(inbox);
  const {actor}=start(inbox,{readCards:()=>fail?Effect.fail(new Unreachable()):f.service.readCards()});await tick();
  fail=true;await vi.advanceTimersByTimeAsync(3000);
  expect(actor.getSnapshot().context.stale).toBe(true);
  expect(actor.getSnapshot().context.inbox).toEqual(inbox);
 });
});
it("sends nothing when the session expires inside the Undo window",async()=>{
 vi.useFakeTimers();
 const writes:AnswerInput[]=[];
 const layer=Layer.succeed(CardApi,{readCards:()=>Effect.succeed(seed),answerCard:(_,input)=>{writes.push(input);return Effect.succeed({decisionId:t,answerId:"b".repeat(32),sentAt:when})},endSession:()=>Effect.fail(new Unreachable())});
 const actor=createActor(createCardMachine(layer,()=>Date.parse(seed.session.expiresAt)-UNDO_MS/2,UNDO_MS)).start();
 try{await vi.advanceTimersByTimeAsync(0);actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:1});actor.send({type:"SEND"});await vi.advanceTimersByTimeAsync(UNDO_MS);expect(actor.getSnapshot().matches("expired")).toBe(true);expect(writes).toHaveLength(0)}finally{actor.stop();vi.useRealTimers()}
});
it("keeps a failed send's error out of the end sheet",async()=>{
 vi.useFakeTimers();
 const layer=Layer.succeed(CardApi,{readCards:()=>Effect.succeed(seed),answerCard:()=>Effect.fail(new Unreachable()),endSession:()=>Effect.fail(new Unreachable())});
 const actor=createActor(createCardMachine(layer,()=>Date.parse(seed.session.expiresAt)-3_600_000,0,0)).start();
 try{
  await vi.advanceTimersByTimeAsync(0);actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:1});actor.send({type:"SEND"});await vi.advanceTimersByTimeAsync(10);
  expect(actor.getSnapshot().matches({live:{screen:"sendFailed"}})).toBe(true);
  actor.send({type:"BACK"});actor.send({type:"END"});
  expect(actor.getSnapshot().matches({live:{screen:"confirmEnd"}})).toBe(true);
  expect(actor.getSnapshot().context.error).toBeNull();
  actor.send({type:"CONFIRM_END"});await vi.advanceTimersByTimeAsync(10);
  expect(actor.getSnapshot().matches({live:{screen:"confirmEnd"}})).toBe(true);
  expect(actor.getSnapshot().context.error).not.toBeNull();
 }finally{actor.stop();vi.useRealTimers()}
});
it("expires at the session deadline without waiting for a poll",async()=>{
 vi.useFakeTimers();
 const layer=Layer.succeed(CardApi,{readCards:()=>Effect.succeed(seed),answerCard:()=>Effect.fail(new Unreachable()),endSession:()=>Effect.fail(new Unreachable())});
 const remaining=60_000,actor=createActor(createCardMachine(layer,()=>Date.parse(seed.session.expiresAt)-remaining)).start();
 try{await vi.advanceTimersByTimeAsync(0);expect(actor.getSnapshot().matches({live:{clock:"counting"}})).toBe(true);await vi.advanceTimersByTimeAsync(remaining);expect(actor.getSnapshot().matches("expired")).toBe(true)}finally{actor.stop();vi.useRealTimers()}
});
describe("Send with no usable reply",()=>{
 afterEach(()=>vi.useRealTimers());
 const run=async(answerCard:CardApiService["answerCard"],waitMs:number)=>{
  vi.useFakeTimers();
  const layer=Layer.succeed(CardApi,{readCards:()=>Effect.succeed(seed),answerCard,endSession:()=>Effect.succeed({endedAt:when})});
  const actor=createActor(createCardMachine(layer,()=>Date.parse(when),0)).start();
  await vi.advanceTimersByTimeAsync(0);actor.send({type:"OPEN",decisionId:t});actor.send({type:"SELECT",number:2});actor.send({type:"SEND"});await vi.advanceTimersByTimeAsync(waitMs);
  return actor;
 };
 const receipt={decisionId:t,answerId:"b".repeat(32),sentAt:when};
 it("retries the same frozen answer on its own and lands on sent",async()=>{
  const writes:AnswerInput[]=[];
  const actor=await run((_,input)=>{writes.push(input);return writes.length<3?Effect.fail(new Unreachable()):Effect.succeed(receipt)},SEND_RETRY_BASE_MS*3+10);
  try{expect(writes).toHaveLength(3);expect(writes[2]).toEqual(writes[0]);expect(actor.getSnapshot().matches({live:{screen:"sent"}})).toBe(true)}finally{actor.stop()}
 });
 it("shows the failure only after every retry, and one Close returns to the queue",async()=>{
  const writes:AnswerInput[]=[];
  const actor=await run((_,input)=>{writes.push(input);return Effect.fail(new Unreachable())},SEND_RETRY_BASE_MS*7+10);
  try{expect(writes).toHaveLength(1+SEND_RETRIES);expect(actor.getSnapshot().matches({live:{screen:"sendFailed"}})).toBe(true);actor.send({type:"BACK"});expect(actor.getSnapshot().matches({live:{screen:"queue"}})).toBe(true);expect(actor.getSnapshot().context.pending).toBeNull()}finally{actor.stop()}
 });
 it("never retries a refusal",async()=>{
  const writes:AnswerInput[]=[];
  const actor=await run((_,input)=>{writes.push(input);return Effect.fail(new InvalidInput({reason:"no"}))},SEND_RETRY_BASE_MS*7+10);
  try{expect(writes).toHaveLength(1)}finally{actor.stop()}
 });
});
it("expires an unpaired session at its unpaired deadline",async()=>{
 vi.useFakeTimers();
 const f=createCardServices(pairingInbox),deadline=Date.parse(pairingInbox.session.expiresAt!);
 const actor=createActor(createCardMachine(f.layer,()=>deadline-1000)).start();
 try{await vi.advanceTimersByTimeAsync(0);expect(actor.getSnapshot().matches({live:{clock:"unpaired"}})).toBe(true);f.advance(deadline-f.now());await vi.advanceTimersByTimeAsync(1000);expect(actor.getSnapshot().matches("expired")).toBe(true)}finally{actor.stop();vi.useRealTimers()}
});
