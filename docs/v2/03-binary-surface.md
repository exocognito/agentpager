# The `agentpager` binary: commands, MCP tools and replies (draft 7, 30 Oct 2026)

Design item 2. One Bun-compiled executable per platform, installed by `curl -fsSL agentpager.me/install | sh`. It is the only thing an agent talks to: CLI for terminals and scripts, a stdio MCP server for Claude Desktop, Claude Code, Codex and Cursor. Both expose the same operations and the same words.

Draft 4: **no content checks in `ask`.** Quality comes from `agentpager review`, which prints the card with a description of what good looks like for a subagent of the writing agent to grade, each point ok / good to fix / must fix (writing rules §2); `ask` refuses only mechanical problems. `--send-anyway`, exit code 3 and the hold state are gone. Input is `card.yaml`, the whole card as structure (writing rules §2); the binary compiles it to the JSON the server and phone use today. Draft 2: agent file gains the binary's reminder clock. Draft 3: **no notes cache.** A note is the answer to one decision and is read once by the agent that asked. The binary instead keeps a per-pager history on disk, readable with `agentpager history`, never injected. The pager number stays in AGENTS.md (decided: we control the copied text, and developers who want it out of transcripts can use `AGENTPAGER_PAGER`). See writing rules §3 and the page "Where agents learn the brief, v2" (`pages/agent-journey-v2.html`).

## 1. Files on the machine

```
~/.agentpager/
  config.json            { "server": "https://agentpager.me" }     (optional; default agentpager.me)
  agents/ap-7f3k.json    one file per agent, mode 600 (see below)
  history/<pager>.jsonl  every decision asked from this machine on that pager, with its answer (§5)
  bin/agentpager         the executable (installer puts a symlink on PATH)
```

`AGENTPAGER_HOME` relocates the folder; `AGENTPAGER_SERVER` overrides the server for one command; `AGENTPAGER_PAGER` supplies the number when `connect` is run without one, for people who'd rather keep it out of AGENTS.md and transcripts. Nothing is written anywhere else, and nothing is written into the project the agent is working in.

An agent file:
```json
{ "id": "ap-7f3k", "server": "https://agentpager.me", "pager": "<pager id>", "pagerFingerprint": "…",
  "agentKey": "<secret bearer>", "privateKey": "<x25519 secret>", "phonePublicKey": "…",
  "app": "Codex", "project": "atomic-pages", "createdAt": "…", "sharedWith": [],
  "rulesShownAt": "…", "cardsSinceRules": 0 }
```
The agent never reads this file; it only ever passes `--agent ap-7f3k`. The id is four characters from a 32-letter alphabet, unique on this machine only, never a secret.

The last two fields are the binary's own memory of when this agent last saw the contract, so reminders run on the binary's clock rather than the model's recollection, which compaction erases (writing rules §3): the short contract is reprinted inside an `ask` reply when more than 2 hours or 5 cards have passed.

## 2. Commands

| Command | Does | Reply |
|---|---|---|
| `agentpager connect [<number>] [--app <name>] [--project <name>]` | Verifies the number's key fingerprint against the server, creates an agent on that pager, saves its file. Without a number, uses `AGENTPAGER_PAGER`. | See §4. |
| `agentpager rules` | Prints the card contract, the `card.yaml` template and one full example. Sets `rulesShownAt`. | Text. |
| `agentpager example > card.yaml` | Writes the example card to start from. | File. |
| `agentpager review <card.yaml>` | Prints the card with what good looks like and the reviewer instructions, as one block for a subagent, which grades each point ok / good to fix / must fix. Judges nothing itself. | Text. |
| `agentpager ask --agent <id> <card.yaml \| ->` | Mechanical checks only (YAML parses, required keys, 2–4 options, tradeoff rows cover every option, attachments present, sizes, open-decision cap, pager off), then the compiled brief against the server's own `QuestionInput` (an option title over 280 characters, an attachment name or image bytes the server won't take), named by the card.yaml key it came from; refuses with one line per problem. Otherwise compiles to the JSON brief, encrypts, sends; appends the short contract when a reminder is due. Appends to history. | §4. |
| `agentpager wait --agent <id> <decision> [--forever]` | Waits up to 50 s for the answer (the server's long-poll); `--forever` keeps waiting in 50 s rounds, and through an unreachable or restarting server, retrying every 10 s. Appends the answer to history. | §4, §6. |
| `agentpager ack --agent <id> <decision> "<next steps>"` | Acknowledges the exact answer with what happens next. | §4. |
| `agentpager status --agent <id>` | Pager state, open decisions, unacknowledged answers. | Table or `--json`. |
| `agentpager history --agent <id> [--limit N] [--json]` | This machine's decisions on the agent's pager, newest first: when, who asked, the question, the options, the answer, the acknowledgement. Optional; never printed unasked (§5). | Table or JSON lines. |
| `agentpager finish --agent <id>` | Marks the agent finished on the phone. Optional; housekeeping tidies agents that never call it. | One line. |
| `agentpager agents` | Lists this machine's agents: id, pager name, project, app, created, open decisions. | Table. |
| `agentpager share --agent <id>` | Prints the id and confirms it can be passed to other agents on this machine (a coordinator to its helpers). It's just the id; the file is already readable by the same user. | One line. |
| `agentpager mcp` | Runs the stdio MCP server. Harnesses call this; people don't. | — |
| `agentpager setup [--print]` | Writes the MCP server entry for every harness found: Claude Code (`claude mcp add`), Claude Desktop (its config file), Codex (`codex mcp add`), Cursor. Idempotent. The installer runs it. | What it changed. |
| `agentpager update`, `version` | Self-update from agentpager.me; print version. | — |

Every command takes `--json` for machine output. Exit codes: 0 done, 2 refused, 4 pager off, 5 no usable reply from the server (unreachable, no reply, or a reply not understood), 6 unknown agent id. Every reply from the server is decoded with the schema the wire contract gives its route (`packages/blueprint/design/schemas/exchange.ts`); a reply that doesn't decode is not AgentPager's, and is never taken as success.

### Detecting app and project

`--app` and `--project` are rarely needed:
- **App** ("who asked" on the phone): from the harness's environment when it is identifiable (Claude Code, Codex, pi, Cursor each set a marker; the list is in the code and verified against each harness at build time), else the parent process name, else "Agent". Shown on every decision row. A harness identified positively (§6: Claude Code, Claude Desktop) is named by the binary even when the agent passes an app; a Desktop chat passes "Claude".
- **Machine** (where the agent runs, named when the phone warns that no agent read an answer): this computer's short hostname, sent on `connect` when it passes the server's label rules. Never asked for. A server from before this field refuses it, so the server deploys first.
- **Project** (the group on the phone): the git repository's name (`basename` of `git rev-parse --show-toplevel`), else the working folder's name. `--project` overrides and is remembered on the agent file, so a coordinator working on one huge repo can say `--project "billing refactor"` once.

## 3. MCP tools

The same operations, so a model in Claude Desktop sees:

| Tool | Input | Description (verbatim) |
|---|---|---|
| `connect` | `number`, `app?`, `project?` | Connect to your owner's pager with the number they gave you (usually in AGENTS.md). You become a new agent on their phone; keep its id for every later call in this piece of work. Connecting again adds another agent. |
| `rules` | — | The card contract: how to write a decision your owner can answer on a phone. Read it before your first `ask`. |
| `review` | `card` | Returns your card with what a good card looks like. Give the result to a subagent to grade each point ok, good to fix or must fix; fix the must-fixes, use your judgement on the rest, then `ask`. One round. |
| `ask` | `agent`, `card` | Ask your owner one decision. Review it once first (see `review`). Only broken cards are refused here, with one line per problem. Then: *the full contract from design item 1.* |
| `wait` | `agent`, `decision`, `seconds?` (≤ 50) | Wait for the answer. Replies pending, or the option chosen, or your owner's note. Keep calling until answered; the answer waits for you. |
| `ack` | `agent`, `decision`, `nextSteps` | Tell your owner you read their answer and what you'll do. They see it with a green tick. Only the first acknowledgement counts. |
| `status` | `agent` | The pager's state and this agent's open decisions. |
| `history` | `agent`, `limit?` | Decisions already asked on this pager from this machine, with their answers. Check here if something may already be decided. |
| `finish` | `agent` | You're done with this piece of work. |

Input field descriptions repeat the relevant rule (`title`: "The question, under 100 characters"; `detail`: "One line for the inbox: what this decision is about, in plain words. No bookkeeping."; `options[].prioritizes`: "What this option optimises for, in your owner's terms"; `tradeoffs[]`: "One row per concern your owner cares about; a `rating: text` cell per option"). The MCP `card` input is the same structure as `card.yaml` as a JSON object; attachments as `{name, type, base64}`.

Tool replies are the same text as the CLI's, so a model reads the same words whichever way it arrived. Because the harness resends tool descriptions every turn, an MCP agent has the contract in context for the whole session; the reminder in `ask` replies mainly serves CLI agents.

## 4. Replies, word for word

**connect, success**
```
Connected as agent ap-7f3k on your owner's pager "Work" (project atomic-pages, as Codex).
Your owner's phone shows you as a new agent. Use --agent ap-7f3k for every question in
this piece of work; running connect again adds another agent.
Before your first card: agentpager rules
```

**connect, pager off**
```
Not connected. This pager is turned off and your message was not delivered.
Ask your owner to turn it on, or for another pager number.
```

**connect, bad number** (unknown, deleted, or fingerprint mismatch)
```
Not connected. This pager number is not in use. Ask your owner for their current one.
```
(A fingerprint mismatch gets its own line, since it means the server is lying or the number was mistyped: `The number's key doesn't match the server's. Check the number; if it's right, stop and tell your owner.`)

**ask, refused / sent**: in design item 1, §2. When a reminder is due, the reply ends with the short contract (design item 1, §1 and §3):
```
Sent. Your owner sees it as:
  Which M11 guarantee should we build?
  Two real alternatives: a smaller fix with occasional manual recovery, or…
Decision d_2x8w. Wait for the answer with: agentpager wait --agent ap-7f3k d_2x8w

It's been 9 hours since you last read the card contract. The short version:
  1. One question per card. 2. Write for someone who wasn't there. …
```

**ask, pager off** (also on `wait` and `ack`)
```
Not sent. This pager is turned off and your message was not delivered. Nothing is queued:
ask again once your owner turns it on, or ask them for another pager number.
```

**wait, pending**
```
Pending. Your owner hasn't answered "Which M11 guarantee should we build?" yet.
Keep waiting: agentpager wait --agent ap-7f3k d_4k2m
```
Claude Code and Claude Desktop get their own last line on `ask` and their own pending replies (§6).

**wait, option chosen**
```
Answered at 8:39 AM: option A "Visible + manual".
Do it, then confirm: agentpager ack --agent ap-7f3k d_4k2m "<what happens next>"
```

**wait, note (Ask for changes)**
```
Your owner wrote instead of choosing, at 7:44 AM:
  "Option B isn't an option, I can always write and ask for changes. Explain it to someone
   fresh to the project…"
Follow the note. If you still need a decision, ask a new card. Acknowledge this one with
what you'll do: agentpager ack --agent ap-7f3k d_4k2m "<next steps>"
```

**ack**
```
Acknowledged. Your owner sees "Build the smaller fix…" with a green tick on that decision.
```

**any command, server unreachable**
```
Can't reach https://agentpager.me (connection refused). Nothing was sent.
If this machine blocks outbound requests, add agentpager.me to its allow list and try again.
```

**any command, no reply** (timed out, or the connection dropped once it was open: the request may have gone out; exit 5. `connect` ends instead with `Connect again; their phone may show an extra agent from this try.`)
```
No reply from https://agentpager.me (timed out).
This may or may not have reached your owner. Check with `agentpager status --agent ap-7f3k` before trying again.
```

**any command, reply not understood** (a reply that doesn't decode, such as a Wi-Fi sign-in page answering 200; exit 5, ending connect as above)
```
The reply from https://agentpager.me wasn't understood (HTTP 200, text/html). A proxy or Wi-Fi sign-in page may have answered for it.
This may or may not have reached your owner. Check with `agentpager status --agent ap-7f3k` before trying again.
```
`wait --forever` keeps trying through no reply, as through an unreachable server; a reply it doesn't understand ends it.

**any command, unknown agent**
```
No agent ap-7f3k on this machine. Run `agentpager agents` to list them, or connect again.
```

**any command, agent file can't be read** (not JSON, or a field missing or wrong; exit 2; the file is never quoted, since it holds the key)
```
Can't read agent ap-7f3k's file, ~/.agentpager/agents/ap-7f3k.json (not JSON). Connect again for a new agent.
```

**arriving without the binary**: `https://agentpager.me/mcp` and `/start` both answer with one paragraph: install with the curl line, then `agentpager connect <number>`. No API documentation for hand-rolled calls.

## 5. History on disk

The binary encrypted every card it sent and decrypted every answer it received, so it has the plaintext. It appends one JSON line per event to `~/.agentpager/history/<pagerId>.jsonl`:

```
{"at":"2026-10-28T23:31:04Z","event":"asked","agent":"ap-7f3k","app":"Codex","project":"atomic-pages","decision":"d_4k2m","title":"Build narrow manual page recovery?","detail":"…","options":["Proceed","Defer"],"recommended":1}
{"at":"2026-10-28T23:33:40Z","event":"answered","agent":"ap-7f3k","decision":"d_4k2m","choice":1}
{"at":"2026-10-28T23:34:02Z","event":"acknowledged","agent":"ap-7f3k","decision":"d_4k2m","nextSteps":"…"}
{"at":"2026-10-29T03:31:12Z","event":"answered","agent":"ap-7f3k","decision":"d_9p1c","note":"Can you include the mockup and anything I need to review…"}
```

What it is for: an agent that wants to know what was already decided (after a compaction, or a helper checking its coordinator's earlier cards); a coordinator reviewing its helpers; and the owner's own analysis later (this document was built from Codex transcripts because nothing like this existed). It is per pager, not per agent, so every agent on this machine sees the same file. Card markdown and attachments are not stored, only the fields above; the full card is in the agent's own transcript if it needs it.

What it is not: guidance. Nothing from it is printed unless `history` is called. Owner's notes in it are answers to the decisions they were written on, not rules.

Retention: the file grows by a few hundred bytes per decision; cap at 1,000 lines per pager, oldest dropped. On an ephemeral VM it disappears with the VM, which is fine.

## 6. Waiting, and harness time limits

Claude Code's shell tool defaults to a 2-minute limit and Codex similar; cloud sessions cap at 10 minutes foreground. So:
- `wait` returns after at most 50 seconds by default and says how to call it again. An agent loops; a harness that backgrounds long commands can use `--forever`.
- The MCP `wait` tool takes `seconds` up to 50 for the same reason.
- The answer never expires on the server while the agent exists, so a wait that gets cut off loses nothing.

Two harnesses get their own words for waiting, because an answer reaches each one differently (tested 29–30 Oct 2026). The binary picks them when it positively identifies the harness. Over MCP, it goes by the client's name: `claude-code` is Claude Code and `local-agent-mode-<server>` is a Claude Desktop chat. From a shell, it needs `CLAUDECODE=1` with no other harness's marker around it. Everyone else, including Codex, pi and Cursor, gets the replies in §4 unchanged.

**Claude Code** wakes when a background command ends. The last line of `ask` says:
```
Decision d_2x8w. Wait for the answer in the background: run `/Users/me/.agentpager/bin/agentpager wait --agent ap-7f3k d_2x8w --forever` as a background command, then carry on or end your turn. It ends when your owner answers, and you get the answer then.
```
A pending `wait` repeats the recipe: `Keep waiting in the background: run …`. The path is this binary's own, because an MCP-configured binary needn't be on PATH.

**A Claude Desktop chat** is reached only while its turn lasts. It reaches this computer's tools through a link that drops a dozen times a day and comes back within seconds. The chat also has a cloud shell where the binary isn't installed, so the words name the tool. The last lines of `ask`:
```
Decision d_2x8w. Don't end your turn until it's answered: the answer reaches you only while you're working.
Other work that doesn't need it? Do it, and call the agentpager wait tool (agent ap-7f3k, decision d_2x8w) with seconds 1 between steps.
Nothing else to do? Call wait without seconds (it holds 50 s), again and again, until it returns the answer.
If a wait call fails or the wait tool disappears, the link to this computer dropped; it comes back by itself within seconds: run sleep 10 in your shell, then call wait again, up to 10 times.
```
A pending reply after a quick check says to carry on and check again after the next step, then call `wait` without seconds once the work runs out. After a full hold it says to call again now. Both end with the line about the dropped link. Two hours after `ask`, by the agent file's `askedAt`, the reply says to stop instead:
```
Pending. Your owner hasn't answered "Which M11 guarantee should we build?" in 2 hours.
Stop waiting: end your turn and tell your owner you stopped waiting for this decision. Their answer stays on the
server; call wait (agent ap-7f3k, decision d_2x8w) for it when you're next working.
```

## 7. Open questions for Sam

1. **Shared ids across machines.** A coordinator on your Mac and a helper on a VM can't share an agent file. Options: each connects separately (two agents on the phone, same project, so they group together anyway), or `agentpager share --export` prints a one-time token the helper imports. I'd ship without export and see if grouping by project is enough.
2. **`finish`.** Keep it (the phone can show "finished" and stop expecting more), or drop it and rely on housekeeping? Today's `finish_session` exists and is rarely called.
3. **History cap:** 1,000 lines per pager on the machine. Reasonable?
4. **App detection markers:** to be verified per harness when building; if a harness has none, the agent passes `--app`. Acceptable fallback is "Agent".
