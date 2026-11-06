import { createRoot } from 'react-dom/client';
import { MarketingScreen, isDevHost } from './site/MarketingScreen.tsx';

// The web serves the front page alone. The owner's side of AgentPager is the iPhone app (packages/ios). On a dev
// server the page and its tab say so (B18.6).
const host = location.hostname;
if (isDevHost(host)) document.title = 'AgentPager (dev)';
createRoot(document.getElementById('root')!).render(<MarketingScreen host={host} />);
