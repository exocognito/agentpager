// Review source for Proposal. Run only after reading the live board and owner notes.
const {createShapeId,toRichText}=await import('tldraw');
const prior=editor.getCurrentPageId();
const page=editor.getPages().find(p=>p.name==='Proposal');
if(!page)throw new Error('Expected Proposal page');
editor.setCurrentPage(page.id);
const old=editor.getCurrentPageShapes();
const owned=old.filter(s=>s.meta.gen==='roger-first-draft');
if(!owned.length)throw new Error('Expected existing OwnerPager/Roger draft');
editor.deleteShapes(owned.map(s=>s.id));
const gen='roger-first-draft';
const sid=k=>createShapeId(`roger-proposal-${k}`);
function text(k,x,y,w,t,c='blue',size='m'){const id=sid(k);editor.createShape({id,type:'text',x,y,opacity:1,meta:{gen},props:{w,autoSize:false,font:'sans',size,color:c,richText:toRichText(t)}});return id;}
function box(k,x,y,w,h,t='',c='blue',size='s'){const id=sid(k);editor.createShape({id,type:'geo',x,y,opacity:1,meta:{gen},props:{geo:'rectangle',w,h,color:c,labelColor:c,fill:'none',font:'sans',size,richText:toRichText(t)}});return id;}
function arrow(a,b,t,bend=0,size='l'){const id=helpers.createArrowBetweenShapes(a,b,{richText:toRichText(t),bend});editor.updateShape({id,type:'arrow',opacity:1,meta:{gen},props:{color:'blue',labelColor:'blue',font:'sans',size}});return id;}
function card(k,x,y,w,h,title,body,c='blue'){box(k,x,y,w,h,'',c);text(k+'t',x+20,y+20,w-40,title,c);text(k+'b',x+20,y+72,w-40,body,c,'s');}
text('title',0,0,2250,'OwnerPager / MVP design','blue','xl');
text('legend',0,80,2250,'Blue = design draft • orange = workshop decisions / remaining detail • black = context.\nScreen IDs and events live outside the UI. Thick arrows trace the normal path.','black','s');
text('source',0,150,2250,'Owner input: mvp-notes.md • Strategy lives only in strategy.md.\nAdopted: ownerpager.com; one selection or Other; Send; numbered emoji choices; details; history; agent acknowledgement.','black','s');
text('path',0,250,2350,'1 Set up → 2 Pair → 3 Ready → 4 Inbox → 5 Read → 6 Select → 7 Send → 8 Review reply','blue');
function screen(n,col,row,title,sub){const x=col*560,y=390+row*1010; text('s'+n+'label',x,y,430,`${n<=8?n+'  ':''}S${n} · ${title}`);box('s'+n,x,y+60,430,720);text('s'+n+'brand',x+24,y+85,382,n===1?'Agent terminal':'OwnerPager');text('s'+n+'sub',x+24,y+140,382,sub,'blue','s');return {x,y:y+60,k:'s'+n};}
function t(s,k,dy,t,size='s'){text(s.k+k,s.x+24,s.y+dy,382,t,'blue',size);}
function btn(s,k,dy,t,w=382){box(s.k+k,s.x+24,s.y+dy,w,54,t);}
function margin(s,t,c='black'){text(s.k+'margin',s.x,s.y+760,440,t,c,'s');}
let s=screen(1,0,0,'Set up','You: Set up at ownerpager.com/start');
t(s,'ready',215,'Scan with your phone to connect.','m');box('qr',s.x+105,s.y+320,220,200,'QR preview');t(s,'link',575,'ownerpager.com/s/…');
margin(s,'S1.1 Scan → CLAIM_SESSION\nAgent reads /start instructions + API schemas; creates session and shows pairing QR/link using its own tools.\nAgent owns its HTTP caller and waiting. No shipped helper or required agent app. QR here is a drawing.','orange');
s=screen(2,1,0,'Handshake','Let your agent know you’re in');
t(s,'question',200,'Choose an emoji to send back.','m');
['🍋','🦊','🌵','🚲','🌙'].forEach((e,i)=>{text('pairnum'+i,s.x+32+i*78,s.y+290,68,i===0?'1 ✓':String(i+1),'blue','s');const id=box('pair'+i,s.x+24+i*78,s.y+332,68,60,e);if(i===0)editor.updateShape({id,type:'geo',props:{fill:'semi'}});});btn(s,'other',425,'Other');btn(s,'send',605,'Send');
margin(s,'S2.1–5 → SELECT(one option)\nS2.6 Other → EDIT_OTHER; S2.7 → SEND\nSame decision lifecycle. Agent echoes emoji in terminal; acknowledgement also completes this history entry.\nOther follows the same flow; proposed echo is its exact text.','orange');
s=screen(3,2,0,'Ready inbox','Inbox');
t(s,'unanswered',220,'Unanswered · 0','m');t(s,'empty',275,'No questions right now.');t(s,'history',385,'Answered · 1','m');btn(s,'row',450,'You’re in · 🍋    ›');t(s,'ack',535,'Agent received your answer.\n“I’ll send my next question here.”');
margin(s,'S3.1 History row → OPEN_HISTORY\nPairing uses the normal acknowledgement, shown in history. No extra pairing prompt or notification. Terminal still echoes 🍋.');
s=screen(4,3,0,'New question','Inbox');
t(s,'unanswered',210,'Unanswered · 1','m');btn(s,'new',275,'NEW · What should I do next?  ›');t(s,'history',420,'Answered · 1','m');btn(s,'old',485,'You’re in · 🍋    ›');
margin(s,'S4.1 New row → OPEN_QUESTION\nS4.2 Answered row → OPEN_HISTORY\nNew/unread work gets priority. List supports the inbox model; max one unanswered item.');
function question(s,selected=false,expanded=false){
text(s.k+'q',s.x+24,s.y+205,315,'What should I do next?');box(s.k+'qi',s.x+366,s.y+200,42,42,'ℹ️');
const base=expanded?330:300;
if(expanded)t(s,'qd',258,'The change is ready. Pick what I should work on before you return.');
const opts=[['🧪','1 · Run the tests'],['📖','2 · Update the docs'],['⏸','3 · Pause here']];
opts.forEach(([e,label],i)=>{const dy=base+i*82;const id=box(s.k+'opt'+i,s.x+24,s.y+dy,64,58,e);if(selected&&i===0)editor.updateShape({id,type:'geo',props:{fill:'semi'}});text(s.k+'opttext'+i,s.x+104,s.y+dy+14,246,label+(selected&&i===0?' ✓':''),'blue','s');box(s.k+'info'+i,s.x+365,s.y+dy+8,42,42,'ℹ️');});
btn(s,'other',base+250,'Other');btn(s,'send',base+325,selected?'Send':'Send (disabled)');
}
s=screen(5,0,1,'Decision','‹ Inbox');question(s);
margin(s,'S5.1 Back → INBOX; S5.2 Question ℹ️ → TOGGLE_DETAIL\nS5.3–5 Emoji → SELECT(optionId)\nS5.6–8 Option ℹ️ → TOGGLE_DETAIL\nS5.9 Other → EDIT_OTHER; S5.10 Send disabled\nNumbers + plain-language text sit beside emoji-only buttons.');
s=screen(6,1,1,'One selection','‹ Inbox');question(s,true);
margin(s,'S6 controls match S5. S6.10 → SEND\nSelecting another option replaces the choice. Selection alone sends nothing. Ordinary answer: one choice tap + one Send tap.');
s=screen(7,2,1,'Sent → inbox','Inbox');
t(s,'unanswered',210,'Unanswered · 0','m');t(s,'empty',268,'No questions right now.');t(s,'history',360,'Answered · 2','m');btn(s,'recent',425,'What should I do next?  ›');t(s,'waiting',500,'You chose 1 · 🧪 Run the tests\nSent · Waiting for agent confirmation');btn(s,'old',610,'You’re in · 🍋    ›');
margin(s,'S7.1 Decision row → OPEN_HISTORY\nS7.2 Pairing row → OPEN_HISTORY\nReturn here after durable acceptance. History grows by one; do not label it “received by agent” yet.');
s=screen(8,3,1,'History + agent reply','‹ Inbox · Answered');
t(s,'q',205,'What should I do next?','m');t(s,'answer',292,'Your answer\n1 · 🧪 Run the tests');t(s,'acktitle',410,'Agent received your answer','m');t(s,'ack',478,'“I’ll run the tests and report the result.”');t(s,'readonly',618,'Sent answers cannot be edited.');
margin(s,'S8.1 Back → INBOX\nRead-only question, answer and acknowledgement. Receipt does not mean work is complete.\nSession + history expire after 7 days without an accepted question, answer or ACK. Reads/polling do not extend it.','orange');
s=screen(9,0,2,'Other response','‹ Inbox');
t(s,'q',205,'What should I do next?','m');t(s,'reference',282,'1 · 🧪 Run the tests\n2 · 📖 Update the docs\n3 · ⏸ Pause here');t(s,'otherlabel',405,'Other','m');box('otherfield',s.x+24,s.y+457,382,105,'Do 1 and then 2.');btn(s,'send',620,'Send');
margin(s,'S9.1 Back → INBOX; S9.2 Text → EDIT_OTHER\nS9.3 → SEND({kind:other, text})\nOne response: an option OR freeform text. Other replaces any chosen option.\nOther is additional to 2–5 agent options; hard max 420 Unicode code points.','orange');
s=screen(10,1,2,'Optional detail','‹ Inbox');question(s,false,true);
margin(s,'S10 controls match S5. ℹ️ toggles inline detail; it does not select or send. Details may scroll; Send stays reachable.\n100/200 chars are guides. Agent fields and Other: hard max 420 Unicode code points. UTF-8 + Markdown; no HTML; reject over-limit text without truncation.','orange');
card('questions',1120,2470,990,690,'Round 3 · decisions recorded in mvp-notes.md',
'Settled: /start supplies instructions + API schemas. Agent writes its own HTTP caller; no shipped helper.\n7-day inactivity expiry; only accepted question / answer / ACK extends it. Reads do not.\n420 Unicode code points per agent text field and Other. 100/200 are writing guides.\nWorker + SQLite Durable Object per session + native Alchemy; HTTPS commands and polling reads.\nFirst phone claims access. Reject newcomers; keep first connected. Original browser reconnects with stored credential.\nUnused pairing link rotates every 420s; old link invalid immediately. Claiming disables it.\n\nRemaining design detail: polling cadence / latency, lost-browser recovery, and whether a new question may precede the previous ACK. These are recorded in Round 4 of mvp-notes.md.', 'orange');
text('machinehead',0,3520,2250,'Statecharts / authoritative answer, phone draft, agent acknowledgement','blue','l');
text('m1label',0,3595,2220,'M1 · Per-decision lifecycle (pairing is a decision too). Session guard: at most one offered/unanswered decision.','black','s');
const offered=box('offered',0,3700,400,135,'offered\nquestion + 2–5 choices');
const accepted=box('accepted',750,3700,440,135,'answered / awaitingAck\nimmutable answer stored');
const ack=box('ack',1600,3700,450,135,'acknowledged\nagent receipt + next steps');
arrow(offered,accepted,'SEND [valid response]');arrow(accepted,ack,'ACK [matching decision + answer]');
text('m1notes',0,3900,2140,'ACK cannot replace the answer. Proposed: new ASK allowed once the prior answer is stored (even if acknowledgement is pending); each acknowledgement names its own decision. Pairing readiness waits for its ACK. Duplicate Send returns the same receipt, not another history row.','blue','s');
text('m2label',0,4080,2150,'M2 · Phone draft — select OR type, then explicitly Send','black','s');
const choosing=box('choosing',0,4200,300,120,'viewing question\nSend disabled');
const option=box('option',590,4200,310,120,'option selected\nexactly one ID');
const submitting=box('submitting',1240,4200,310,120,'sending\ncontrols disabled');
const inbox=box('inboxstate',1860,4200,320,120,'inbox\nread-only history');
const other=box('otherstate',590,4510,310,120,'Other draft\ntext required');
arrow(choosing,option,'SELECT');arrow(option,submitting,'SEND');arrow(submitting,inbox,'ACCEPTED');arrow(choosing,other,'OTHER');arrow(other,submitting,'SEND [nonempty]');
text('m2note',1030,4510,1140,'SELECT another option replaces the selection. OTHER replaces it with text; selecting an option clears the Other mode.\nFailure/unknown outcome: retain draft and show no success. Read by request ID before retrying. Detail toggles do not change the answer.','blue','s');
text('contractshead',0,4790,2280,'Schemas + Effect operations / design proposals','blue','l');
card('data',0,4900,680,560,'Data boundaries',
'Session: ID, pairing token + expiry, phone credential, agent access, lastActivityAt, expiresAt\nDecision: ID, kind (pairing | question), title, detail?, options[]\nOption: stable ID, system number, emoji, title, detail?\nResponse: {optionId} OR {otherText}\nReceipt: decisionId, answerId, requestId\nACK: decisionId, answerId, nextSteps\n\n2–5 agent options PLUS Other. Agent text fields + Other: max 420 Unicode code points; valid UTF-8 Markdown, no HTML. Titles ~100 / details ~200 are guides. Chosen ID must belong to the decision. Immutable answer + later ACK.');
card('effects',730,4900,690,560,'Operations and typed outcomes',
'createSession → pairing link + agent access\nclaimSession → first-phone credential\nrotatePairingLink → invalidate old unused link\nask → decision (guard: no unanswered)\nreadInbox / readDecision → content + response + ACK\nsendResponse → durable receipt\nreadResponse → exact answer / pending (agent polls)\nacknowledge → receipt + next steps stored\nexpireSession → disable access + delete active history\n\nErrors: InvalidInput, QuestionPending, AlreadyAnswered, UnknownSession, SessionExpired, PairingLinkInvalid, AlreadyPaired.\nProposed retry: same request ID + body → same receipt. No assumption that server acceptance wakes an agent.');
card('checks',1470,4900,690,560,'What later checks must prove',
'Pairing echoes emoji in original agent session and completes through ACK. /start instructions suffice for an agent-written HTTP caller.\nTwo taps for an ordinary answer; selection/info never sends.\nOther preserves exact text; max 420 code points for both parties. Invalid UTF-8 / HTML / over-limit text rejected.\nReceipt creates history once; answer cannot change.\nOnly actual ACK says received and shows next steps.\nHistory survives page reopen + service restart.\nSecond question and second phone rejected as specified.\n7-day expiry removes active history; reads do not extend it. Old/claimed pairing links cannot admit another phone.\n\nDraft proof obligations, not passing product checks.');
text('infrahead',0,5610,2250,'Infrastructure / agreed foundation; implementation still to design','blue','l');
const helper=box('helper',0,5750,420,145,'Agent + its own HTTP caller\nreads /start; polls for answer');
const worker=box('worker',820,5750,480,145,'ownerpager.com\nCloudflare Worker\nweb assets + skill + API');
const database=box('database',1690,5750,490,145,'Session Durable Object\nSQLite-backed storage\nquestions / answers / ACKs');
const phone=box('phone',0,6110,420,145,'One paired phone / open tab\nstored session credential');
arrow(helper,worker,'ask / wait / ACK');arrow(phone,worker,'inbox / Send / history');arrow(worker,database,'session binding');
card('foundation',800,6020,1380,360,'R3.Q4 · Agreed foundation',
'Cloudflare Worker + one SQLite-backed Durable Object per session. Native Alchemy declares domain, Worker, assets, DO namespace/binding and migration.\nHTTPS commands + polling reads for phone and agent. Durable storage is the source of truth. Cadence / latency target remain design detail.\n7-day inactivity expiry removes questions, answers and ACKs from active storage. No read-based renewal. Local development storage is isolated. No shipped helper, queues, push service or agent scheduler. No deployment in this workshop.', 'orange');
text('cloudsource',0,6440,2200,'MVP: open-tab delivery, without background / lock-screen notifications. Session expiry is separate from 420-second unused pairing-link rotation.\nRemaining: polling timing, lost-browser recovery and backup-retention detail. No deployment or runtime proof in this canvas.','black','s');
editor.setCurrentPage(prior);
await helpers.saveDoc();
return {updated:page.id,removed:owned.length,preserved:old.length-owned.length};
