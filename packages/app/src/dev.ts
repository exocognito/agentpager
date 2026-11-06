// A dev server is one whose host starts with `dev.`, such as dev.agentpager.me (B18.5, blueprint/areas/7-getting-started.md).
// /start, the front page and the phone (B23.11) all count it this way, so a local or self-hosted server is never called dev.
export const isDevHost = (host: string) => host.toLowerCase().startsWith('dev.');
