import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STAGES, RELEASE_TAG, DURABLE_OBJECTS, stageOf, deployRefusal, hostRefusal, stageConfig, storageRefusal, checkSettled, allPages, type Binding, type ListPage, type Namespace } from '../scripts/stages.ts';
import { app } from './support.ts';

const { dev, prod } = STAGES;
const clean = { status: '', tags: [], sha: '0123456789abcdef0123456789abcdef01234567' };

test('A deploy names its stage; there is no default', () => {
  assert.equal(stageOf(['node', 'deploy.mjs', '--stage', 'dev']), dev);
  assert.equal(stageOf(['node', 'deploy.mjs', '--stage', 'prod', '--verify']), prod);
  for (const argv of [['node', 'deploy.mjs'], ['node', 'deploy.mjs', '--stage'], ['node', 'deploy.mjs', '--stage', 'production'], ['node', 'deploy.mjs', 'prod']]) {
    assert.throws(() => stageOf(argv), /Name the stage/, argv.join(' '));
  }
});

test('A release tag is m<n> for a milestone, or m<n>.<k> for a fix after it', () => {
  for (const tag of ['m1', 'm4', 'm4.1', 'm12', 'm12.10']) assert.ok(RELEASE_TAG.test(tag), tag);
  for (const tag of ['m0', 'm04', 'm4.0', 'm4.', 'm4.1.2', 'M4', 'v4', 'm4-rc', 'mencrypt', 'blueprint-old-format', 'm4\nm5']) assert.equal(RELEASE_TAG.test(tag), false, tag);
});

test('deploy:dev takes any clean tree; deploy:prod only a clean tree at a release tag', () => {
  assert.equal(deployRefusal(dev, clean), null);
  assert.equal(deployRefusal(dev, { ...clean, tags: ['blueprint-old-format'] }), null);
  assert.match(deployRefusal(dev, { ...clean, status: ' M packages/app/src/worker.ts\n' }) ?? '', /^deploy:dev refused: the working tree has changes/);
  assert.match(deployRefusal(dev, { ...clean, status: '?? notes.md\n' }) ?? '', /working tree has changes/, 'an untracked file counts');
  assert.match(deployRefusal(prod, clean) ?? '', /^deploy:prod refused: HEAD \(0123456\) isn't at a release tag/);
  assert.match(deployRefusal(prod, { ...clean, tags: ['blueprint-old-format', 'm4-rc'] }) ?? '', /isn't at a release tag/);
  assert.equal(deployRefusal(prod, { ...clean, tags: ['m4'] }), null);
  assert.equal(deployRefusal(prod, { ...clean, tags: ['blueprint-old-format', 'm4.1'] }), null);
  assert.match(deployRefusal(prod, { ...clean, tags: ['m4'], status: ' M package.json\n' }) ?? '', /^deploy:prod refused: the working tree has changes/, 'a tag does not excuse a dirty tree');
});

test('A deploy refuses a hostname that is neither free nor already its own Worker\'s domain', () => {
  const own = { hostname: dev.host, service: dev.worker }, managed = { name: dev.host, type: 'AAAA', meta: { read_only: true } };
  const others = [{ hostname: prod.host, service: prod.worker }, { hostname: 'dev.atomic.page', service: 'atomicpage-dev' }];
  assert.equal(hostRefusal(dev, others, []), null, 'free: the first deploy');
  assert.equal(hostRefusal(dev, [...others, own], [managed]), null, 'its own domain and the record Cloudflare keeps for it');
  assert.match(hostRefusal(dev, [...others, { hostname: dev.host, service: 'something-else' }], [managed]) ?? '', /Worker something-else's custom domain/);
  assert.match(hostRefusal(dev, others, [{ name: dev.host, type: 'CNAME' }]) ?? '', /already has DNS records \(CNAME\)/, 'a record of its own');
  assert.match(hostRefusal(dev, others, [managed]) ?? '', /AAAA/, 'a read-only record with no domain of this Worker\'s');
  assert.match(hostRefusal(dev, [...others, own], [managed, { name: dev.host, type: 'TXT' }]) ?? '', /\(TXT\)/, 'a record beside the domain\'s');
  assert.equal(hostRefusal(prod, others, [{ name: prod.host, type: 'AAAA', meta: { read_only: true } }]), null, 'prod as it is today');
});

test('Dev deploys the same build as prod under its own Worker and domain; prod\'s config is left as built', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'agentpager-stages-'));
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: app, env: { ...process.env, AGENTPAGER_BUILD_DIR: out }, stdio: 'ignore', timeout: 120_000 });
  const built: Record<string, unknown> = JSON.parse(readFileSync(path.join(out, 'wrangler.json'), 'utf8'));
  assert.equal(stageConfig(built, prod), built);
  const config = stageConfig(built, dev);
  assert.equal(config.name, 'ownerpager-dev');
  assert.deepEqual(config.routes, [{ pattern: 'dev.agentpager.me', custom_domain: true }]);
  // Everything else, the migrations and APNs settings included, is prod's.
  const { name: _n, routes: _r, ...rest } = config, { name: _pn, routes: _pr, ...prodRest } = built;
  assert.deepEqual(rest, prodRest);
  assert.throws(() => stageConfig({ ...built, name: 'renamed' }, dev), /no longer names prod's Worker/);
  assert.throws(() => stageConfig({ ...built, routes: [{ pattern: 'agentpager.me/*', zone_name: 'agentpager.me' }] }, prod), /no longer names prod's Worker/);
});

test('The build binds every Durable Object the deploy checks, each a SQLite class some migration makes', () => {
  const out = mkdtempSync(path.join(tmpdir(), 'agentpager-stages-'));
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: app, env: { ...process.env, AGENTPAGER_BUILD_DIR: out }, stdio: 'ignore', timeout: 120_000 });
  const built = JSON.parse(readFileSync(path.join(out, 'wrangler.json'), 'utf8'));
  assert.deepEqual(built.durable_objects.bindings, DURABLE_OBJECTS.map(([name, class_name]) => ({ name, class_name })));
  const made = built.migrations.flatMap((m: { new_sqlite_classes?: string[]; renamed_classes?: { to: string }[] }) => [...(m.new_sqlite_classes ?? []), ...(m.renamed_classes ?? []).map(r => r.to)]);
  for (const [, className] of DURABLE_OBJECTS) assert.ok(made.includes(className), `${className} is made by a migration`);
  // Each migration tag once, in order, the pager's store's the last.
  assert.deepEqual(built.migrations.map((m: { tag: string }) => m.tag), ['v1', 'v2', 'v3', 'v4']);
  assert.deepEqual(built.migrations.at(-1), { tag: 'v4', new_sqlite_classes: ['Pager'] });
});

// What Cloudflare reports of a stage's storage, as the deploy reads it.
const worker = 'ownerpager-dev';
const namespaces: Namespace[] = DURABLE_OBJECTS.map(([, className], i) => ({ id: `ns${i}`, class: className, script: worker, use_sqlite: true }));
const bindings: Binding[] = [...DURABLE_OBJECTS.map(([name, class_name], i) => ({ type: 'durable_object_namespace', name, class_name, namespace_id: `ns${i}` })), { type: 'secret_text', name: 'APNS_KEY_P8' }];

test('The deploy checks every class is a SQLite namespace of its Worker, bound by its name, and the push key is set', () => {
  assert.equal(storageRefusal(worker, namespaces, bindings), null);
  assert.equal(storageRefusal(worker, namespaces.filter(n => n.class !== 'Pager'), bindings), 'Pager is not a SQLite namespace on ownerpager-dev.');
  assert.equal(storageRefusal(worker, namespaces.map(n => n.class === 'Pager' ? { ...n, use_sqlite: false } : n), bindings), 'Pager is not a SQLite namespace on ownerpager-dev.');
  assert.equal(storageRefusal(worker, namespaces.map(n => ({ ...n, script: 'ownerpager' })), bindings), 'Agent is not a SQLite namespace on ownerpager-dev.');
  assert.equal(storageRefusal(worker, namespaces, bindings.filter(b => b.name !== 'PAGER')), 'Incorrect PAGER binding.');
  // A binding to another class's namespace, as a lagging read of the settings can show.
  assert.equal(storageRefusal(worker, namespaces, bindings.map(b => b.name === 'AGENT' ? { ...b, namespace_id: 'ns2' } : b)), 'Incorrect AGENT binding.');
  assert.equal(storageRefusal(worker, namespaces, bindings.filter(b => b.type !== 'secret_text')), 'The Worker secret APNS_KEY_P8 is missing, so no alerts go out.');
});

test('The deploy reads every page of a Cloudflare list, as it must for the account\'s namespaces', async () => {
  // As on dev on 7 Nov 2026: 21 namespaces, 20 a page, and the new Pager namespace alone on the second page.
  const [agent, registry, pager] = namespaces;
  const others: Namespace[] = Array.from({ length: 18 }, (_, i) => ({ id: `other${i}`, class: 'Site', script: 'atomicpage', use_sqlite: true }));
  const pages = [[...others, registry, agent], [pager]];
  const lister = (info: (page: number) => ListPage<Namespace>['result_info'], held = pages) => {
    const asked: number[] = [];
    return { asked, read: async (page: number): Promise<ListPage<Namespace>> => { asked.push(page); return { result: held[page - 1] ?? [], result_info: info(page) }; } };
  };
  assert.equal(storageRefusal(worker, pages[0], bindings), 'Pager is not a SQLite namespace on ownerpager-dev.', 'the first page alone');
  const counted = lister(page => ({ page, per_page: 20, total_pages: 2, total_count: 21 }));
  const all = await allPages(counted.read);
  assert.deepEqual([counted.asked, all.length], [[1, 2], 21]);
  assert.equal(storageRefusal(worker, all, bindings), null);
  // With no total_pages, total_count and per_page count them.
  const byCount = lister(page => ({ page, per_page: 20, total_count: 21 }));
  assert.equal((await allPages(byCount.read)).length, 21);
  assert.deepEqual(byCount.asked, [1, 2]);
  // A list that reports no pages, as the Workers domains list documents none, is read once.
  const unpaged = lister(() => undefined);
  assert.deepEqual([(await allPages(unpaged.read)).length, unpaged.asked], [20, [1]]);
  // An empty page ends the list, whatever result_info claims.
  const claimsMore = lister(page => ({ page, per_page: 20, total_pages: 5 }));
  assert.deepEqual([(await allPages(claimsMore.read)).length, claimsMore.asked], [21, [1, 2, 3]]);
  // A list that never ends fails rather than reading forever.
  const endless = lister(page => ({ page, per_page: 1, total_pages: 1_000 }), Array.from({ length: 1_000 }, () => [agent]));
  await assert.rejects(allPages(endless.read, 4), { message: 'Cloudflare\'s list runs past 4 pages.' });
  assert.deepEqual(endless.asked, [1, 2, 3, 4]);
});

test('The deploy asks again while Cloudflare\'s reads lag the deploy, and fails with what it last saw after about 30 s', async () => {
  const waits: number[] = [], said: string[] = [], wait = async (ms: number) => { waits.push(ms); };
  let asked = 0;
  // Right on the third read.
  await checkSettled(async () => ++asked < 3 ? 'Incorrect AGENT binding.' : null, line => said.push(line), wait);
  assert.deepEqual([asked, waits], [3, [6_000, 6_000]]);
  assert.match(said[0], /^Incorrect AGENT binding\. Cloudflare may not report the deploy yet: checking again in 6 s \(1 of 6\)\.$/);
  // Never right: six reads over 30 s, then it fails with the last.
  asked = 0; waits.length = 0;
  await assert.rejects(checkSettled(async () => { asked++; return `Incorrect PAGER binding.`; }, () => {}, wait), { message: 'Incorrect PAGER binding. (still so after 6 checks over 30 s)' });
  assert.deepEqual([asked, waits.reduce((a, b) => a + b, 0)], [6, 30_000]);
  // A failure to read at all isn't asked again: it fails at once.
  asked = 0;
  await assert.rejects(checkSettled(async () => { asked++; throw new Error('Cloudflare operation failed'); }, () => {}, wait), /operation failed/);
  assert.equal(asked, 1);
});
