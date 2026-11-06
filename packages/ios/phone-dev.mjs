#!/usr/bin/env node
// pnpm phone:dev: builds the app with dev.agentpager.me as its server, then installs and launches it on the dev phone,
// HomePhoneLite (AGENTS.md › Stages). Only this build points at dev: the project's default stays agentpager.me, since
// Sam's own iPhone takes the same team's builds. The Settings app's Server field still overrides the build's default.
// Signing is the project's own automatic signing with the profile already on this Mac; it never asks Apple for more.
//   node packages/ios/phone-dev.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PHONE = 'HomePhoneLite', SERVER = 'https://dev.agentpager.me', BUNDLE = 'me.agentpager.app.dev';
const ios = fileURLToPath(new URL('.', import.meta.url));
const derived = path.join(tmpdir(), 'agentpager-phone-dev-build'); // kept between runs, so a rebuild is incremental
const fail = message => { console.error(`pnpm phone:dev: ${message}`); process.exit(1); };
const step = text => console.log(`· ${text}`);

// Runs a command with its output shown, and stops at its first failure with what it printed.
function run(command, args, what) {
  const r = spawnSync(command, args, { cwd: ios, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) {
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const errors = output.split('\n').filter(line => /error[:]|failed|Error Domain|No profiles|Signing/i.test(line)).slice(-15).join('\n');
    fail(`${what} failed (exit ${r.status ?? r.signal}):\n${errors || output.split('\n').slice(-25).join('\n')}`);
  }
  return r.stdout;
}

// The phone by name, among the devices this Mac has paired; never a Simulator of the same name.
function phone() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'agentpager-devices-')), 'devices.json');
  run('xcrun', ['devicectl', 'list', 'devices', '--json-output', file], 'Listing devices');
  const devices = JSON.parse(readFileSync(file, 'utf8')).result?.devices ?? [];
  const found = devices.filter(d => d.deviceProperties?.name === PHONE && d.connectionProperties?.transportType !== 'sameMachine');
  if (found.length === 0) fail(`no device named ${PHONE} is paired with this Mac. Seen: ${devices.map(d => d.deviceProperties?.name).filter(Boolean).join(', ') || 'none'}.`);
  if (found.length > 1) fail(`${found.length} devices are named ${PHONE}; rename one.`);
  const d = found[0];
  if (d.connectionProperties?.tunnelState !== 'connected') fail(`${PHONE} is paired but not connected (${d.connectionProperties?.tunnelState}). Connect it by cable or on the same Wi-Fi, and unlock it once.`);
  return { id: d.identifier, udid: d.hardwareProperties?.udid, os: d.deviceProperties?.osVersionNumber };
}

const device = phone();
step(`${PHONE} (iOS ${device.os}), device ${device.id}`);
step(`Building with AGENTPAGER_SERVER_URL=${SERVER}`);
run('xcodebuild', ['build', '-project', 'AgentPager.xcodeproj', '-scheme', 'AgentPager', '-configuration', 'Debug',
  '-destination', `platform=iOS,id=${device.udid}`, '-derivedDataPath', derived, `AGENTPAGER_SERVER_URL=${SERVER}`], 'The build');
const app = path.join(derived, 'Build/Products/Debug-iphoneos/AgentPager.app');
const built = execFileSync('plutil', ['-extract', 'AgentPagerServerURL', 'raw', path.join(app, 'Info.plist')], { encoding: 'utf8' }).trim();
if (built !== SERVER) fail(`the build's server is ${built}, not ${SERVER}`);
step(`Built ${app}, server ${built}`);
run('xcrun', ['devicectl', 'device', 'install', 'app', '--device', device.id, app], 'Installing on the phone');
step(`Installed ${BUNDLE} on ${PHONE}`);
run('xcrun', ['devicectl', 'device', 'process', 'launch', '--device', device.id, BUNDLE], 'Launching (an unlocked phone may be needed)');
console.log(`Done: ${PHONE} runs the app with ${SERVER} as its default server.`);
