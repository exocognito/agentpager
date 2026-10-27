import { SchemaAST, type Schema } from 'effect';
import { SESSION_NAME_MAX_CHARACTERS, SessionInput, PhoneJoined, UNPAIRED_LIFETIME_MS, ANSWER_WAIT_MAX_MS, Acknowledgement, AcknowledgementInput, AgentStatus, Answer, BODY_MAX_CHARACTERS, Choice, Decision, DecisionKind, DecisionStatus, EMOJI_MAX_CODE_POINTS, Option, OPTIONS_MAX, PAIRING_OPTION_COUNT, PairingLink, QuestionInput, SESSION_LIFETIME_MS, SessionCreated, SessionSummary, TEXT_MAX_CHARACTERS, TOKEN_LENGTH } from '../../schemas/exchange.ts';
import { schemas as cardSchemas } from '../components/cards/schemas.ts';
import { BRIEF_OPTIONS_MAX, BRIEF_OPTIONS_MIN } from '../components/cards/brief/schema.ts';
import { AGENT_AUTH_HEADER, HTTP_STATUS, MCP, PHONE_AUTH_HEADER, ROUTES } from '../../effects/session.ts';

export const PRODUCTION_ORIGIN = 'https://agentpager.me';
export const CARD_AGENT_INSTRUCTION = `Connect AgentPager at ${new URL(PRODUCTION_ORIGIN).host}${ROUTES.start.path}`;
// The link the Connect sheet gives an agent: the start document for that phone's connect id.
export const connectUrl = (connectId: string, origin = PRODUCTION_ORIGIN) => `${origin}${ROUTES.connectPage.path.replace(':connectId', connectId)}`;
const seconds = (ms: number) => Math.round(ms / 1000);
const hours = (ms: number) => Math.round(ms / 3_600_000);
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

// The design owns this document. Tables derive field names, optionality and routes; bounds use schema constants.
// Explanations and examples are authored here. The product serves startDocument(origin) as it is.
export const START = {
  title: 'AgentPager for agents',
  what: ['AgentPager brings decision cards from you to your owner’s phone: a question with numbered options you write.', 'Your owner answers each card in any order; you read the answer, acknowledge it and carry on.'],
  wayIn: {
    https: 'If you can send HTTPS requests, start now over HTTPS. Do not ask your owner first.',
    mcp: 'If you can only fetch pages, ask your owner to add the AgentPager MCP server to your app, once, then use its tools.',
  },
  waiting: `Wait for the answer yourself: read it again and again until you have it, then tell your owner what they chose and acknowledge it. One read holds for up to ${seconds(ANSWER_WAIT_MAX_MS)} seconds, so allow at least ${seconds(ANSWER_WAIT_MAX_MS) + 10} seconds per command. Do not hand the wait to a background process, and do not end your turn before you have the answer.`,
  conduct: [
    'When your owner asks you to ask them which of two options to take, choose two plain options yourself. Never ask your owner to invent them.',
    `Name the session so your owner can tell it apart on their phone: your app, then the project or task, such as \`Claude Code · blueprint\`, within ${SESSION_NAME_MAX_CHARACTERS} characters.`,
    'Create the session (unless your owner gave you a connect link; see below), then show your owner the pairing QR code, the full pairing link as text right below it, and the target emoji in a progress message before calling an answer read. Your owner can open the link instead of scanning. A tool result is not an owner-facing message. Put pairing.qrText in a fenced code block so it scans from a terminal; if your client shows images, also publish `![Pairing QR](<the exact pairing.qrUrl>)`. Downloading or converting the image locally does not show it to your owner; do not say “QR above” unless the QR is in that message. Keep your turn open after publishing. Immediately wait for the pairing answer and acknowledge it, then carry out the owner’s requested exchange. Do not ask your owner to say they paired. Do not send a final response merely because you have shown the pairing link; finish the requested answer and acknowledgement steps first. Other independent cards may remain open; finish only the selected exchange before responding.',
    'Every message that refers to the pairing link repeats its full URL.',
    'Finish the session when your work is done. Your key stops working, and your owner can still read every card and acknowledgement until they end the session or it expires.',
    'Adding AgentPager to your app adds tools to this same conversation; it needs no new chat. Once your owner says it is added, call `start_session` (or `join_session` for a connect link) directly. MCP resources are not tools: an empty resource list does not mean the tools are missing.',
  ],
  // Replaces the three pairing-link lines of conduct, and the pairing-link section, on a connect page.
  connectConduct: 'Join your owner’s phone once, then tell your owner the pairingTarget emoji in a progress message before calling an answer read: select that emoji, then tap Send. There is no link or QR image to show; your owner’s phone already holds the session. Keep your turn open. Immediately wait for the pairing answer and acknowledge it, then carry out the owner’s requested exchange. Do not ask your owner to say they paired.',
  showLink: {
    terminal: 'In a terminal, show pairing.qrText in a code block and the full link. In a desktop app that shows images, show the QR image and the full link.',
    chat: 'In a chat app on your owner’s phone, show the full link to tap and the QR image.',
    target: 'Either way, name the pairingTarget emoji: your owner must select that emoji, then tap Send.',
  },
  ownerStep: 'A step only your owner can do is marked so below, with what to tell them.',
  setup: [
    ['Claude Code', origin => `claude mcp add --transport http agentpager "${origin}${ROUTES.mcp.path}"`],
    ['Codex', origin => `codex mcp add agentpager --url "${origin}${ROUTES.mcp.path}"`],
    ['Claude apps (web, desktop, mobile)', origin => `Settings, Connectors, Add custom connector, URL ${origin}${ROUTES.mcp.path}`],
    ['ChatGPT (developer mode)', origin => `Settings, Connectors, Advanced, Developer mode, then add ${origin}${ROUTES.mcp.path}`],
    ['Any other MCP client', origin => `${origin}${ROUTES.mcp.path} over streamable HTTP, no login`],
  ] as ReadonlyArray<readonly [string, (origin: string) => string]>,
  example: {
    question: 'Which should I do first?',
    options: [['Run the tests', 'catching a break early'], ['Update the docs', 'what users read first']],
    nextSteps: 'Running the tests now.',
  },
} as const;

// Every new card is a brief; this is its short form.
export const CARD_EXAMPLES={
 brief:{type:"brief",recommended:1,options:[{number:1,title:"Use the first plan",prioritizes:"speed"},{number:2,title:"Use the second plan",prioritizes:"safety"}],markdown:"## Context: two plans\nBoth are ready to start.\n\n## Options\n\n## Recommendation: A\n**Why:** It is quicker."},
} as const;

const fieldsOf = (schema: Schema.Schema.Any) => SchemaAST.getPropertySignatures(schema.ast).map(field => `${String(field.name)}${field.isOptional ? '?' : ''}`).join(', ');
const fill = (path: string, params: Record<string, string>) => path.replace(/:(\w+)/g, (_, name) => params[name] ?? `:${name}`);
// Phone and owner routes are the product's own; an agent never calls them.
const routeRows = () => Object.entries(ROUTES).filter(([, r]) => r.caller.includes('agent') || r === ROUTES.pairingQr).map(([key, r]) => `| ${key} | ${r.method} ${r.path} | ${r.caller} | ${r.type} |`).join('\n');
const errorRows = () => Object.entries(HTTP_STATUS).map(([tag, status]) => `| ${tag} | ${status} |`).join('\n');
const toolRows = () => Object.entries(MCP.tools).map(([name, tool]) => `| ${name} | ${fieldsOf(tool.input) || 'none'} | ${fieldsOf(tool.result)} |`).join('\n');
const shapeRows = () => Object.entries({ SessionInput, SessionCreated, PhoneJoined, SessionSummary, PairingLink, AgentStatus, QuestionInput, Decision, Option, Answer, AcknowledgementInput, Acknowledgement })
  .map(([name, schema]) => `| ${name} | ${fieldsOf(schema)} |`).join('\n');
const literals = (values: ReadonlyArray<string>) => values.map(value => `\`${value}\``).join(', ');
const shellQuote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;

export function startBody(origin = PRODUCTION_ORIGIN, connectId?: string) {
  const p = { sessionId: '$SESSION', decisionId: '$DECISION', token: '$TOKEN', seconds: String(seconds(ANSWER_WAIT_MAX_MS)) };
  const auth = `-H "${AGENT_AUTH_HEADER}: Bearer $AGENT_KEY"`;
  const json = `-H 'content-type: application/json'`;
  const url = (key: keyof typeof ROUTES, params = p) => `${origin}${fill(ROUTES[key].path, params)}`;
  const curl = (key: keyof typeof ROUTES) => `curl -s -X ${ROUTES[key].method}`;
  // Tokens are URL-safe, so the expanded answer id needs no JSON escaping; authored text still does.
  const acknowledgement = (nextSteps: string) => `${shellQuote('{"answerId":"')}"$ANSWER_ID"${shellQuote(`","nextSteps":${JSON.stringify(nextSteps)}}`)}`;
  const options = START.example.options.map(([title, prioritizes], index) => ({ number: index + 1, title, prioritizes }));
  const exampleCard = { type: 'brief', recommended: 1, options, markdown: `## Context: ${START.example.question}\nBoth are ready.\n\n## Options\n\n## Recommendation: A\n**Why:** It catches a break early.` };
  const examples = Object.entries(CARD_EXAMPLES).map(([kind, card]) => `### ${kind}\n\n\`\`\`json\n${JSON.stringify({ title: 'Which plan should I use?', card }, null, 2)}\n\`\`\``).join('\n\n');
  const connect = connectId ? { ...p, connectId } : p;
  return [
    ...(connectId ? [`Your owner’s phone is waiting for you. Join it now, once: \`${curl('joinPhone')} ${json} -d ${shellQuote(JSON.stringify({ name: 'Claude Code · my-project' }))} "${url('joinPhone', connect)}"\` with your own session name, or the \`join_session\` tool with connectId \`${connectId}\`. Then follow “If your owner gave you a connect link” below.`, ''] : []),
    START.what.join(' '),
    '',
    '## Which way in',
    '',
    `- ${START.wayIn.https}`,
    `- ${START.wayIn.mcp}`,
    '',
    '## How to behave',
    '',
    START.waiting,
    '',
    ...(connectId ? [...START.conduct.slice(0, 2), START.connectConduct, ...START.conduct.slice(4)] : START.conduct).map(line => `- ${line}`),
    '',
    ...(connectId ? [] : ['## Show the pairing link', '', `- ${START.showLink.terminal}`, `- ${START.showLink.chat}`, '', START.showLink.target, '']),
    `${connectId ? 'Your owner’s phone already shows the pairing card.' : 'The link opens the pairing card on your owner’s phone.'} Later they find the session at ${origin}${ROUTES.homeApp.path}. There is no other page to show.`,
    '',
    ...(connectId ? [
      '## If your owner gave you a connect link',
      '',
      `This page is your owner’s connect link. Reading it joins nothing. Join with joinPhone and your SessionInput, or the \`join_session\` tool with {connectId, name}; it returns PhoneJoined: your agent key, the session and the pairing target, with no pairing link. Do not create another session. agentStatus returns pairing null. A connect link works once, for ${UNPAIRED_LIFETIME_MS / 60_000} minutes; a used or expired one answers ConnectLinkInvalid. Then read ${origin}${ROUTES.start.path}, create a session as usual and show its pairing link instead.`,
      '',
    ] : [`If your owner gives you a connect link, ${origin}${fill(ROUTES.connectPage.path, { connectId: '<connect id>' })}, read that page instead: it joins their phone without a pairing link.`, '']),
    '## Over HTTPS',
    '',
    `${connectId ? 'Join your owner’s phone' : 'Create a session'} without a key. Later agent API calls carry \`${AGENT_AUTH_HEADER}: Bearer <agent key>\`. The phone’s calls carry \`${PHONE_AUTH_HEADER}: <phone key>\`; you never make those. Never put the agent key or a phone key in a URL.`,
    '',
    '| Route | Method and path | Caller | Answers |',
    '| --- | --- | --- | --- |',
    routeRows(),
    '',
    '### Request and response shapes',
    '',
    'All API bodies are JSON objects. A ? marks an optional field; all other fields are required.',
    '',
    '| Shape | Fields |',
    '| --- | --- |',
    shapeRows(),
    `| Choice | ${Choice.members.map(fieldsOf).join(' OR ')} |`,
    `| Card | type, then that type’s fields. A new card's type is \`brief\`; a decision asked before may hold ${literals(Object.keys(cardSchemas).filter(kind => kind !== 'brief'))}. A complete example closes this document. |`,
    '',
    `createSession takes SessionInput and returns SessionCreated; joinPhone takes SessionInput and returns PhoneJoined; agentStatus returns AgentStatus. askCard takes QuestionInput and returns {"decisionId":"<Token>"}; acknowledgeCard takes AcknowledgementInput and returns Acknowledgement. finishSession returns {"finishedAt":"<Timestamp>"}. readCardAnswer returns {"status":"pending"} or {"status":"answered","answer":<Answer>}; hold it with wait=1..${seconds(ANSWER_WAIT_MAX_MS)} seconds and repeat while pending. A held read returns within one second of the service accepting Send.`,
    '',
    `SessionCreated.session and AgentStatus.session are SessionSummary; their pairing is PairingLink (null in AgentStatus after the first phone claims it). SessionCreated.agentKey authenticates later calls; pairingDecisionId names the pairing decision, which you read and acknowledge like any card. PairingLink.url is the one-use owner link; qrUrl is its SVG. SessionCreated.pairingTarget and AgentStatus.pairingTarget are the server-selected random Option from the ${NUMBER_WORDS[PAIRING_OPTION_COUNT]} distinct pairing choices. The target is never included in Inbox. AgentStatus.pairingTarget is null after correct pairing.`,
    '',
    `QuestionInput.card is a \`brief\` card: Markdown sections carry the question, starting with its Context, and it carries ${BRIEF_OPTIONS_MIN} to ${BRIEF_OPTIONS_MAX} options, lettered A, B and on by number. Emoji cards are retired and refused. Make each option an action you will carry out, such as Send now, Send at 9:00 tomorrow or Don’t send. Set card.recommended to the number of the option you would pick, and use the question detail for a short reason; never put a second question there. Your owner still chooses; nothing is chosen for them. Decision.kind is ${literals(DecisionKind.literals)}; status is ${literals(DecisionStatus.literals)}. An open decision has no answer or acknowledgement; an answered decision has Answer, and an acknowledged decision also has Acknowledgement. Feedback is a final answer: its decision keeps status \`feedback\` even after acknowledgement.`,
    '',
    'Answer.choice is {"kind":"option","number":1} (an offered option number) or {"kind":"feedback","text":"Your reply"}. Feedback is not an extra option: it closes the question, and you ask again with a new card. The answer names its decision; an acknowledgement names that decision and its stored answer. Keep the answerId you read when acknowledging; only the first acknowledgement is accepted.',
    '',
    '',
    'A wrong option on the pairing card is refused on the phone and stores nothing; only the correct pairing Send establishes pairing. The phone shows the owner a receipt when an answer is stored; only your Acknowledgement tells them you received it.',
    '',
    `Identifiers, credentials and pairing tokens are ${TOKEN_LENGTH} URL-safe characters (A–Z, a–z, 0–9, _ or -). Timestamps are UTC strings like 2026-09-25T14:42:00Z, optionally with fractional seconds. SessionSummary.paired is a boolean; pairedAt is null until correct pairing; until then expiresAt is the unpaired deadline. pairedAt records that accepted Send. lastAcceptedAt records activity but never extends expiresAt. SessionInput.name is a session name: Text rules, at most ${SESSION_NAME_MAX_CHARACTERS} characters. A title, an option title, option detail, a target label and nextSteps are Text; question detail and feedback text are Body; each emoji is Emoji.`,
    '',
    'An error body is `{ "error": "<tag>", ...fields }`. InvalidInput adds reason; AlreadyAnswered adds the stored receipt; SessionExpired adds expiredAt; SessionEnded adds endedAt and endedBy; AgentFinished adds finishedAt. Other tags have no extra fields.',
    '',
    '| Error | Status |',
    '| --- | --- |',
    errorRows(),
    '',
    'Unsupported card types or malformed card inputs return InvalidInput. UnknownDecision means an unknown decision ID. Until the pairing answer is acknowledged, asks return InvalidInput. A card ask is never refused because another card is open.',
    '',
    `Text is well-formed Unicode, never blank, and holds at most ${TEXT_MAX_CHARACTERS} visible characters, counting spaces and Markdown punctuation; a combined emoji counts as one. Body follows the same rules with at most ${BODY_MAX_CHARACTERS} characters. An over-limit or invalid input is refused with InvalidInput, whose reason says what to fix. Markdown is allowed and stays literal; HTML is refused. Every input is refused whole, never trimmed or truncated. Request schemas reject unknown fields, including nested card fields; do not drop them silently. Emoji is one Unicode RGI emoji, including qualification variants and combined sequences, with no whitespace and at most ${EMOJI_MAX_CODE_POINTS} code points in the supplied value. Text-presentation selectors are not emoji presentation. Option numbers are integers from 1 to ${OPTIONS_MAX}, and must name an offered option. An answer read holds for at most ${seconds(ANSWER_WAIT_MAX_MS)} seconds. A pairing link works until a phone claims it. A session nobody pairs expires ${UNPAIRED_LIFETIME_MS / 60_000} minutes after you create it; one that pairs expires ${hours(SESSION_LIFETIME_MS)} hours after correct pairing, even if cards, answers or acknowledgements follow.`,
    '',
    'Cards and answers never carry out an action: you do that after your owner chooses. Your owner ends the session from the phone, which clears its cards and history. Finishing over HTTPS or MCP stops your key and answers AgentFinished to later calls; the session stays readable on the phone until your owner ends it or it expires. Finishing before pairing ends the session. History exists only while the session lives.',
    '',
    '### A worked example',
    '',
    '```sh',
    ...(connectId ? [
      `${curl('joinPhone')} ${json} -d ${shellQuote(JSON.stringify({ name: 'Claude Code · my-project' }))} "${url('joinPhone', connect)}"`,
      '# set AGENT_KEY=agentKey, SESSION=session.sessionId and PAIRING_DECISION=pairingDecisionId from the reply',
      '# tell your owner to select pairingTarget.emoji, then tap Send; there is no link to show',
    ] : [
      `${curl('createSession')} ${json} -d ${shellQuote(JSON.stringify({ name: 'Claude Code · my-project' }))} "${url('createSession')}"`,
      '# set AGENT_KEY=agentKey, SESSION=session.sessionId and PAIRING_DECISION=pairingDecisionId from the reply',
      '# show pairing.qrText in a code block (and pairing.qrUrl as an image if your client shows images) AND the full pairing.url; tell your owner to select pairingTarget.emoji, then tap Send',
    ]),
    `${curl('readCardAnswer')} ${auth} "${url('readCardAnswer', { ...p, decisionId: '$PAIRING_DECISION' })}"`,
    '# repeat until status is answered; set ANSWER_ID=answer.answerId, echo the chosen emoji, then acknowledge',
    `${curl('acknowledgeCard')} ${auth} ${json} -d ${acknowledgement('Paired. Asking my first question.')} "${url('acknowledgeCard', { ...p, decisionId: '$PAIRING_DECISION' })}"`,
    `${curl('askCard')} ${auth} ${json} -d ${shellQuote(JSON.stringify({ title: START.example.question, card: exampleCard }))} "${url('askCard')}"`,
    '# set DECISION=decisionId from the reply',
    `${curl('readCardAnswer')} ${auth} "${url('readCardAnswer')}"`,
    '# repeat until status is answered; set ANSWER_ID=answer.answerId from this answer, then act and acknowledge',
    `${curl('acknowledgeCard')} ${auth} ${json} -d ${acknowledgement(START.example.nextSteps)} "${url('acknowledgeCard')}"`,
    `${curl('finishSession')} ${auth} "${url('finishSession')}"`,
    '```',
    '',
    '## Over MCP',
    '',
    `The server is \`${origin}${MCP.route.path}\`: ${MCP.transport}, ${MCP.stateless ? 'stateless' : 'stateful'}, login ${MCP.login}; a notification is answered ${MCP.notificationStatus} with no body. Your owner adds it once. ${START.ownerStep}`,
    '',
    ...START.setup.map(([client, line]) => `- ${client} (owner step): ${line(origin)}`),
    '',
    '| Tool | Input | Result |',
    '| --- | --- | --- |',
    toolRows(),
    '',
    `Tool question and acknowledgement arguments use QuestionInput and AcknowledgementInput; ask_card returns {"decisionId":"<Token>"}. \`wait_for_card_answer\` holds for up to \`waitSeconds\`, an optional integer from 1 to ${seconds(ANSWER_WAIT_MAX_MS)}; it returns {answer}, the same pending/answered object as readCardAnswer. A tool error names the same error tag as the HTTPS route.`,
    '',
    '## Complete card payload example',
    '',
    examples,
    '',
    connectId ? `Your owner gave you: ${connectUrl(connectId, origin)}` : `Your owner started you with: “${CARD_AGENT_INSTRUCTION}”.`,
    '',
  ].join('\n');
}

export const startDocument = (origin = PRODUCTION_ORIGIN, connectId?: string) => `# ${START.title}\n\n${startBody(origin, connectId)}`;

// The story renders what an agent reads. The product serves the document as text, not this screen.
export function StartScreen({ origin = PRODUCTION_ORIGIN }: { origin?: string }) {
  return <main style={{ maxWidth: 760, margin: '0 auto', padding: 16, font: '15px/1.5 ui-monospace, Menlo, monospace', color: '#1a1a1a', background: '#fff' }}>
    <h1 style={{ font: '600 20px/1.3 system-ui, sans-serif', margin: '0 0 12px' }}>{START.title}</h1>
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, font: 'inherit' }}>{startBody(origin)}</pre>
  </main>;
}
