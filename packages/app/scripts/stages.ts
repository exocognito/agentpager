// The deployed stages (AGENTS.md › Stages). Each is its own Worker on its own hostname of the agentpager.me zone, so
// each has its own Durable Object namespaces: its own data. Both deploy the same build; only these two names differ.
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

// The Worker's Durable Objects, each a SQLite class under its binding: build.mjs writes them, and the deploy checks that
// the stage has each one, bound by that name.
export const DURABLE_OBJECTS = [['AGENT', 'Agent'], ['REGISTRY', 'Registry'], ['PAGER', 'Pager']] as const;
export type Namespace = { id: string; class: string; script: string; use_sqlite?: boolean };
export type Binding = { type: string; name: string; class_name?: string; namespace_id?: string };
// What is wrong with the stage's storage as Cloudflare reports it, or null: every class a SQLite namespace of the
// Worker, every binding naming its class's namespace, and the push key's secret set.
export function storageRefusal(worker: string, namespaces: readonly Namespace[], bindings: readonly Binding[]): string | null {
  const placement = namespaces.filter(n => n.script === worker);
  for (const [, className] of DURABLE_OBJECTS) if (!placement.some(n => n.class === className && n.use_sqlite === true)) return `${className} is not a SQLite namespace on ${worker}.`;
  for (const [name, className] of DURABLE_OBJECTS) {
    if (!bindings.some(b => b.type === 'durable_object_namespace' && b.name === name && b.class_name === className && placement.some(n => n.id === b.namespace_id && n.class === className))) return `Incorrect ${name} binding.`;
  }
  if (!bindings.some(b => b.type === 'secret_text' && b.name === 'APNS_KEY_P8')) return 'The Worker secret APNS_KEY_P8 is missing, so no alerts go out.';
  return null;
}
// Cloudflare's reads of a Worker's settings can lag a deploy that has just finished, while the Worker already serves
// the new build: on 7 Nov 2026 the check after a deploy failed once with "Incorrect AGENT binding.". So the check is
// asked again, a few times over about 30 s, and fails with what it last saw only after that.
export async function checkSettled(check: () => Promise<string | null>, say: (line: string) => void, wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)), tries = 6, pauseMs = 6_000): Promise<void> {
  for (let n = 1; ; n++) {
    const wrong = await check();
    if (wrong === null) return;
    if (n === tries) throw new Error(`${wrong} (still so after ${tries} checks over ${Math.round(((tries - 1) * pauseMs) / 1000)} s)`);
    say(`${wrong} Cloudflare may not report the deploy yet: checking again in ${pauseMs / 1000} s (${n} of ${tries}).`);
    await wait(pauseMs);
  }
}
