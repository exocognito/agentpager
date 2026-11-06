import { json } from './shared.ts';

// HTTPS only (I23.4, blueprint/areas/6-privacy.md). Cloudflare gives the Worker the scheme the caller used in the
// request's URL. A local server keeps plain HTTP: one reached by an IP address, `localhost` or a `.local` name, as the
// suites, `pnpm designs` and the LAN dogfood server are. A deployed stage is only ever reached by its hostname.
export const isLocal = (hostname: string) => /^\[.*\]$|^\d+\.\d+\.\d+\.\d+$/.test(hostname) || /(^|\.)(localhost|local)$/.test(hostname);

// Plain HTTP to a deployed host: GET and HEAD move to the same address on HTTPS; anything else, which may carry a key
// or a decision, is refused unread, so the caller fixes its address rather than sending it again.
export function plainHttp(u: URL, method: string): Response | undefined {
  if (u.protocol !== 'http:' || isLocal(u.hostname)) return undefined;
  const origin = `https://${u.host}`;
  if (method === 'GET' || method === 'HEAD') return Response.redirect(origin + u.pathname + u.search, 308);
  return json({ error: 'HttpsRequired', message: `AgentPager answers only over HTTPS, so this request was refused unread. Send it to ${origin} instead.` }, 403);
}

// Every HTTPS reply from a deployed host tells browsers to keep to HTTPS there for a year: not its subdomains, which
// aren't all AgentPager's, and never a local server's name, where it would stick in a browser.
export const HSTS = 'max-age=31536000';
export const keepsToHttps = (u: URL) => u.protocol === 'https:' && !isLocal(u.hostname);
