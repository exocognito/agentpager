const {createShapeId,toRichText}=await import('tldraw');
const prior=editor.getCurrentPageId();
let p=editor.getPages().find(p=>p.name==='Current');
if(!p){editor.createPage({id:'page:roger-current',name:'Current'});p=editor.getPages().find(p=>p.name==='Current');}
editor.setCurrentPage(p.id);
if(editor.getCurrentPageShapes().length) throw new Error('Current already contains work');
editor.createShape({id:createShapeId('roger-current-baseline'),type:'text',x:0,y:0,opacity:1,meta:{gen:'roger-current'},props:{w:1000,autoSize:false,font:'sans',color:'black',size:'m',richText:toRichText('OwnerPager / Current\n\nNo merged product design or implementation exists at origin/main bb04a70.\n\nThe initial brief is toy-examples/TOYS.md; updated owner input is mvp-notes.md.\nProposed design: Proposal page. Strategy review: strategy.md.\n\nPR #11 is closed unmerged; its research informs the proposal without changing Blueprint contracts.')}});
if(!editor.getPages().find(p=>p.name==='Sam'))editor.createPage({id:'page:roger-sam',name:'Sam'});
editor.setCurrentPage(prior);
await helpers.saveDoc();
return {created:p.id};
