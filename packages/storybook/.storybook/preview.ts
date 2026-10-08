import type { Preview } from '@storybook/react-vite';
// A link to an app page opens that page's story, since Storybook serves no app routes.
const PAGE_STORIES:[RegExp,string][]=[[/^\/$/,'v1-front-page--front-page'],[/^\/app$/,'v1-home--one-session'],[/^\/start$/,'v1-start--start'],[/^\/s\/[^/]+$/,'v1-session-states--queue']];
document.addEventListener('click',event=>{
  const link=(event.target as Element|null)?.closest?.('a[href]') as HTMLAnchorElement|null;
  // Only inside the Storybook manager; the test runner's frame is left alone.
  if(!link||window.top===window||!window.top!.location.search.includes('path='))return;
  const url=new URL(link.href),story=PAGE_STORIES.find(([path])=>url.origin===location.origin&&path.test(url.pathname))?.[1];
  if(!story)return;
  event.preventDefault();
  window.top!.location.assign(`/?path=/story/${story}`);
},true);
export default {
  afterEach:async({globals})=>{
    const viewport=globals.viewport?.value;
    const expected=viewport==='phone'?390:viewport==='desktop'?1280:undefined;
    if(expected!==undefined && window.innerWidth!==expected)throw new Error(`Expected ${expected}px viewport, got ${window.innerWidth}px`);
  },
  parameters:{options:{storySort:{order:['v1',['Front page','Start','Claim','Home','Session',['States','Journeys']]]}},layout:'fullscreen',a11y:{test:'error'},viewport:{options:{
    phone:{name:'Phone',styles:{width:'390px',height:'844px'}},
    desktop:{name:'Desktop',styles:{width:'1280px',height:'900px'}},
  }}},
} satisfies Preview;
