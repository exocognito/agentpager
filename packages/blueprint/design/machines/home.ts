import { assign, fromCallback, fromPromise, sendTo, setup, type SnapshotFrom } from "xstate";
import { Effect, Either, Schema, type Layer } from "effect";
import { HomeApi } from "../effects/cards.ts";
import { ConnectOpened, HomeSession, PHONE_POLL_MS, type LiveHomeSession, type Token } from "../schemas/exchange.ts";
import { newToken } from "./cards.ts";
// Named so the diagram can show them.
const currentTry=({context,event}:{context:{trying:string|null};event:{connectId:string}})=>event.connectId===context.trying;
const agentJoined=({context,event}:{context:Parameters<typeof newSession>[0];event:{sessions:Parameters<typeof newSession>[1]}})=>newSession(context,event.sessions)!==null;
export type HomeEvent =
 | {type:"CONNECT"|"BACK"|"RETRY"|"REFRESH"}
 | {type:"CONNECT_TRY"|"CONNECT_OPENED"|"CONNECT_FAILED";connectId:Token}
 | {type:"SYNC";sessions:ReadonlyArray<HomeSession>}
 | {type:"FAIL";error:unknown};
// While the Connect sheet is open: the newest registered id, which is the one on screen; the newest id being
// registered, and whether that failed; the sessions held when the sheet opened, and the first one an agent made after.
export interface HomeContext { sessions:ReadonlyArray<HomeSession>|null; connectId:Token|null; trying:Token|null; offline:boolean; known:ReadonlyArray<string>; joined:LiveHomeSession|null; stale:boolean; error:string|null }
const Sessions=Schema.Array(HomeSession);
const tag=(error:unknown)=>error&&typeof error==="object"&&"_tag" in error?String(error._tag):"Unreachable";
const newSession=(c:HomeContext,sessions:ReadonlyArray<HomeSession>)=>sessions.find((s):s is LiveHomeSession=>"sessionId" in s&&s.status==="unpaired"&&!c.known.includes(s.sessionId))??null;
export function createHomeMachine(layer:Layer.Layer<HomeApi>,makeId:()=>Token=newToken){
 const read=async(signal:AbortSignal)=>{
  const result=await Effect.runPromise(Effect.either(Effect.provide(Effect.flatMap(HomeApi,api=>api.listSessions()),layer)),{signal});
  if(Either.isLeft(result))throw result.left;return Schema.decodeUnknownSync(Sessions)(result.right);
 };
 return setup({types:{context:{} as HomeContext,events:{} as HomeEvent},
  actors:{
   load:fromPromise<ReadonlyArray<HomeSession>>(({signal})=>read(signal)),
   // C9: one connect id each time the sheet opens. An id goes on screen only once registered, so nobody can register
   // it first; a failed one is replaced by a new id every PHONE_POLL_MS until one registers.
   connect:fromCallback(({sendBack})=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    const open=async()=>{
     const connectId=makeId();sendBack({type:"CONNECT_TRY",connectId});
     const result=await Effect.runPromise(Effect.either(Effect.provide(Effect.flatMap(HomeApi,api=>api.openConnect(connectId)),layer)),{signal:controller.signal}).catch(()=>null);
     if(controller.signal.aborted)return;
     const opened=!!result&&Either.isRight(result)&&Schema.is(ConnectOpened)(result.right);
     sendBack({type:opened?"CONNECT_OPENED":"CONNECT_FAILED",connectId});
     if(!opened)timer=setTimeout(()=>void open(),PHONE_POLL_MS);
    };
    void open();
    return()=>{controller.abort();clearTimeout(timer)};
   }),
   poll:fromCallback<{type:"PULL"}>(({sendBack,receive})=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let running=false;
    const pull=async()=>{if(running)return;running=true;clearTimeout(timer);try{const sessions=await read(controller.signal);if(!controller.signal.aborted)sendBack({type:"SYNC",sessions})}catch(error){if(!controller.signal.aborted)sendBack({type:"FAIL",error})}finally{running=false;if(!controller.signal.aborted)timer=setTimeout(pull,PHONE_POLL_MS)}};
    timer=setTimeout(pull,PHONE_POLL_MS);receive(()=>{void pull()});return()=>{controller.abort();clearTimeout(timer)};
   }),
  },
 }).createMachine({id:"home",initial:"loading",context:{sessions:null,connectId:null,trying:null,offline:false,known:[],joined:null,stale:false,error:null},states:{
  loading:{invoke:{src:"load",onDone:{target:"list",actions:assign({sessions:({event})=>event.output,stale:false,error:null})},onError:{target:"failed",actions:assign({error:({event})=>tag(event.error)})}}},
  failed:{on:{RETRY:"loading"}},
  // A failed poll keeps the last rows and marks them stale; it never empties the list.
  list:{invoke:{id:"poll",src:"poll"},initial:"browse",on:{
   REFRESH:{actions:sendTo("poll",{type:"PULL"})},
   SYNC:{actions:assign({sessions:({event})=>event.sessions,stale:false})},
   FAIL:{actions:assign({stale:true})},
  },states:{
   browse:{on:{CONNECT:{target:"connect",actions:assign({known:({context})=>(context.sessions??[]).flatMap(s=>"sessionId" in s?[s.sessionId]:[])})}}},
   connect:{initial:"listening",
    on:{BACK:{target:"browse",actions:assign({connectId:null,trying:null,offline:false,joined:null})}},
    states:{
     listening:{invoke:{src:"connect"},on:{
      CONNECT_TRY:{actions:assign({trying:({event})=>event.connectId})},
      CONNECT_OPENED:{guard:currentTry,actions:assign({connectId:({event})=>event.connectId,offline:false})},
      CONNECT_FAILED:{guard:currentTry,actions:assign({offline:true})},
      // The first session an agent makes while the sheet is open is the one to pair: the screen opens its pairing card.
      SYNC:[{guard:agentJoined,target:"opening",actions:assign({sessions:({event})=>event.sessions,stale:false,joined:({context,event})=>newSession(context,event.sessions)})},{actions:assign({sessions:({event})=>event.sessions,stale:false})}],
     }},
     opening:{},
    }},
  }},
 }});
}
export type HomeSnapshot=SnapshotFrom<ReturnType<typeof createHomeMachine>>;
