import { createRoot } from 'react-dom/client';
import { MarketingScreen } from './site/MarketingScreen.tsx';
import { isDevHost } from './dev.ts';

// The web serves the front page alone. The owner's side of AgentPager is the iPhone app (packages/ios). On a dev
// server (dev.ts) the page and its tab say so.
const host = location.hostname;
if (isDevHost(host)) document.title = 'AgentPager (dev)';
createRoot(document.getElementById('root')!).render(<MarketingScreen host={host} />);
