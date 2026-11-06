# The agent wake lab, 30 Oct 2026

Which agent apps act on an owner's answer by themselves, with nothing for the owner to nudge? Sam's rule is that an answer reaches the agent unprompted ([M3](../../blueprint/milestones/M3-command.md), Sam's answers). This lab tested Claude's apps. What was built from it is B33 in [2 Agents](../../blueprint/areas/2-agents.md), and [CLIENTS](../../blueprint/milestones/next/CLIENTS.md) decides which apps AgentPager supports.

## How it was tested

- On air, from the night of 29 Oct to the afternoon of 30 Oct 2026, Pacific time: Claude Desktop 4.4212.0, and Claude Code 2.1.314 in the terminal and 2.1.309 in the desktop app's Code tab.
- Throwaway MCP servers stood in for AgentPager and logged every message. Their `wait` held up to 50 s and returned pending or the answer, like `agentpager wait`. A shell script stood in for `wait --forever`, and the answer was a file written at a set time. No card reached Sam's phone.
- Terminal sessions were driven with AppleScript, the Desktop app with synthetic clicks (System Events clicks miss its buttons; CGEvent clicks don't), and each window was captured with `screencapture -l <window id>`. All of it needs the Mac unlocked.
- For the hosted-connector and sandbox tests, a second stand-in ran behind a temporary Tailscale Funnel address, added as a claude.ai custom connector and to the chat sandbox's allowed domains. All of it was removed afterwards.
- Then the chosen words were built into the command (PR #26) and checked with real Desktop chats against a local server, and end to end on prod (main 90b721f) with Sam's iPhone Air, 15:29–15:48 on 30 Oct.
- The full report, with screenshots and the bench log: [Waking a waiting agent](https://claude.ai/artifact/Ph2BtiR64UBSde6fbXW5LT).

## What wakes which app

Times run from the answer arriving to the agent acting. ✅ works with today's command · 🟡 the app can do it, but AgentPager would have to add support · ❌ won't work.

| Technique | Claude Code, terminal | Claude Code, Code tab | Claude Desktop chat | claude.ai chat |
| --- | --- | --- | --- | --- |
| A background `wait --forever` | ✅ about 1 s | ✅ 3 s | ❌ it runs only in the chat's cloud sandbox, which pauses about 4½ min after the turn ends | ❌ the same sandbox |
| `wait` called again and again in one turn | ✅ under 1 s | ✅ under 1 s | ✅ under 1 s after 48 min, through dropped links, once each reply says how to retry | ❌ no link to the Mac |
| `wait` as an MCP task | 🟡 2–7 s, with no model turns while waiting; needs MCP protocol 2026-07-28 | ❌ not offered | ❌ not offered | ❌ not offered |
| A channel push | 🟡 about 1 s, but every launch needs a development flag and a warning screen | ❌ never arrived | ❌ ignored | ❌ |
| CronCreate or `/loop` check-ins | ✅ 50 s, one turn a minute | ✅ 22 s | ❌ no such tool | ❌ no such tool |
| A repeated wait through a hosted connector, as v1 waited | 🟡 | 🟡 | 🟡 under 1 s after 44 min, untouched by dropped links; each call is cut at 230 s | 🟡 needs a hosted server again |
| `send_later` check-ins | ❌ no such tool | ❌ no such tool | ❌ 1 of 4 fired | 🟡 only some chats have it |
| Typing the answer into the app | 🟡 2 s, only while the Mac is unlocked | 🟡 the same | 🟡 the same | 🟡 needs a hosted connector |

## Findings

- **Claude Code** wakes when a background command ends, so it needs only the words: run `wait --forever` in the background, then carry on or end the turn. A wait as an MCP task would need no such words, but only the terminal offers MCP tasks.
- **A Claude Desktop chat** can't be woken once its turn ends. It catches the answer only by calling wait again and again within its turn, each call a model step, about 70 an hour. A tool call on the Mac must finish within 60 s, so a wait holds 50 s. The chat also has a cloud shell where the command isn't installed, so its words name the wait tool, not a command to run.
- **Desktop's link to the Mac** dropped 12 to 21 times a day and came back within 1 to 4 s. Usually the bridge resends the call in flight. When a call did fail, a reply telling the agent to `sleep 10` and call again carried it through, including a 75 s freeze of the app. A Mac asleep, or Desktop closed, for longer than the retries ends the wait.
- **Desktop chats run as Claude Code cloud sessions linked to the Mac.** To a server on the Mac, their MCP client (`local-agent-mode-<server>`) offers only MCP App UI and roots: no tasks, sampling or elicitation, and no turn starts for an MCP notification. All Desktop chats share one such server process. To a hosted connector the client is Claude Code 2.1.314, which adds elicitation but still no tasks.
- **A hosted wait** would hold up better for Desktop: it ignores the Mac's link and sleep, and at about 200 s a call it costs a quarter of the model steps. It needs a hosted server again; under end-to-end encryption it could say only "answered", leaving the command to read and decrypt the answer.
- **A chat started on claude.ai** has no link to the Mac, and its sandbox can't resolve agentpager.me, so it can't reach the command at all.
- **Ruled out:** one long tool call (cut at 60 s on the Mac and 230 s hosted); a waiting card drawn by an MCP App (a Mac-linked chat never draws it); a plugin's hooks or monitors, and timers in the chat's sandbox (the sandbox pauses about 4½ min after the turn); a `claude://` link (it fills in the text but can't send it); MCP notifications, sampling and elicitation.
- **Codex, Cursor, pi and OpenCode weren't tested.** Leads from reading Plannotator's source on 30 Oct, none tried: Codex can queue a message into a thread (`codex queue --thread=<id>`), pi can send one (`sendUserMessage`) and OpenCode can start a turn (`session.prompt`). For Claude Code: an async hook with `asyncRewake`, a Stop hook that blocks until the answer, a turn started by a mod, or typing into the agent's pane under Herdr or tmux.

## What was built

- **Sam chose, on 30 Oct:** Claude Code waits in the background. A Desktop chat checks quickly between its other steps, then holds 50 s at a time, and stops after 2 hours. Only an app the command identifies for certain gets these words; every other app keeps the plain ones. PR #26 built it, and B33 holds it.
- **With real apps and a local server:** a 40-minute background wait in the Code tab woke its session. Three Desktop chats waited from the ask reply's words alone, collected answers within 2 s of Send, acknowledged within 4 s, and rode out a 75 s freeze of the app.
- **On prod, with Sam's phone:** a Claude Code background wait woke at the answer, and a Desktop chat worked through six steps, then waited and caught the answer unprompted. The alert that no agent had picked up an answer arrived after 3 minutes (PR #27). All three agents in the run acknowledged.

## Re-testing

- The results depend on the apps' versions, which change often: re-test before relying on any of them.
- Desktop rewrites `claude_desktop_config.json` from memory, so edit it only while Desktop is quit. A `node` wrapper on the MCP entry logs every JSON-RPC line with its time.
- The waking words live in `packages/cli/src/commands.ts`, and `packages/cli/test/wait.test.ts` checks them. Their first spec was `docs/v2/03-binary-surface.md` §6, kept in git at the tag `history-archive`.
