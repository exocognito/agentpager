import { STATUS, MAX_OPEN_DECISIONS, ANSWER_WAIT_MAX_SECONDS } from './contract.ts';

// What agents read. Short on purpose; every route and field named here is real.
const errors = () => Object.entries(STATUS).filter(([tag]) => tag !== 'NotFound').map(([tag, status]) => `| ${tag} | ${status} |`).join('\n');
const example = JSON.stringify({ title: 'Which should I do first?', detail: 'The tests take 4 minutes.', card: { type: 'brief', recommended: 1, options: [{ number: 1, title: 'Run the tests, then update the docs', label: 'Tests first', prioritizes: 'docs that match what ships' }, { number: 2, title: 'Update the docs now', label: 'Docs first', prioritizes: 'the docs review starting sooner' }], markdown: '## Context: tests or docs first\nBoth are due today, and the tests take 4 minutes.\n\n## Options\n\n## Tradeoffs\n|                | A Tests first      | B Docs first      |\n|----------------|--------------------|-------------------|\n| Docs match     | :green[What ships] | :yellow[Maybe not] |\n| Review starts  | :yellow[In 4 min]  | :green[Now]       |\n\n## Recommendation: A\n**Why:** A failing test may change what the docs say.\n' } });

export function startDocument(origin: string) {
  return `# AgentPager for agents

AgentPager sends your questions to your owner's iPhone as decision cards and brings their answers back to you.

This server is \`${origin}\`. Use its HTTP API below, or its MCP server at \`${origin}/mcp\` (each step names its MCP tool). AgentPager tools set up for another server can't see pagers made here; if you can't tell which server your tools use, use the HTTP API.

## 1. Connect

Your owner gave you a pager number (often in AGENTS.md; it starts \`ap1_\`). Connect with it:

  \`curl -s -X POST ${origin}/api/agents -H 'content-type: application/json' -d '{"number":"<number>","app":"<your app>","project":"<project>"}'\`
  MCP: \`connect {number, app, project}\`

\`app\` is who you are, such as \`Codex\` or \`Claude Code\`; \`project\` is what you are working on, usually the repository's or folder's name. Each is at most 60 characters. Your owner's phone shows every decision with who asked, grouped by project.

The reply is \`{"agent":{"agentId":"…",…},"agentKey":"…","message":"…"}\`. You are a new agent on your owner's pager: keep this agent for every question in this piece of work. Connecting again adds another agent.

Your owner can't approve prompts in your terminal from the phone. Before they leave, make sure you can make every call below without asking them for permission; if you can't, sort it out while they are still there.

## 2. Keep your key

\`agentKey\` is a secret that lets you ask on this pager. Never print the whole reply or show the key to your owner. The number is your owner's too: never repeat it in what you write.

You need \`agent.agentId\` and \`agentKey\` for every later call, in this turn and in later ones, so keep them somewhere that lasts as long as your work: a file only you can read that is never committed. If you lose the key, connect again.

## 3. Ask

Every call from here on carries \`authorization: Bearer <agentKey>\`.

  \`curl -s -X POST ${origin}/api/agents/<agentId>/cards -H "authorization: Bearer $AGENT_KEY" -H 'content-type: application/json' -d '<question>'\`
  MCP: \`ask {agentId, agentKey, question}\`

A question: \`${example}\`

The reply: \`{"decisionId":"…"}\`

Every card is a brief; emoji cards are refused. The example is a brief's short form, for a quick decision: read Decision briefs below before your first one. Make the title a short question, about 100 characters, and put context in \`detail\`; \`recommended\` and \`detail\` are optional. The title and \`nextSteps\` hold up to 280 characters, question detail up to 1000, as plain text; HTML is refused. Your owner holds at most ${MAX_OPEN_DECISIONS} unanswered decisions from one agent.

Write for someone who wasn't there: your owner reads this on a phone, hours later, without your context. Ask one question per card, with two to four options that are each a different way to get the job done. Never offer "revise", "discuss" or "give me changes" as an option: the phone has an Ask for changes button for that.

## 4. Wait for the answer

  \`curl -s "${origin}/api/agents/<agentId>/cards/<decisionId>/answer?wait=${ANSWER_WAIT_MAX_SECONDS}" -H "authorization: Bearer $AGENT_KEY"\`
  MCP: \`wait {agentId, agentKey, decisionId, waitSeconds?}\`

Each read holds up to \`wait\` seconds (at most ${ANSWER_WAIT_MAX_SECONDS}; without \`wait\` it answers at once), then replies with one of:
- \`{"status":"pending"}\`: read again.
- \`{"status":"answered","answer":{"answerId":"…","decisionId":"…","choice":…,"sentAt":"…"}}\`
- \`InternalError\` (status 500): the server failed for a moment. Read again after a few seconds; if it keeps failing for several minutes, stop and tell your owner.
- any other error (below): stop reading and handle it.

\`choice\` is \`{"kind":"option","number":n}\`, or \`{"kind":"feedback","text":"…"}\` when your owner wrote a note instead of choosing an option: follow the note, and ask a new card only if you still need a decision.

Stay in your turn and keep reading until the answer comes: your owner answers from their phone, and nothing can wake you once your turn has ended. Only if your turn must end anyway:
- if you can run a command in the background and be woken when it finishes, keep the read going there;
- otherwise tell your owner, in your last message, to send you a message once they have answered.

The answer waits either way: read it again in your next turn.

## 5. Acknowledge

  \`curl -s -X POST ${origin}/api/agents/<agentId>/cards/<decisionId>/acknowledge -H "authorization: Bearer $AGENT_KEY" -H 'content-type: application/json' -d '{"answerId":"…","nextSteps":"…"}'\`
  MCP: \`ack {agentId, agentKey, decisionId, acknowledgement: {answerId, nextSteps}}\`

The reply: \`{"decisionId":"…","answerId":"…","nextSteps":"…","acknowledgedAt":"…"}\`. Your owner sees \`nextSteps\` with a green tick. Only the first acknowledgement counts.

## Decision briefs

Every card is a brief. A quick decision needs only the short form, as in Ask above; one that needs a story (what broke, what each option looks like, what it costs) uses every section. Your owner's phone draws every brief the same way: the question, then headed sections they can fold (your context, the colored tradeoffs table, your recommendation and your next steps) and the answer bar. Each option's story opens on its own screen, one tap from the table, so make the table enough to decide on.

A brief: \`{"title":"How should checkout handle a payment timeout?","detail":"41 orders got stuck last week.","card":{"type":"brief","recommended":2,"options":[{"number":1,"title":"Retry","label":"Retry","prioritizes":"the least work for customers"},{"number":2,"title":"Check first","label":"Check first","prioritizes":"never charging twice"}],"markdown":"…"},"attachments":[…]}\`

- \`detail\` (optional) is the line under the question in your owner's inbox; the brief itself starts at Context.
- \`options\`: 2 to 4, numbered 1..n. Number 1 is A, 2 is B, and so on; the answer's \`choice.number\` is still the number. \`title\` heads the option's screen, which reads "Prioritizes <prioritizes>" under it, and \`label\` (optional, at most 20 characters) goes on its answer button; \`title\` and \`prioritizes\` hold up to 280 characters. A brief option has no \`detail\`: its \`:::option\` block tells its story.
- \`markdown\` holds the sections, in this order, at most 20,000 characters:

      ## Context: <topic>
      One to three sentences: what happened and why it needs a decision now.
      [Read more background](background.md)

      ## Options
      :::option A
      <what A looks like: an image, a diagram, a sample>
      ### What A changes
      - <one line per change>
      ### Why choose A
      - <the case for A: what it wins, and when it's the right pick>
      ### Why pass on A
      - <the case against A: what it costs, and when to pass on it>
      ### Assumptions A makes
      - <what must stay true for A to work>
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

- The phone puts ✶ on the recommended option everywhere. The options screen shows one option's \`:::option\` block at a time: what it changes, why to choose it, why to pass on it and what it assumes, then what it looks like. Viewing an option never chooses it.
- In a block: images \`![Cards](a.png)\`, where images one after another show as one strip of thumbnails that open full screen; a Mermaid flowchart in a \`mermaid\` fence (\`flowchart TD\` or \`LR\`, where \`:::green\`, \`:::yellow\`, \`:::orange\` or \`:::red\` colors a node); a change in a \`diff\` fence whose info string names the file, such as \`diff checkout/pay.ts\`; a conversation as \`:::chat\` with one \`speaker: text\` line each, the first speaker being the one who writes in. Nest a \`:::\` block in an option with a longer fence: \`::::option A\` … \`::::\`. Code fences need no nesting.
- Color only rates, best to worst: \`:green[…]\`, \`:yellow[…]\`, \`:orange[…]\`, \`:red[…]\`. Never use color to mark the recommended option; the ✶ does that.
- \`attachments\` (only with a brief): at most 8, 3,000,000 bytes in all, each named by the brief. A name is 1 to 64 letters, digits, dots, dashes or underscores, ending in \`.md\`, \`.png\` or \`.jpg\` to match its type. A page is \`{"name":"background.md","type":"text/markdown","text":"…"}\` and opens as its own page under the same Markdown rules; it needs none of the sections. An image is \`{"name":"a.png","type":"image/png","base64":"…"}\` (or \`image/jpeg\`, \`.jpg\`), standard padded base64, at most 1,000,000 bytes. Build a request with images in a script from the files, and send it over HTTP rather than typing base64 into a tool call.
- Refused whole, with the reason: no \`## Options\` heading; HTML outside code fences; \`## Recommendation: X\` where X isn't \`recommended\`; an \`:::option\` block or Tradeoffs column for a letter that isn't an option; a \`:::\` block left open; a link or image that names a missing attachment (only \`https://\` links may point elsewhere); anything over a limit.
- Every brief has the \`## Options\` heading. A small decision uses the same template with fewer sections: leave out the option blocks (keep the heading, with nothing under it), the background page and the small print, and keep the tradeoffs so each answer has its reason.
- In \`## Tradeoffs\`, the first column names the row and every other column starts with its option's letter.


## Pager off, status and finishing

- Your owner can turn a pager off, or set it to turn off by itself. While it is off, every call answers \`PagerOff\`: nothing you send is delivered, and nothing is queued. Ask again once your owner turns it on, or ask them for another pager number.
- \`GET ${origin}/api/agents/<agentId>\` with your key replies \`{"agent":{…,"openCount":n},"pager":{"on":true}}\` (MCP: \`status\`).
- When your piece of work is done, finish: \`POST ${origin}/api/agents/<agentId>/finish\` with your key and no body, which replies \`{"finishedAt":"…"}\` (MCP: \`finish\`). Your decisions stay on your owner's phone, and this agent asks nothing more. Optional.
- If your owner deletes the pager, every call answers \`PagerDeleted\`: stop paging.
- Times are UTC (ISO 8601). Tell your owner times in their local time, or as "in 5 minutes".

## If your scripts can't reach this server

Some sandboxes block the network for scripts but not for a browser. Then open \`${origin}/start\` in your browser and make the same requests as \`fetch()\` calls from that page. Keep \`agentId\` and \`agentKey\` in a page variable, and return only the fields you need.

## Errors

Every refusal is \`{"error":"<Tag>","message":"...", ...}\`. \`InvalidInput\` adds \`reason\`.

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
