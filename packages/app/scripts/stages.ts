// The deployed stages (AGENTS.md › Stages). Each is its own Worker on its own hostname of the agentpager.me zone, so
// each has its own Agent and Registry namespaces: its own data. Both deploy the same build; only these two names differ.
export const ZONE = 'agentpager.me';
export const STAGES = {
  dev: { name: 'dev', worker: 'ownerpager-dev', host: 'dev.agentpager.me' },
  prod: { name: 'prod', worker: 'ownerpager', host: 'agentpager.me' },
} as const;
export type Stage = (typeof STAGES)[keyof typeof STAGES];

// `--stage dev` or `--stage prod`. There is no default, so nothing reaches prod by leaving the stage out.
export function stageOf(argv: readonly string[]): Stage {
  const at = argv.indexOf('--stage'), name = at === -1 ? undefined : argv[at + 1];
  if (name === 'dev' || name === 'prod') return STAGES[name];
  throw new Error('Name the stage: --stage dev or --stage prod.');
}

// A release tag: m<n> for a milestone, m<n>.<k> for a fix after it, such as m4 and m4.1.
export const RELEASE_TAG = /^m[1-9][0-9]*(\.[1-9][0-9]*)?$/;

// Why this checkout may not deploy to the stage, or null. Every stage deploys a committed, clean tree; prod deploys
// only a commit at a release tag, the one that was green on dev (METHOD.md › Stages and releases).
export function deployRefusal(stage: Stage, git: { status: string; tags: readonly string[]; sha: string }): string | null {
  if (git.status.trim()) return `deploy:${stage.name} refused: the working tree has changes. Commit the candidate and clean the tree.`;
  if (stage.name === 'prod' && !git.tags.some(tag => RELEASE_TAG.test(tag))) {
    return `deploy:prod refused: HEAD (${git.sha.slice(0, 7)}) isn't at a release tag (m<n>, or m<n>.<k> for a fix). Prod deploys only a tag that was green on dev.`;
  }
  return null;
}

export type Domain = { hostname: string; service: string };
export type DnsRecord = { name: string; type: string; meta?: { read_only?: boolean } };
// Run without a terminal, wrangler replaces whatever already holds the hostname, a DNS record or another Worker's
// domain, without asking. So a stage deploys only to a hostname that is free or already its own Worker's domain, whose
// DNS record Cloudflare keeps read-only.
export function hostRefusal(stage: Stage, domains: readonly Domain[], records: readonly DnsRecord[]): string | null {
  const held = domains.filter(d => d.hostname === stage.host);
  const other = held.find(d => d.service !== stage.worker);
  if (other) return `${stage.host} is Worker ${other.service}'s custom domain, which a deploy of ${stage.worker} would take over.`;
  const loose = records.filter(r => r.name === stage.host && !(held.length > 0 && r.meta?.read_only === true));
  if (loose.length) return `${stage.host} already has DNS records (${loose.map(r => r.type).join(', ')}) that a deploy would replace.`;
  return null;
}

// build.mjs writes prod's Worker name and domain. Dev takes its own and keeps everything else, the migrations included,
// so its new Worker gets namespaces of its own. Prod's config is returned as it was built.
export function stageConfig(config: Record<string, unknown>, stage: Stage): Record<string, unknown> {
  const prodRoutes = JSON.stringify([{ pattern: STAGES.prod.host, custom_domain: true }]);
  if (config.name !== STAGES.prod.worker || JSON.stringify(config.routes) !== prodRoutes) {
    throw new Error('The build no longer names prod\'s Worker and domain as stages.ts expects; update stages.ts with it.');
  }
  return stage.name === 'prod' ? config : { ...config, name: stage.worker, routes: [{ pattern: stage.host, custom_domain: true }] };
}
