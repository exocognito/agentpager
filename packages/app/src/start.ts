import { STATUS, MAX_OPEN_DECISIONS, ANSWER_WAIT_MAX_SECONDS } from './contract.ts';

// What agents read. Short on purpose; every route and field named here is real.
const errors = () => Object.entries(STATUS).filter(([tag]) => tag !== 'NotFound').map(([tag, status]) => `| ${tag} | ${status} |`).join('\n');
const example = JSON.stringify({ title: 'Which should I do first?', detail: 'The tests take 4 minutes.', card: { type: 'generic', recommended: 1, options: [{ number: 1, emoji: '🧪', title: 'Run the tests', detail: 'Then update the docs.' }, { number: 2, emoji: '📖', title: 'Update the docs' }] } });

export function startDocument(origin: string) {
  return `# AgentPager for agents

AgentPager sends your questions to your owner's iPhone as decision cards and brings their answers back to you.

This server is \`${origin}\`. Use its HTTP API below, or its MCP server at \`${origin}/mcp\` (each step names its MCP tool). AgentPager tools set up for another server can't see pagers or links made here; if you can't tell which server your tools use, use the HTTP API.

## 1. Connect

- Your owner gave you a pager number (often in AGENTS.md): open a pager with it. It is paired already, so there is no link or code to show your owner.
  \`curl -s -X POST ${origin}/api/numbers/<number>/pagers -H 'content-type: application/json' -d '{"name":"<your app> · <project>","lifetime":"24h"}'\`
  MCP: \`page_owner {number, name, lifetime}\`
  The reply is \`{"session":{"sessionId":"…","status":"active",…},"agentKey":"…"}\`. Open one pager for your piece of work and keep it for every question. The number is your owner's, like a key: never repeat it in what you write.
- Your owner gave you an AgentPager link (\`${origin}/start/<code>\`): join it once. Reading the link uses nothing up.
  \`curl -s -X POST ${origin}/api/start/<code>/join -H 'content-type: application/json' -d '{"name":"<your app> · <project>"}'\`
  MCP: \`join_session {code, name}\`
- Otherwise start a pager yourself:
  \`curl -s -X POST ${origin}/api/sessions -H 'content-type: application/json' -d '{"name":"<your app> · <project>","lifetime":"24h"}'\`
  MCP: \`start_session {name, lifetime}\`

\`name\` is your app, then the project or folder you are working in, such as \`Codex · trip-planner\`, at most 60 characters. \`lifetime\` is \`24h\` (default), \`7d\` or \`30d\`, counted from pairing.

The reply to a start or a join (\`link\` comes only when you start the pager):

    {"session":{"sessionId":"…","status":"unpaired","endsAt":"…",…},
     "agentKey":"…",
     "pairingCode":{"emojis":[…],"names":[…],"text":"…"},
     "link":{"url":"…","qrText":"…",…}}

After a start or a join, in one message to your owner, show:
1. if you started the pager: \`link.qrText\` in a fenced code block (your owner scans it with the iPhone Camera), then the full \`link.url\` as text,
2. \`pairingCode.text\` exactly as given, as plain text.

Write these in your own message, not only in a command's output: your owner's app may fold command output away, and they will be looking for the link. \`link.url\` is for your owner's phone; never join it yourself.

Your owner taps those 3 emojis, in order, in the AgentPager app. They have 3 tries within the pager's first 15 minutes; a third wrong try ends the pager. Until it pairs, \`session.endsAt\` is that pairing deadline; once paired, it is the pager's end time. To show the code again later, take a fresh \`pairingCode.text\` from the status route below, so the minutes left are right.

Your owner can't approve prompts in your terminal from the phone. Before they leave, make sure you can make every call below without asking them for permission; if you can't, sort it out while they are still there.

## 2. Keep your key

\`agentKey\` is a secret that controls this pager. Never print the whole reply or show the key to your owner; print only the fields above.

You need \`session.sessionId\` and \`agentKey\` for every later call, in this turn and in later ones, so keep them somewhere that lasts as long as the pager: a file only you can read that is never committed. If you lose the key, the pager can never page your owner again: tell them to end it in the app (⋯, End Pager), and start a new one.

## 3. Ask

Ask right away; cards wait until the phone pairs. Every call from here on carries \`authorization: Bearer <agentKey>\`.

  \`curl -s -X POST ${origin}/api/sessions/<sessionId>/cards -H "authorization: Bearer $AGENT_KEY" -H 'content-type: application/json' -d '<question>'\`
  MCP: \`ask_card {sessionId, agentKey, question}\`

A question: \`${example}\`

The reply: \`{"decisionId":"…"}\`

Make the title a short question, about 100 characters, and put context in \`detail\`. 2 to 5 options numbered 1..n, each with a distinct emoji and an action you will carry out, its title also about 100 characters. \`recommended\` and \`detail\` are optional. Titles, option detail and \`nextSteps\` hold up to 280 characters, question detail up to 1000. Markdown stays literal; HTML is refused. A pager holds at most ${MAX_OPEN_DECISIONS} open decisions. Your owner's app says pager, never session, so say pager in what you write.

## 4. Wait for the answer

  \`curl -s "${origin}/api/sessions/<sessionId>/cards/<decisionId>/answer?wait=${ANSWER_WAIT_MAX_SECONDS}" -H "authorization: Bearer $AGENT_KEY"\`
  MCP: \`wait_for_card_answer {sessionId, agentKey, decisionId, waitSeconds?}\`

Each read holds up to \`wait\` seconds (at most ${ANSWER_WAIT_MAX_SECONDS}; without \`wait\` it answers at once), then replies with one of:
- \`{"status":"pending"}\`: read again.
- \`{"status":"answered","answer":{"answerId":"…","decisionId":"…","choice":…,"sentAt":"…"}}\`
- an error (below): stop reading and handle it.

\`choice\` is \`{"kind":"option","number":n}\`, or \`{"kind":"feedback","text":"…"}\` when your owner wrote a note instead of choosing an option: follow the note, and ask a new card only if you still need a decision.

Stay in your turn and keep reading until the answer comes: your owner answers from their phone, and nothing can wake you once your turn has ended. Only if your turn must end anyway:
- if you can run a command in the background and be woken when it finishes, keep the read going there;
- otherwise tell your owner, in your last message, to send you a message once they have answered.

The answer waits either way: read it again in your next turn.

## 5. Acknowledge

  \`curl -s -X POST ${origin}/api/sessions/<sessionId>/cards/<decisionId>/acknowledge -H "authorization: Bearer $AGENT_KEY" -H 'content-type: application/json' -d '{"answerId":"…","nextSteps":"…"}'\`
  MCP: \`acknowledge_card {sessionId, agentKey, decisionId, acknowledgement: {answerId, nextSteps}}\`

The reply: \`{"decisionId":"…","answerId":"…","nextSteps":"…","acknowledgedAt":"…"}\`. Your owner sees \`nextSteps\` with a green tick. Only the first acknowledgement counts.

## Decision briefs

For a decision that needs a story (what broke, what each option looks like, what it costs), send a brief instead of an emoji card. Your owner's phone draws every brief the same way: the question, then headed sections they can fold, lettered options, a colored tradeoffs table, your recommendation, your next steps, and the answer bar.

A brief: \`{"title":"How should checkout handle a payment timeout?","detail":"41 orders got stuck last week.","card":{"type":"brief","recommended":2,"options":[{"number":1,"title":"Retry","label":"Retry","prioritizes":"the least work for customers"},{"number":2,"title":"Check first","label":"Check first","prioritizes":"never charging twice"}],"markdown":"…"},"attachments":[…]}\`

- \`options\`: 2 to 4, numbered 1..n. Number 1 is A, 2 is B, and so on; the answer's \`choice.number\` is still the number. \`title\` is the option's row, \`label\` (optional, at most 20 characters) its answer tile, and the row reads "Prioritizes <prioritizes>". \`detail\` is one line for the inbox.
- \`markdown\` holds the sections, in this order, at most 20,000 characters:

      ## Context: <topic>
      One to three sentences: what happened and why it needs a decision now.
      [Read more background](background.md)

      ## Options
      :::option A
      <what A looks like: an image, a diagram, a sample>
      ### What A changes
      - <one line per change>
      :::

      ## Tradeoffs
      |        | A Retry          | B Check       |
      |--------|------------------|---------------|
      | Twice? | :red[Can happen] | :green[Never] |

      ## Recommendation: B
      **Why:** <one line>
      **Assumes:** <the belief that, if wrong, changes the pick, and to what>

      ## Next steps: <what>
      **After this decision:** <one line>
      **If no decision:** <one line>

      :::smallprint
      - <only when it matters: hidden costs, options ruled out early>
      :::

- The phone draws the option rows from \`options\` and puts ✶ on the recommended option everywhere. Tapping a row shows its \`:::option\` block; it never chooses it.
- In a block: images \`![Cards](a.png)\`; a Mermaid flowchart in a \`mermaid\` fence (\`flowchart TD\` or \`LR\`, where \`:::green\`, \`:::yellow\`, \`:::orange\` or \`:::red\` colors a node); a change in a \`diff\` fence whose info string names the file, such as \`diff checkout/pay.ts\`; a conversation as \`:::chat\` with one \`speaker: text\` line each, the first speaker being the one who writes in. Nest a block in an option with a longer fence: \`::::option A\` … \`::::\`.
- Color only rates, best to worst: \`:green[…]\`, \`:yellow[…]\`, \`:orange[…]\`, \`:red[…]\`. Never color the recommendation.
- \`attachments\`: at most 8, 3,000,000 bytes in all, each named by the brief. A page is \`{"name":"background.md","type":"text/markdown","text":"…"}\` and opens as its own page under the same rules. An image is \`{"name":"a.png","type":"image/png","base64":"…"}\` (or \`image/jpeg\`, \`.jpg\`), standard padded base64, at most 1,000,000 bytes. Build a request with images in a script from the files, and send it over HTTP rather than typing base64 into a tool call.
- Refused whole, with the reason: HTML outside code fences; \`## Recommendation: X\` where X isn't \`recommended\`; an \`:::option\` block or Tradeoffs column for a letter that isn't an option; a link or image that names a missing attachment (only \`https://\` links may point elsewhere); anything over a limit.
- A small decision uses the same template with fewer sections: leave out the option blocks, the background page and the small print, and keep the options and tradeoffs so each answer has its reason.

## Status, times and ending

- \`GET ${origin}/api/sessions/<sessionId>\` with your key replies \`{"session":{"status":"…","pairedAt":…,"endsAt":"…",…},"pairingCode":…}\`. \`status\` is \`unpaired\` until your owner pairs, then \`active\`. If it is still \`unpaired\` a few minutes after you showed the code, show the link and a fresh \`pairingCode.text\` again.
- Times are UTC (ISO 8601). Tell your owner times in their local time, or as "in 5 minutes".
- Keep the pager while you may still need your owner. When your work is done, end it: \`POST ${origin}/api/sessions/<sessionId>/finish\` with your key and no body, which replies \`{"endedAt":"…"}\` (MCP: \`finish_session\`). For a connection test, let your owner choose in the test card's options: keep the pager, or end it.
- A pager also ends when your owner ends it, when it reaches its end time, or when pairing fails. After that every call answers \`PagerEnded\` with \`endReason\` and a \`message\`: stop paging, and start a new pager only if your owner asks.

## If your scripts can't reach this server

Some sandboxes block the network for scripts but not for a browser. Then open \`${origin}/start\` in your browser and make the same requests as \`fetch()\` calls from that page. Keep \`sessionId\` and \`agentKey\` in a page variable, return only the fields you need, and keep the browser session open while the pager lives.

## Errors

Every refusal is \`{"error":"<Tag>","message":"...", ...}\`. \`InvalidInput\` adds \`reason\`; \`WrongCode\` adds \`triesLeft\`; \`PagerEnded\` adds \`endReason\` and \`endedAt\`.

| Error | Status |
| --- | --- |
${errors()}

## Owner setup (optional)

- Claude Code MCP: \`claude mcp add --transport http agentpager "${origin}/mcp"\`
- Codex MCP: \`codex mcp add agentpager --url "${origin}/mcp"\`
- Any other MCP client: \`${origin}/mcp\`, streamable HTTP, no login.
- Codex over HTTP: its sandbox blocks the network by default, so every request waits for your approval in the terminal. To page you while you are away, start it with \`codex -c sandbox_workspace_write.network_access=true\`, or set that in its config.

If you have no AgentPager tools for this server, use the HTTP API; do not wait for your owner to add them.
`;
}

export function codeDocument(origin: string, code: string) {
  return `# AgentPager link

Your owner's phone made this AgentPager link for you on \`${origin}\`. Reading this page uses nothing up.

Join it once, now:
- HTTP: \`curl -s -X POST ${origin}/api/start/${code}/join -H 'content-type: application/json' -d '{"name":"<your app> · <project>"}'\`
- MCP, only if your AgentPager tools use \`${origin}/mcp\`: \`join_session {"code":"${code}","name":"<your app> · <project>"}\`

\`name\` is your app, then the project or folder you are working in, such as \`Codex · trip-planner\`, at most 60 characters.

The reply is \`{"session":{"sessionId":"…",…},"agentKey":"…","pairingCode":{…,"text":"…"}}\`. \`agentKey\` is a secret: never print the whole reply or show the key to your owner, and keep \`sessionId\` and \`agentKey\` for later turns.

Print \`pairingCode.text\` to your owner exactly as given, as plain text, in your own message rather than only in a command's output. It reads like:

    To finish pairing, tap these 3 emojis on your phone, in this order:
    🦊 🌵 🦊
    (1. fox    2. cactus    3. fox)

Your owner enters them in the AgentPager app. Then ask your cards right away; they reach the phone once it pairs. How to keep your key, ask, wait, acknowledge and end: ${origin}/start

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
<details open><summary>Are you an agent?</summary><pre>${escape(codeDocument(origin, code))}</pre></details></main></body></html>`;
}

export const OLD_CONNECT = 'Old AgentPager connect links no longer work. Ask your owner for a new AgentPager link.\n';
