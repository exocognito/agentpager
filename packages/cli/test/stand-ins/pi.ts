import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// A stand-in for the `pi` command under setup: `pi list` and `pi install`, as pi 1.4.0 did them in the real run of
// 9 Nov 2026 (the pull request has it). It keeps its packages in $STAND_IN/pi.json and every call it got in
// $STAND_IN/pi.calls. A package is the folder as it was given, never the folder the file system names, so one folder
// given two ways is two packages, as in pi. $STAND_IN/pi.mode makes it misbehave: `unreadable-settings`, where pi says
// it installed, exits 0 and records nothing; `install-fails`; `list-fails`.
const dir = process.env.STAND_IN ?? '', file = path.join(dir, 'pi.json'), argv = process.argv.slice(2), said = argv.join(' ');
const packages: string[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
const mode = existsSync(path.join(dir, 'pi.mode')) ? readFileSync(path.join(dir, 'pi.mode'), 'utf8').trim() : '';
const out = (text: string) => process.stdout.write(text + '\n');
appendFileSync(path.join(dir, 'pi.calls'), JSON.stringify(argv) + '\n');
// What it was handed in its environment that names a pager, if anything: setup hands an app none.
if (process.env.AGENTPAGER_PAGER !== undefined) appendFileSync(path.join(dir, 'pi.environment'), `AGENTPAGER_PAGER=${process.env.AGENTPAGER_PAGER}\n`);
process.stderr.write('Warning: No models match pattern "stand-in/none"\n');

if (said === 'list --no-approve') {
  if (mode === 'list-fails') { process.stderr.write('Error: it failed\n'); process.exit(1); }
  out(packages.length === 0 ? 'No packages installed.' : ['User packages:', ...packages.flatMap(p => [`  ${path.relative(dir, p)}`, `    ${p}`])].join('\n'));
} else if (argv.length === 3 && argv[0] === 'install' && argv[2] === '--no-approve') {
  const folder = path.resolve(argv[1]);
  out(`Installing ${argv[1]}...`);
  if (mode === 'install-fails') { process.stderr.write('Error: it failed\n'); process.exit(1); }
  if (!existsSync(folder)) { process.stderr.write(`Error: Path does not exist: ${folder}\n`); process.exit(1); }
  // pi loads what the package's manifest names.
  const manifest: unknown = (() => { try { return JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8')).pi?.extensions; } catch { return null; } })();
  if (!Array.isArray(manifest) || !manifest.every(m => typeof m === 'string' && existsSync(path.join(folder, m)))) { process.stderr.write('Error: the package names an extension that is not there\n'); process.exit(1); }
  if (mode === 'unreadable-settings') process.stderr.write('Warning (package command, global settings): Unexpected token \'/\', "// mine\n{ "... is not valid JSON\n');
  else if (!packages.includes(folder)) { packages.push(folder); writeFileSync(file, JSON.stringify(packages, null, 2) + '\n'); }
  out(`Installed ${argv[1]}`);
} else { process.stderr.write(`Error: unknown command ${said}\n`); process.exit(1); }
