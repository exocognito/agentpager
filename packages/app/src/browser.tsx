import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MarketingScreen } from '../../blueprint/design/ui/screens/MarketingScreen.tsx';
import { HomeApp } from '../../blueprint/design/ui/screens/HomeScreen.tsx';
import { CardApp } from '../../blueprint/design/ui/screens/CardScreen.tsx';
import { ClaimScreen, type ClaimStatus } from '../../blueprint/design/ui/screens/ClaimScreen.tsx';
import { hasSessions, migrateTerminalLabels, cardLayer, claim, homeLayer, sweep } from './browser-api.ts';

function Claim({ token }: { token: string }) {
  const [status, setStatus] = useState<ClaimStatus>('claiming');
  useEffect(() => { void claim(token).then(result => {
    if (result === 'over' || result === 'refused') setStatus(result);
    else window.location.replace(`/s/${result}`);
  }).catch(() => setStatus('offline')); }, [token]);
  return <ClaimScreen status={status} />;
}
async function mount() {
  await migrateTerminalLabels();
  await sweep();
  setInterval(sweep, 500);
  const path = window.location.pathname;
  const root = createRoot(document.getElementById('root')!);
  if (path === '/' && hasSessions()) window.location.replace('/app');
  else if (path === '/') root.render(<MarketingScreen />);
  else if (path === '/app') root.render(<HomeApp layer={homeLayer} />);
  else if (path.startsWith('/p/')) root.render(<Claim token={path.split('/')[2]} />);
  else root.render(<CardApp layer={cardLayer(path.split('/')[2])} />);
}
void mount();
