import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { STAGES, RELEASE_TAG, stageOf, deployRefusal, hostRefusal, stageConfig } from '../scripts/stages.ts';
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
