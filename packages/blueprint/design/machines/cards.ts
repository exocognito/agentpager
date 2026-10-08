import { assign, fromCallback, fromPromise, sendTo, setup, type SnapshotFrom } from "xstate";
import { Effect, Either, Schedule, Schema, type Layer } from "effect";
import { CardApi, type CardApiService } from "../effects/cards.ts";
import { Inbox, Receipt, Choice, PHONE_POLL_MS, SEND_RETRIES, SEND_RETRY_BASE_MS, UNDO_MS, type AnswerInput, type Token } from "../schemas/exchange.ts";
import { acceptsChoice } from "../ui/components/cards/schemas.ts";
export type CardEvent =
 | {type:"OPEN";decisionId:Token}
 | {type:"SELECT";number:number}
 | {type:"FEEDBACK"|"SEND"|"UNDO"|"BACK"|"RETRY"|"REFRESH"|"END"|"CONFIRM_END"}
 | {type:"EDIT";text:string}
 | {type:"SYNC";inbox:Inbox}
 | {type:"FAIL";error:unknown};
export interface CardContext {
 inbox:Inbox|null; viewing:Token|null; choice:Choice|null; requestId:Token|null;
 pending:AnswerInput|null; endedBy:"owner"|"agent"|null; error:string|null; stale:boolean;
}
export function newToken(): Token {
 const bytes = crypto.getRandomValues(new Uint8Array(24));
 return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_") as Token;
}
export const currentCard=(c:CardContext)=>[...(c.inbox?.open??[]),...(c.inbox?.history??[])].find(d=>d.decisionId===c.viewing)??null;
const tag=(error:unknown)=>error&&typeof error==="object"&&"_tag" in error?String(error._tag):"Unreachable";
export function createCardMachine(layer:Layer.Layer<CardApi>,now=Date.now,undoMs=UNDO_MS,sendRetries=SEND_RETRIES){
 const call=async <A>(fn:(api:CardApiService)=>Effect.Effect<A,any>,signal:AbortSignal):Promise<A>=>{
  const result=await Effect.runPromise(Effect.either(Effect.provide(Effect.flatMap(CardApi,fn),layer)),{signal});
  if(Either.isLeft(result))throw result.left;return result.right;
 };
 const read=async(signal:AbortSignal):Promise<Inbox>=>Schema.decodeUnknownSync(Inbox)(await call(api=>api.readCards(),signal));
 const lifecycle=[
  {guard:{type:"errorIs" as const,params:{tag:"SessionExpired"}},target:"#cards.expired"},
  {guard:{type:"errorIs" as const,params:{tag:"SessionEnded"}},target:"#cards.ended",actions:{type:"endedError" as const,params:({event}:any)=>event.error}},
 ];
 return setup({types:{context:{} as CardContext,events:{} as CardEvent},
  actors:{
   load:fromPromise<Inbox>(({signal})=>read(signal)),
   poll:fromCallback<{type:"PULL"}>(({sendBack,receive})=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let running=false;
    const pull=async()=>{if(running)return;running=true;clearTimeout(timer);try{const inbox=await read(controller.signal);if(!controller.signal.aborted)sendBack({type:"SYNC",inbox})}catch(error){if(!controller.signal.aborted)sendBack({type:"FAIL",error})}finally{running=false;if(!controller.signal.aborted)timer=setTimeout(pull,PHONE_POLL_MS)}};
    timer=setTimeout(pull,PHONE_POLL_MS);receive(()=>{void pull()});return()=>{controller.abort();clearTimeout(timer)};
   }),
   // Only an unreachable service is retried; a refusal is an answer. Each retry resends the frozen request (I5).
   answer:fromPromise(async({input,signal}:{input:{decisionId:Token;answer:AnswerInput};signal:AbortSignal})=>{
    const receipt=Schema.decodeUnknownSync(Receipt)(await call(api=>Effect.suspend(()=>api.answerCard(input.decisionId,input.answer)).pipe(Effect.retry({times:sendRetries,schedule:Schedule.exponential(SEND_RETRY_BASE_MS),while:error=>tag(error)==="Unreachable"})),signal));
    if(receipt.decisionId!==input.decisionId)throw new Error("Receipt belongs to another decision");return receipt;
   }),
   end:fromPromise(({signal})=>call(api=>api.endSession(),signal)),
  },
  // Before pairing the deadline is the unpaired one; pairing replaces it, so the clock re-arms on entering counting.
  delays:{undo:()=>undoMs,deadline:({context})=>Math.min(2147483647,Math.max(0,Date.parse(context.inbox!.session.expiresAt!)-now()))},
  guards:{errorIs:({event},p:{tag:string})=>tag((event as {error?:unknown}).error)===p.tag,
   loadedPaired:({event}:any)=>!!event.output?.session.paired,
   syncPaired:({event})=>event.type==="SYNC"&&event.inbox.session.paired,
   exists:({context,event})=>event.type==="OPEN"&&!![...(context.inbox?.open??[]),...(context.inbox?.history??[])].find(d=>d.decisionId===event.decisionId),
   valid:({context})=>{const d=currentCard(context);return !context.inbox?.session.finishedAt&&!!d&&d.status==="open"&&Schema.is(Choice)(context.choice)&&acceptsChoice(d.card,context.choice!)},
   option:({context,event})=>{const d=currentCard(context);return !context.inbox?.session.finishedAt&&event.type==="SELECT"&&!!d&&d.status==="open"&&acceptsChoice(d.card,{kind:"option",number:event.number})},
   feedback:({context})=>{const d=currentCard(context);return !context.inbox?.session.finishedAt&&d?.status==="open"&&d.kind!=="pairing"},
   drafting:({context})=>context.choice?.kind==="feedback",
   pairingRefused:({context,event})=>currentCard(context)?.kind==="pairing"&&tag((event as {error?:unknown}).error)==="InvalidInput",
  },
  actions:{
   sync:assign({inbox:(_,inbox:Inbox)=>inbox,stale:false}),
   syncKeepingDraft:assign(({context,event})=>{
    if(event.type!=="SYNC")return {};
    const next={...context,inbox:event.inbox,stale:false};
    return {inbox:event.inbox,stale:false,choice:currentCard(next)?.status==="open"?context.choice:null};
   }),
   clear:assign({inbox:null,viewing:null,choice:null,requestId:null,pending:null,error:null,stale:false}),
   endedError:assign({endedBy:(_,error:any)=>error.endedBy??null}),
   open:assign({viewing:({event})=>event.type==="OPEN"?event.decisionId:null,choice:null,requestId:()=>newToken(),pending:null,error:null}),
   openPairing:assign({viewing:({context})=>context.inbox?.open.find(d=>d.kind==="pairing")?.decisionId??null,choice:null,requestId:()=>newToken(),pending:null,error:null}),
   // A refused pairing choice is discarded; the next Send is a new request.
   discardRejected:assign({choice:null,pending:null,requestId:()=>newToken()}),
   leave:assign({choice:null,viewing:null,requestId:null,pending:null,error:null}),
   select:assign({choice:({event})=>event.type==="SELECT"?{kind:"option" as const,number:event.number}:null,error:null}),
   edit:assign({choice:({event})=>event.type==="EDIT"?{kind:"feedback" as const,text:event.text}:null}),
   error:assign({error:(_,error:unknown)=>tag(error)}),
  },
 }).createMachine({id:"cards",initial:"loading",context:{inbox:null,viewing:null,choice:null,requestId:null,pending:null,endedBy:null,error:null,stale:false},states:{
  // Before pairing the inbox holds only the pairing card, so it opens at once.
  loading:{invoke:{src:"load",onDone:[{guard:"loadedPaired",target:"#cards.live.clock.counting",actions:{type:"sync",params:({event})=>event.output}},{target:"#cards.live.screen.view",actions:[{type:"sync",params:({event})=>event.output},"openPairing"]}],onError:[...lifecycle,{target:"failed",actions:{type:"error",params:({event}:{event:{error:unknown}})=>event.error}}]}},
  failed:{on:{RETRY:"loading"}},
  live:{type:"parallel",invoke:{id:"poll",src:"poll"},on:{
   REFRESH:{actions:sendTo("poll",{type:"PULL"})},
   SYNC:{actions:"syncKeepingDraft"},
   FAIL:[...lifecycle,{actions:assign({stale:true})}],
  },states:{
   // Transitions stay inside their region: one sourced on live would exit and restart the clock.
   screen:{initial:"queue",states:{
    // A card opens, and the session ends, only from the queue: never while a card is being answered.
    queue:{on:{OPEN:{guard:"exists",target:"view",actions:"open"},END:{target:"confirmEnd",actions:assign({error:null})}}},
    view:{on:{BACK:{target:"queue",actions:assign({error:null})},SELECT:{guard:"option",actions:"select"},FEEDBACK:{guard:"feedback",actions:assign({choice:{kind:"feedback" as const,text:""}})},EDIT:{guard:"drafting",actions:"edit"},SEND:{guard:"valid",target:"undoing",actions:assign({pending:({context})=>({requestId:context.requestId!,choice:context.choice!}),error:null})}}},
    // Send waits UNDO_MS before the answer goes. Undo keeps the draft; closing the card cancels the answer.
    undoing:{after:{undo:"sending"},on:{UNDO:{target:"view",actions:assign({pending:null})},BACK:{target:"queue",actions:"leave"}}},
    sending:{invoke:{src:"answer",input:({context})=>({decisionId:context.viewing!,answer:context.pending!}),onDone:{target:"sent",actions:[assign({error:null}),sendTo("poll",{type:"PULL"})]},onError:[...lifecycle,{guard:{type:"errorIs",params:{tag:"AlreadyAnswered"}},target:"sent",actions:[assign({pending:null,error:"AlreadyAnswered"}),sendTo("poll",{type:"PULL"})]},{guard:"pairingRefused",target:"view",actions:["discardRejected",assign({error:"InvalidInput"})]},{guard:{type:"errorIs",params:{tag:"AgentFinished"}},target:"view",actions:["discardRejected",assign({error:"AgentFinished"}),sendTo("poll",{type:"PULL"})]},{target:"sendFailed",actions:{type:"error",params:({event}:{event:{error:unknown}})=>event.error}}]}},
    // The card stays open on its answer until the agent confirms it or the owner closes it.
    sent:{on:{BACK:{target:"queue",actions:"leave"}}},
    sendFailed:{on:{RETRY:"sending",BACK:{target:"queue",actions:"leave"}}},
    // A failed end returns here with its error; End session tries again.
    confirmEnd:{on:{BACK:{target:"queue",actions:assign({error:null})},CONFIRM_END:{target:"ending",actions:assign({error:null})}}},
    ending:{invoke:{src:"end",onDone:{target:"#cards.ended",actions:assign({endedBy:"owner" as const})},onError:[...lifecycle,{target:"confirmEnd",actions:{type:"error",params:({event}:{event:{error:unknown}})=>event.error}}]}},
   }},
   clock:{initial:"unpaired",states:{
    // This transition takes the event from live's handler, so it carries the same sync.
    // Pairing may already have succeeded while its receipt is delayed. Only the service can confirm
    // an unpaired deadline; expiring locally here would disconnect the first phone (SI2).
    unpaired:{after:{deadline:"verifying"},on:{SYNC:{guard:"syncPaired",target:"counting",actions:"syncKeepingDraft"}}},
    verifying:{entry:sendTo("poll",{type:"PULL"}),on:{SYNC:{guard:"syncPaired",target:"counting",actions:"syncKeepingDraft"}}},
    counting:{after:{deadline:"#cards.expired"}},
   }},
  }},
  expired:{entry:["clear",assign({endedBy:null})]},
  ended:{entry:"clear"},
 }});
}
export type CardSnapshot=SnapshotFrom<ReturnType<typeof createCardMachine>>;
