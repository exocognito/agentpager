import { createRoot } from 'react-dom/client';
import { MarketingScreen } from '../../blueprint/design/ui/screens/MarketingScreen.tsx';

// The web serves the front page alone. The owner's side of AgentPager is the iPhone app (packages/ios).
createRoot(document.getElementById('root')!).render(<MarketingScreen />);
