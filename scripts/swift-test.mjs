// The phone's side of the encrypted-part format (packages/ios/AgentPagerCrypto) against packages/contract/vectors/envelope.json:
// `swift test`, which needs Swift, as Xcode has it on a Mac. Part of `pnpm test`. Zero tests run is a failure.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../packages/ios/AgentPagerCrypto');
if (spawnSync('swift', ['--version']).error) {
  console.error('swift is missing: the phone\'s encrypted-part format (packages/ios/AgentPagerCrypto) is tested with `swift test`. Install Xcode, or a Swift toolchain, and run pnpm test again.');
  process.exit(1);
}
const child = spawn('swift', ['test', '--package-path', pkg], { stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { out += chunk; process.stdout.write(chunk); });
child.on('close', code => {
  const ran = [...out.matchAll(/Executed (\d+) tests?, with (\d+) failures?/g)].at(-1);
  if (code === 0 && ran && Number(ran[1]) > 0 && ran[2] === '0') { console.log(`AgentPagerCrypto: ${ran[1]} Swift tests passed.`); process.exit(0); }
  console.error(ran ? `AgentPagerCrypto: ${ran[1]} Swift tests ran, with ${ran[2]} failures.` : 'AgentPagerCrypto: swift test ran no tests.');
  process.exit(code || 1);
});
