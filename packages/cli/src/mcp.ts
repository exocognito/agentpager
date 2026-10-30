import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as op from './commands.ts';
import { CONTRACT } from './rules.ts';
import { VERSION } from './version.ts';

// The stdio MCP server: the CLI's operations as tools, with the same replies. Because a harness resends tool
// descriptions every turn, an MCP agent has the contract in context for the whole session (docs/v2/03 §3).
const text = (description: string) => ({ type: 'string', description });
const agent = text('Your agent id from connect, such as ap-7f3k.');
const decision = text('The decision id from ask, such as d_2x8w.');
const prose = (description: string) => text(`${description} Paragraphs, "- " bullets, **bold** and ![alt](file.png) for an attached image; no headings, tables or HTML.`);
const option = {
  type: 'object', additionalProperties: false, required: ['label', 'title', 'prioritizes'],
  properties: {
    label: text('The answer button, at most 20 characters.'), title: text('The option in a few words.'),
    prioritizes: text('What this option optimises for, in your owner\'s terms.'),
    changes: prose('What it changes.'), why: prose('Why choose it.'), why_not: prose('Why pass on it.'), assumes: prose('What it assumes.'),
    looks_like: text('An attached image showing it, such as mock.png.'),
  },
};
const card = {
  type: 'object', additionalProperties: false, required: ['title', 'detail', 'context', 'options', 'recommendation'],
  description: 'The card: the same structure as card.yaml, as a JSON object.',
  properties: {
    title: text('The question, under 100 characters.'),
    detail: text('One line for the inbox: what this decision is about, in plain words. No bookkeeping.'),
    context: { type: 'object', additionalProperties: false, required: ['summary'], properties: {
      heading: text('Shown as "Context: <heading>".'),
      summary: prose('What is happening, what breaks or is lost if nobody decides, and how likely. Three short paragraphs at most.'),
      more: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: text('The row under Context that opens this page.'), body: prose('The background, as a page.') } },
    } },
    options: { type: 'array', minItems: 2, maxItems: 4, items: option, description: 'Two to four different ways to get the job done, lettered A, B, C, D in this order. Never "revise" or "discuss".' },
    tradeoffs: { type: 'array', description: 'One row per concern your owner cares about; a "rating: text" cell per option letter, rating green, yellow, orange or red.', items: { type: 'object', required: ['concern'], properties: { concern: text('What the row compares.') }, additionalProperties: { type: 'string' } } },
    recommendation: { type: 'object', additionalProperties: false, required: ['option', 'why'], properties: { option: text('The letter you recommend.'), why: text('Why, in one line.'), changes_my_mind: text('What would change your mind.') } },
    next_steps: { type: 'object', description: 'What happens after each answer (a line per option letter) and if_no_answer.', properties: { heading: text('Shown as "Next steps: <heading>".'), if_no_answer: text('What happens if nobody answers.') }, additionalProperties: { type: 'string' } },
    attachments: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, required: ['name', 'type', 'base64'], properties: { name: text('The name the card uses, such as flow.png or notes.md.'), type: { type: 'string', enum: ['image/png', 'image/jpeg', 'text/markdown'] }, base64: text('The file\'s bytes, base64.') } } },
  },
};
const schema = (properties: object, required: string[]) => ({ type: 'object', additionalProperties: false, properties, required });

export const TOOLS = [
  { name: 'connect', description: 'Connect to your owner\'s pager with the number they gave you (usually in AGENTS.md). You become a new agent on their phone; keep its id for every later call in this piece of work. Connecting again adds another agent.', inputSchema: schema({ number: text('Your owner\'s pager number, starting ap1_.'), app: text('Who you are, such as Codex; detected when left out.'), project: text('What you are working on; the repository\'s name when left out.') }, ['number']) },
  { name: 'rules', description: 'The card contract: how to write a decision your owner can answer on a phone. Read it before your first `ask`.', inputSchema: schema({ agent }, []) },
  { name: 'review', description: 'Returns your card with what a good card looks like. Give the result to a subagent to grade each point ok, good to fix or must fix; fix the must-fixes, use your judgement on the rest, then `ask`. One round.', inputSchema: schema({ card }, ['card']) },
  { name: 'ask', description: `Ask your owner one decision. Review it once first (see \`review\`). Only broken cards are refused here, with one line per problem. Then:\n\n${CONTRACT}`, inputSchema: schema({ agent, card }, ['agent', 'card']) },
  { name: 'wait', description: 'Wait for the answer. Replies pending, or the option chosen, or your owner\'s note. Keep calling until answered; the answer waits for you.', inputSchema: schema({ agent, decision, seconds: { type: 'integer', minimum: 1, maximum: 50, description: 'How long to hold, at most 50.' } }, ['agent', 'decision']) },
  { name: 'ack', description: 'Tell your owner you read their answer and what you\'ll do. They see it with a green tick. Only the first acknowledgement counts.', inputSchema: schema({ agent, decision, nextSteps: text('What happens next, at most 280 characters.') }, ['agent', 'decision', 'nextSteps']) },
  { name: 'status', description: 'The pager\'s state and this agent\'s open decisions.', inputSchema: schema({ agent }, ['agent']) },
  { name: 'history', description: 'Decisions already asked on this pager from this machine, with their answers. Check here if something may already be decided.', inputSchema: schema({ agent, limit: { type: 'integer', minimum: 1, maximum: 200 } }, ['agent']) },
  { name: 'finish', description: 'You\'re done with this piece of work.', inputSchema: schema({ agent }, ['agent']) },
];

const str = (v: unknown) => typeof v === 'string' ? v : undefined;
const num = (v: unknown) => typeof v === 'number' ? v : undefined;
export async function runTool(name: string, args: { [key: string]: unknown }, client?: string): Promise<op.Result> {
  const a = str(args.agent) ?? '', d = str(args.decision) ?? '';
  switch (name) {
    case 'connect': return op.connect({ number: str(args.number), app: str(args.app), project: str(args.project), mcpClient: client });
    case 'rules': return op.rules(str(args.agent));
    case 'review': return op.review({ object: args.card });
    case 'ask': return op.ask(a, { object: args.card });
    case 'wait': return op.wait(a, d, { seconds: num(args.seconds) });
    case 'ack': return op.ack(a, d, str(args.nextSteps) ?? '');
    case 'status': return op.status(a);
    case 'history': return op.history(a, num(args.limit));
    case 'finish': return op.finish(a);
    default: return { code: 2, text: `No tool ${name}. The tools: ${TOOLS.map(t => t.name).join(', ')}.` };
  }
}

export async function serve() {
  const server = new Server({ name: 'agentpager', version: VERSION }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    // Any failure is a one-line refusal, never a protocol error.
    let result: op.Result;
    try { result = await runTool(request.params.name, request.params.arguments ?? {}, server.getClientVersion()?.name); }
    catch (e) { result = { code: 2, text: `Refused: ${e instanceof Error ? e.message : 'the tool failed'}` }; }
    return { ...(result.code === 0 ? {} : { isError: true }), content: [{ type: 'text', text: result.text }] };
  });
  await server.connect(new StdioServerTransport());
}
