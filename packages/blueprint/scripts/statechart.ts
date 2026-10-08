import { readFileSync, writeFileSync } from 'node:fs';

const GONE=['SessionExpired','SessionEnded'];
import { createCardMachine } from '../design/machines/cards.ts';
import { createHomeMachine } from '../design/machines/home.ts';
import { createCardServices } from '../design/ui/fixtures/services.ts';
import { createHomeServices } from '../design/ui/fixtures/home.ts';
import { inbox } from '../design/ui/fixtures/decisions.ts';

for(const [file,title,machine] of [['cards','AgentPager cards statechart',createCardMachine(createCardServices(inbox).layer)],['home','AgentPager home statechart',createHomeMachine(createHomeServices([]).layer)]] as const){
type Node=typeof machine.root;
const nodes:Node[]=[];
const alias=(node:Node)=>node.id.replaceAll('.','_');
const lines=['stateDiagram-v2','  direction TB'];
function declare(node:Node,indent:string){
  nodes.push(node);
  const children=Object.values(node.states);
  lines.push(`${indent}state ${JSON.stringify(node.key)} as ${alias(node)}${children.length?' {':''}`);
  if(children.length){
    for(const target of node.initial.target??[])lines.push(`${indent}  [*] --> ${alias(target)}`);
    children.forEach(child=>declare(child,indent+'  '));
    lines.push(`${indent}}`);
  }
}
for(const target of machine.root.initial.target??[])lines.push(`  [*] --> ${alias(target)}`);
Object.values(machine.root.states).forEach(node=>declare(node,'  '));
const gone=new Map<string,{tag:string;from:Set<string>}>();
for(const node of nodes){
  for(const transition of [...node.transitions.values()].flat().concat(node.always??[])){
    const type=transition.eventType;
    const event=type.startsWith('xstate.after.')?`after ${/^\d+$/.test(type.split('.')[2])?`${type.split('.')[2]}ms`:type.split('.')[2]}`:type.startsWith('xstate.done.actor.')?'done':type.startsWith('xstate.error.actor.')?'error':type||'always';
    const guard=transition.guard;
    // An error guard that names its tag reads as that error, such as error: SessionExpired.
    const errorTag=guard&&typeof guard==='object'&&guard.type==='errorIs'&&typeof guard.params==='object'?(guard.params as {tag:string}).tag:null;
    const condition=errorTag?`: ${errorTag}`:guard?` [${typeof guard==='string'?guard:typeof guard==='function'?guard.name:guard.type}]`:'';
    const label=`${event}${condition}${transition.target?'':' (internal)'}`;
    // Every server call shares the session-gone handling, so it is drawn once as a note on its target, not as one arrow per call.
    if(errorTag&&GONE.includes(errorTag)){for(const target of transition.target??[]){const sources=gone.get(alias(target))??{tag:errorTag,from:new Set<string>()};sources.from.add(node.key);gone.set(alias(target),sources)}continue;}
    for(const target of transition.target??[node])lines.push(`  ${alias(node)} --> ${alias(target)} : ${label}`);
  }
  const invokes=node.invoke.map(invoke=>typeof invoke.src==='string'?invoke.src:'actor');
  if(invokes.length)lines.push(`  ${alias(node)} : invokes ${invokes.join(', ')}`);
}
for(const [target,{tag,from}] of gone)lines.push(`  note left of ${target} : Any call answering ${tag} comes here, from ${[...from].join(', ')}`);
const diagram=lines.join('\n')+'\n';
const escaped=diagram.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:15px/1.6 system-ui,sans-serif;margin:24px;background:#fafafa;color:#18181b}h1{font-size:24px}.mermaid{background:white;padding:16px;border:1px solid #d4d4d8;overflow:auto}.mermaid svg{min-width:760px;max-width:100%;height:auto}</style></head><body><h1>${title}</h1><p>Generated from the machine. Named guards refer to its source; an error arrow names the error it handles, and a note on expired and ended stands for every call that can find the session gone. Actions are left out. Internal self-arrows keep the current state; the diagram shows structure, not the code inside each action or service. Scroll the diagram on a narrow screen.</p><pre class="mermaid">${escaped}</pre><script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';mermaid.initialize({startOnLoad:true,theme:'neutral',securityLevel:'strict'});</script></body></html>\n`;
for(const [name,content] of [[`${file}.mmd`,diagram],[`${file}.html`,html]]){
  const path=new URL(`../design/machines/${name}`,import.meta.url);
  if(process.argv.includes('--check')){
    if(readFileSync(path,'utf8')!==content)throw new Error(`${name} differs from the machine; run pnpm diagram`);
  }else writeFileSync(path,content);
}
}
