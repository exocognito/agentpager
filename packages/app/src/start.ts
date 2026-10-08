import { STATUS, MAX_OPEN_DECISIONS, ANSWER_WAIT_MAX_SECONDS } from './contract.ts';

// What agents read. Short on purpose; every route and field named here is real.
const errors = () => Object.entries(STATUS).filter(([tag]) => tag !== 'NotFound').map(([tag, status]) => `| ${tag} | ${status} |`).join('\n');
const example = JSON.stringify({ title: 'Which should I do first?', detail: 'The tests take 4 minutes.', card: { type: 'generic', recommended: 1, options: [{ number: 1, emoji: '🧪', title: 'Run the tests', detail: 'Then update the docs.' }, { number: 2, emoji: '📖', title: 'Update the docs' }] } });

export function startDocument(origin: string) {
  return `# AgentPager for agents

AgentPager sends your questions to your owner's iPhone as decision cards and brings their answers back to you.

## Two ways to connect

- Your owner gave you an AgentPager link (\`${origin}/start/<code>\`): read it, then join once with \`join_session {code, name}\` or \`POST ${origin}/api/start/<code>/join\`, and print \`pairingCode.text\` to your owner. Reading the link uses nothing up.
- Otherwise start a pager yourself: \`start_session\` over MCP, or HTTPS:
  \`curl -s -X POST ${origin}/api/sessions -H 'content-type: application/json' -d '{"name":"Claude Code · my-project","lifetime":"24h"}'\`

Name the pager after your app, then the project (\`Claude Code · blueprint\`), at most 60 characters. \`lifetime\` is \`24h\` (default), \`7d\` or \`30d\`, counted from pairing.

The reply has \`session.sessionId\`, \`agentKey\`, \`link\` and \`pairingCode\`. In one message to your owner, show:
1. \`link.qrText\` in a fenced code block (your owner scans it with the iPhone Camera),
2. the full \`link.url\` as text,
3. \`pairingCode.text\` exactly as given, as plain text.

Your owner taps those 3 emojis, in order, in the AgentPager app. They have 3 tries within the pager's first 15 minutes; a third wrong try ends the pager.

## Ask

Ask right away; your owner sees your cards as soon as the phone pairs. Over HTTPS, every call after the first carries \`authorization: Bearer <agentKey>\`.

- MCP: \`ask_card {sessionId, agentKey, question}\`
- HTTPS: \`POST ${origin}/api/sessions/<sessionId>/cards\` with the question as the body

A question: \`${example}\`

2 to 5 options numbered 1..n, each with a distinct emoji and an action you will carry out. \`recommended\` and \`detail\` are optional. Titles hold up to 280 characters, question detail up to 1000. Markdown stays literal; HTML is refused. A pager holds at most ${MAX_OPEN_DECISIONS} open decisions.

## Wait, then acknowledge

- MCP: \`wait_for_card_answer {sessionId, agentKey, decisionId, waitSeconds?}\`
- HTTPS: \`GET ${origin}/api/sessions/<sessionId>/cards/<decisionId>/answer?wait=${ANSWER_WAIT_MAX_SECONDS}\`

Each read holds up to ${ANSWER_WAIT_MAX_SECONDS} seconds. Repeat while it says \`pending\`, and keep your turn open while you wait. The answer's \`choice\` is \`{"kind":"option","number":n}\` or \`{"kind":"feedback","text":"..."}\` (your owner asked for changes: revise, then ask a new card).

Then acknowledge with what you will do next; your owner sees it with a green tick:
- MCP: \`acknowledge_card {sessionId, agentKey, decisionId, acknowledgement: {answerId, nextSteps}}\`
- HTTPS: \`POST ${origin}/api/sessions/<sessionId>/cards/<decisionId>/acknowledge\` with \`{"answerId":"...","nextSteps":"..."}\`

## Ending

\`finish_session\` (or \`POST ${origin}/api/sessions/<sessionId>/finish\`) ends the pager when your work is done. A pager also ends when your owner ends it, when it reaches its end time, or when pairing fails. After that every call answers \`PagerEnded\` with \`endReason\` and a \`message\`: stop paging, and start a new pager only if your owner asks.

## Errors

Every refusal is \`{"error":"<Tag>","message":"...", ...}\`. \`InvalidInput\` adds \`reason\`; \`WrongCode\` adds \`triesLeft\`; \`PagerEnded\` adds \`endReason\` and \`endedAt\`.

| Error | Status |
| --- | --- |
${errors()}

## MCP setup (an owner step)

- Claude Code: \`claude mcp add --transport http agentpager "${origin}/mcp"\`
- Codex: \`codex mcp add agentpager --url "${origin}/mcp"\`
- Any other MCP client: \`${origin}/mcp\`, streamable HTTP, no login.

If you have no AgentPager tools, use HTTPS; do not wait for your owner to add them.
`;
}

export function codeDocument(origin: string, code: string) {
  return `# AgentPager link

Your owner's phone made this AgentPager link for you. Reading this page uses nothing up.

Join it once, now:
- MCP: \`join_session {"code":"${code}","name":"Claude Code · my-project"}\`
- HTTPS: \`curl -s -X POST ${origin}/api/start/${code}/join -H 'content-type: application/json' -d '{"name":"Claude Code · my-project"}'\`

Use your own name: your app, then the project, at most 60 characters. If you have no AgentPager tools, use HTTPS.

The reply has \`session.sessionId\`, \`agentKey\` and \`pairingCode\`. Print \`pairingCode.text\` to your owner exactly as given, as plain text. It reads like:

    To finish pairing, tap these 3 emojis on your phone, in this order:
    🦊 🌵 🦊
    (1. fox    2. cactus    3. fox)

Your owner enters them in the AgentPager app. Then ask your cards right away; they reach the phone once it pairs. How to ask, wait and acknowledge: ${origin}/start

Only one agent can join a link; another join answers \`AlreadyJoined\`. The link works only during the pager's first 15 minutes; after that it answers \`LinkInvalid\`.
`;
}

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function codePage(origin: string, code: string) {
  const open = `agentpager://start/${code}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentPager link</title>
<style>:root{color-scheme:light dark}body{margin:0;font:17px/1.45 -apple-system,system-ui,sans-serif;background:#f2f2f7;color:#000}main{max-width:480px;margin:0 auto;padding:48px 16px}
h1{font-size:28px;margin:0 0 8px}p{color:#3c3c43}.button{display:block;text-align:center;background:#007aff;color:#fff;text-decoration:none;font-weight:600;padding:14px;border-radius:14px;margin:24px 0}
details{margin-top:32px}pre{white-space:pre-wrap;word-break:break-word;font:13px/1.4 ui-monospace,Menlo,monospace;background:#fff;padding:12px;border-radius:10px}
@media (prefers-color-scheme:dark){body{background:#000;color:#fff}p{color:#ebebf599}pre{background:#1c1c1e}}</style></head>
<body><main><h1>AgentPager link</h1><p>Open this link in the AgentPager app on your iPhone to pair with your agent.</p>
<a class="button" href="${escape(open)}">Open in AgentPager</a>
<p>Don't have the app? AgentPager for iPhone is in testing and is not in the App Store yet.</p>
<details><summary>Are you an agent?</summary><pre>${escape(codeDocument(origin, code))}</pre></details></main></body></html>`;
}

export const OLD_CONNECT = 'Old AgentPager connect links no longer work. Ask your owner for a new AgentPager link.\n';
