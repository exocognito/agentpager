#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import * as op from './commands.ts';
import { serve } from './mcp.ts';
import { setup } from './setup.ts';
import { VERSION } from './version.ts';
import type { Source } from './card.ts';

// agentpager: the CLI, and with `mcp` the stdio MCP server (docs/v2/03-binary-surface.md).
const HELP = `agentpager: send your owner decisions on their phone, and get their answers.

  agentpager connect [<number>] [--app <name>] [--project <name>] [--server <url>]
  agentpager rules [--agent <id>]           the card contract, the card.yaml template, an example
  agentpager example > card.yaml            a complete card to start from
  agentpager review <card.yaml>             your card with what good looks like, for a subagent to grade
  agentpager ask --agent <id> <card.yaml | ->
  agentpager wait --agent <id> <decision> [--forever]
  agentpager ack --agent <id> <decision> "<next steps>"
  agentpager status --agent <id>
  agentpager history --agent <id> [--limit N]
  agentpager finish --agent <id>
  agentpager agents | share --agent <id> | setup [--print] | mcp | version | update

Every command takes --json. Exit codes: 0 done, 2 refused, 4 pager off, 5 no usable reply from the server (unreachable, no reply, or a reply not understood), 6 unknown agent id.
The number can come from AGENTPAGER_PAGER; AGENTPAGER_SERVER and AGENTPAGER_HOME move the server and ~/.agentpager.`;

function parse(argv: string[]) {
  const flags: { [k: string]: string | true } = {}, rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-') rest.push(a);
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      if (v !== undefined) flags[k] = v;
      else if (['json', 'forever', 'print', 'help'].includes(k)) flags[k] = true;
      else flags[k] = argv[++i] ?? '';
    } else rest.push(a);
  }
  return { flags, rest };
}
// A card file, or stdin with "-". stdin must be UTF-8, as a card file must: never sent with replacement characters.
const card = (ref: string | undefined): Source | op.Result | null => {
  if (!ref) return null;
  if (ref !== '-') return { file: ref };
  try { return { yaml: new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(0)), dir: process.cwd() }; }
  catch { return { code: 2, text: "The card on stdin isn't UTF-8 text." }; }
};
const isResult = (c: Source | op.Result): c is op.Result => 'code' in c;

async function run(argv: string[]): Promise<op.Result> {
  const [command, ...args] = argv;
  const { flags, rest } = parse(args);
  const f = (k: string) => typeof flags[k] === 'string' ? String(flags[k]) : undefined;
  const agent = f('agent') ?? '';
  const needsAgent = (r: () => Promise<op.Result> | op.Result) => agent ? r() : { code: 2 as const, text: `Say which agent: agentpager ${command} --agent <id>. Your agents: agentpager agents` };
  switch (command) {
    case 'connect': return op.connect({ number: rest[0], app: f('app'), project: f('project'), server: f('server') });
    case 'rules': return op.rules(f('agent'));
    case 'example': return op.example();
    case 'review': { const c = card(rest[0]); return !c ? { code: 2, text: 'Say which card: agentpager review card.yaml' } : isResult(c) ? c : op.review(c); }
    case 'ask': { const c = card(rest[0]); return needsAgent(() => !c ? { code: 2, text: 'Say which card: agentpager ask --agent <id> card.yaml' } : isResult(c) ? c : op.ask(agent, c)); }
    case 'wait': return needsAgent(() => op.wait(agent, rest[0] ?? '', { forever: flags.forever === true, seconds: f('seconds') ? Number(f('seconds')) : undefined }));
    case 'ack': return needsAgent(() => op.ack(agent, rest[0] ?? '', rest.slice(1).join(' ')));
    case 'status': return needsAgent(() => op.status(agent));
    case 'history': return needsAgent(() => op.history(agent, f('limit') ? Number(f('limit')) : undefined));
    case 'finish': return needsAgent(() => op.finish(agent));
    case 'agents': return op.agents();
    case 'share': return needsAgent(() => op.share(agent));
    case 'setup': return setup(flags.print === true);
    case 'version': return { code: 0, text: `agentpager ${VERSION}` };
    case 'update': return { code: 2, text: 'Self-update is not available yet. Rebuild from the AgentPager repository: pnpm --filter @agentpager/cli build' };
    case undefined: case 'help': return { code: 0, text: HELP };
    default: return { code: 2, text: `No command ${command}.\n\n${HELP}` };
  }
}

const argv = process.argv.slice(2);
if (argv[0] === 'mcp') await serve();
else {
  const result = await run(argv);
  const json = argv.includes('--json');
  process.stdout.write(json ? JSON.stringify({ code: result.code, text: result.text, ...(result.json === undefined ? {} : { result: result.json }) }) + '\n' : result.text + '\n');
  process.exitCode = result.code;
}
