# The clients wake lab, 8 Nov 2026

Can each agent app Sam picked for CLIENTS be woken when its owner's answer arrives, the way its app allows? On 8 Nov Sam chose the wakes Plannotator v0.28.53 ships (D1 in [M7 CLIENTS](../../blueprint/milestones/M7-clients.md)): a Claude Code plugin whose mod hands the answer over as a new turn, `codex queue` run by the agentpager command for Codex, and a pi extension that only wakes. This lab ran each one as a prototype against a local server, before any product code. It follows the [30 Oct wake lab](2026-10-30-agent-wake-lab.md), which tested only Claude's apps.

## How it was tested

- On pro, 8 Nov 2026, 18:54 to 19:32 UTC. Times below are UTC, from each app's own record (Claude Code's transcript, Codex's rollout, pi's session and the extension's log) against the server's `sentAt` for the answer.
- Versions: Claude Code 2.1.319. Codex CLI 0.163.0 (Homebrew), its shared app-server daemon 0.167.0, and the ChatGPT app's bundled `codex-cli` 0.167.0-alpha.3.2. pi 1.4.0 on xAI `grok-latest` at thinking low. Claude Code ran Sonnet 5.5 at low effort; Codex ran GPT-6.1-Sol. The agentpager command was built from main at 49d36bd. tmux 3.8, Node 24.22.0.
- The service was the suites' local fixture (`packages/app/test/support.ts`) with a 20-second not-picked-up clock. A script played the owner with the same helpers: it made each pager as the phone does, read each card and sent answers sealed to the card's key. No pager had a push token and no phone took part, so nothing alerted anyone.
- Each app's terminal interface ran in its own tmux server with a clean environment, in a throwaway folder, with a throwaway `AGENTPAGER_HOME`. Each run set its own configuration: Claude Code `--plugin-dir` and `--strict-mcp-config`; Codex `-c` overrides that turned Sam's agentpager entry off and a lab entry on behind a tap that logged every JSON-RPC line, plus one set of runs with no overrides; pi `-ne -nc -e <extension>`.
- The prototypes were a Claude Code mod, a pi extension, and a shell script standing in for the command's Codex wake. They lived in the lab's scratch folder and are not in this repository.
- Outside that folder the runs left Claude Code transcripts under `~/.claude/projects/`, one trust entry for the lab's Claude Code folder in `~/.claude.json`, and three Codex threads in `~/.codex/sessions`, archived afterwards with `codex archive`.

## What woke which app

Latency runs from the answer stored on the service to the agent's turn starting.

| App | Wake | Idle | Busy | When the app is gone |
| --- | --- | --- | --- | --- |
| Claude Code, terminal | the mod: a wait it holds, then `$.prompt.submit` with the command's reply | 84 ms, 85 ms | the next turn, 15 ms after the running one ended | `claude -p`: the mod loads, but its wait is killed when the run exits, and nothing wakes |
| Claude Code, terminal | today's background `wait --forever` | 20 ms, 20 ms, then one more step to read the output | not run | not run |
| Codex TUI on the shared daemon | `codex queue` with a doorbell | 83 ms | not run | quit 6 s earlier: the daemon ran the turn with no window open, 32 ms after the queue call. Quit about 5 min earlier: no turn until resumed, then 0.6 s |
| Codex TUI, embedded (any `-c` override) | `codex queue` with a doorbell | 2.9 s, 3.7 s, 8.6 s | the next turn, 6 ms after the running one ended | no turn while closed; on resume, 1.1 s |
| `codex exec` | `codex queue` | the call succeeds, and nothing ever runs it | | |
| pi, terminal | the extension: a wait it holds, then a follow-up turn | 32 ms (`sendUserMessage`), 29 ms (`sendMessage` with `triggerTurn`) | delivered at `agent_settled`, the same millisecond | `pi -p`: the run doesn't exit by itself, and the wait it leaves behind collects the answer |

### Claude Code 2.1.319, terminal

- **The mod.** A hooks module (`hooks/register.ts`) watched each Bash call. When one ran the agentpager command and its reply began `Sent. Your owner sees it as:`, the mod read the agent and decision ids from the reply text, started `agentpager wait --agent <id> <decision> --forever` with `$.process.spawn`, and when the wait returned, called `$.prompt.submit` with the command's reply. The command did the decrypting; the mod carried its words.
- `$.prompt.submit` starts a turn of its own once Claude is idle and never joins a running one. When idle, the plugin's row was in the transcript 84 ms and 85 ms after Send. When busy (a 40 s command), the prompt was queued 82 ms after Send and its turn began 15 ms after the running turn ended.
- The spawned wait outlived the hook that started it, for up to 38 s in these runs, and was killed when a `claude -p` run exited.
- `claude plugin validate` refuses a module that stores or passes `$`. Every call has to be written `$.noun.method(...)` inside the hook that uses it.
- A variable the mod sets with `$.env.set` at session start reaches the Bash tool's commands: `AGENTPAGER_WAKE=claude-code-mod` was there. The command could tell from it that a mod is waiting for it.
- **Today's background wait**, without the mod, woke Claude Code 20 ms after Send by its task notification. The agent then had to read the wait's output file before it could acknowledge: one more step than with the mod.
- **Both at once** wake twice. With the mod loaded and the ask reply's words followed, the background wait woke the agent at 20 ms and it acknowledged. The mod's turn came after that turn ended, and was wasted: the agent saw it had already acknowledged.
- **`claude -p`** ran the mod: its session start, its Bash hook and its spawn all happened. When the run exited, its wait was killed by SIGTERM, a second after it started. Plannotator's guide says its mod is off in `-p`, SDK runs and Windows; its source shows the mod turns itself off when `session.start` says the session isn't interactive. In 2.1.319 the engine itself still runs a `--plugin-dir` mod in `-p`.

### Codex 0.163.0

- **Every MCP tool call names its thread.** Each `tools/call` from Codex carried `params._meta.threadId` and `params._meta["x-codex-turn-metadata"]` with `thread_id`, `turn_id`, `turn_trigger`, `thread_source`, `turn_started_at_unix_ms` and `codex_version`. `turn_trigger` was `user` for a typed turn, `queue` for a queued one and `exec` in `codex exec`. The same id was `CODEX_THREAD_ID` in the shell Codex runs commands in. The MCP server's own environment had no `CODEX_THREAD_ID`, so the server learns the thread call by call. The client named itself `codex-mcp-client`.
- **Two ways Codex runs.** With any `-c` override, the terminal interface runs embedded, without the shared background server; its startup warning says so. Without overrides it runs on the shared app-server daemon (0.167.0 here). Setup writes config with `codex mcp add`, so a real setup runs on the daemon. Both were tested.
- **On the daemon**, commands Codex runs get the daemon's environment, not the terminal's: `TMUX` was unset, and `PATH` found `~/.local/bin/agentpager` first. `CODEX_THREAD_ID` was set.
- **The doorbell.** The stand-in held the command's wait with no end and, when it returned, ran `codex queue --thread <id> --message <text>`. The text named the decision and told the agent to collect it with its wait, with no answer in it. Each call exited 0 with `Queued message <id> for thread <id>` in 46 to 57 ms, and 99 ms with the ChatGPT app's bundled CLI.
- **Idle on the daemon:** the turn started 37 ms after the queue call began, 83 ms after Send.
- **Closed on the daemon:** quit 6 s before the answer, the thread still ran the queued turn, 32 ms after the call, with no window open: the agent collected and acknowledged headless. Queued about 5 minutes after its last turn, it ran nothing in the 12 minutes before it was resumed, and ran 0.6 s after resuming.
- **Embedded:** idle turns started 2.9 s, 3.7 s and 8.6 s after the call. All three started on one beat (at :39.167, :19.165 and :19.168), which looks like polling every 10 or 20 s; three runs can't tell which. A busy thread got the message as its next turn, 6 ms after the running turn completed, never in the middle of one. A closed thread ran nothing for 2 minutes, then ran 1.1 s after `codex resume`. Quitting stopped the lab's MCP server with SIGTERM.
- **`codex exec`:** a queue to its finished thread exited 0, and nothing ran it in the 22 minutes before the lab ended. A resume would run it then. A thread Codex doesn't know exits 1: `no rollout found` for an unknown id, `No active session found` for an unknown name.
- **The process list.** A `ps` taken just after the call started showed its whole command line, message included. The doorbell carries the agent and decision ids, never the answer.
- **The ChatGPT app's CLI and the terminal's share threads on disk.** The app's bundled CLI queued into a thread made by the Homebrew CLI, and that thread took the turn. The app's own threads are rollouts in the same `~/.codex/sessions` (originator `codex_work_desktop`), next to the CLI's. Whether the app's window lists a thread made in the terminal wasn't checked: that needs the app's window.

### pi 1.4.0

- **The extension** watched `tool_result` for bash. When one ran the agentpager command and its reply began `Sent.`, it started the command's wait with no end as a child process. When the wait returned, it delivered the command's reply as soon as pi was idle, had no queued messages and had settled, or else at the next `agent_settled`.
- Idle, `pi.sendUserMessage(text, { deliverAs: "followUp" })` started the run 32 ms after Send. `pi.sendMessage(..., { triggerTurn: true, deliverAs: "followUp" })` started it in 29 ms, as a run whose `messageType` is `custom`.
- Busy, the reply was held and went in the millisecond pi settled. The extension learned of the ask only when that bash call finished: the model had chained the ask and 40 s of work in one command.
- **Print mode** (`pi -p`) loads extensions, with `mode` `print` and no UI. The extension's child process kept pi from exiting after its last reply, until the lab's 120 s time limit killed it. The wait then ran on as an orphan, collected the answer when it came, and had no one to give it to.
- The agent used the agentpager command through bash; the extension added no tool. Plannotator's docs say pi sends every tool's whole definition with every request (read, not measured here).

### The not-picked-up warning that never fires

- Reproduced with the command alone, on one agent, with the 20 s clock:

  | Case | Answer stored | Collected | Warned |
  | --- | --- | --- | --- |
  | no wait | 18:54:57.056 | no | after 20.0 s |
  | `wait --forever` killed 5 s in, answered 1 s later | 18:55:03.171 | the same millisecond | never |
  | one 50 s wait killed 5 s in, answered 1 s later | 18:55:09.299 | the same millisecond | never |
  | `wait --forever` killed, answered 30 s later | 18:57:59.856 | the same millisecond | never |
  | `wait --forever` killed, answered 55 s later | 18:57:24.721 | no | after 20.0 s |

- So the gap is the rest of the dead request's hold, up to 50 s. The lab met it three more ways: the mod's wait killed when `claude -p` exited (answered 8 s later: collected, never warned), pi's orphaned wait after `pi -p`, and the Codex stand-in's own wait, which collected the `codex exec` answer that nothing ever read.
- The warning is what B5.13 and B17.8 promise (TERMS › Not picked up: an answer no agent has read 3 minutes after Send). A wait whose caller is gone counts as an agent that read it.
- **Where:** `packages/app/src/pager.ts`, the agent's `read`. The look inside `this.waits.hold(...)` inserts the `collections_v4` row and deletes the `pickups_v4` row in the same transaction that finds the answer. A held wait sleeps in `wake.ts` until the answer's store wakes it, and nothing tells it that its caller has gone: local workerd didn't end the Durable Object's request when the command was killed. The reply is then written to no one. Whether Cloudflare ends it there wasn't tested.
- **What a fix would look like** (not in this pull request): a collection counts only once the command says it has the answer. The command opens the answer and then sends a small receipt, or its acknowledgement counts as one, and only that clears the pickup clock and stamps the collection. A wait's reply stays as it is now. A command too old to send receipts keeps today's rule, known by its client header. Skipping the collection when the request's signal has aborted is weaker: it misses a reply lost after it was written. A receipt also keeps a wake's own watcher from silencing the warning.

### Claude Desktop chats and the desktop Code tab (not tested)

- What still holds from the 30 Oct lab: a Desktop chat can't be woken once its turn ends, so it waits in its turn by calling wait again and again, rides out a dropped link to the Mac, and stops after 2 hours (B33.3, L12). In the Code tab, Claude Code 2.1.309 woke from a background `wait --forever` after 40 minutes.
- Whether a mod runs in the Code tab, read from the 2.1.319 plugin types: hooks modules have a `desktop` surface to draw on, and `session.start` reports `isInteractive` false for a `-p` run or the SDK. Plannotator's mod turns itself off when that is false, and its guide says the mod is off in SDK runs. D1 in M7 names the Code tab among the SDK runs. Assumed: a mod's `$.prompt.submit` can't be relied on there, so the background wait stays the Code tab's wake. To find out: with the plugin installed, ask from a Code tab session, end the turn, answer, and look for the plugin's turn in its transcript.

### A cloud session (L13): not run

- `claude --cloud "<description>"` would start one from pro without Sam, but its VM can't reach a server on pro, and this lab may use neither dev nor prod. The steps for Sam, or for the root on dev:
  1. On claude.ai/code, give a cloud environment network access to `dev.agentpager.me`, and a setup script that installs the command (today: Bun, a clone of this repository and `pnpm --filter @agentpager/cli build`).
  2. Make a throwaway pager on the dev phone and put its number in the environment's variables as `AGENTPAGER_PAGER`, never in the repository.
  3. From pro, `claude --cloud` with a task: `agentpager connect --server https://dev.agentpager.me`, ask a card, run `wait --forever` in the background, end the turn.
  4. Answer on the dev phone 1, 10 and 60 minutes after the turn ended. Record whether the background wait woke the session each time, how long the VM stayed up after the turn, and whether a stdio server from `.mcp.json` starts there.

## What the command needs for each wake

- **Claude Code mod.** A record of what is waiting that the mod doesn't parse from reply text: the mod read `Decision d_…` and `--agent ap-…` from the words. Ask replies worded for the mod when it is there (`AGENTPAGER_WAKE` reaches the command), so the agent ends its turn instead of also waiting in the background. A collection that counts only once the agent has the answer, since a run that exits kills the mod's wait mid-request (seen with `claude -p`).
- **Codex.** The thread id, from `_meta.threadId` on an MCP call or `CODEX_THREAD_ID` in the shell. No ring for `codex exec` (`turn_trigger` `exec`, or the rollout's originator `codex_exec`). A watcher that outlives the call that asked and Codex itself, since Codex stops its MCP servers when it quits and a closed thread still has to be rung. A Codex CLI with `codex queue` (0.149 or later), on `PATH` or the ChatGPT app's own. One ring per answer, recorded so it is never rung twice, and none again after a call times out. A watcher that doesn't collect, so it doesn't hide a not-picked-up answer.
- **pi extension.** The same record of what is waiting, and no watching in print or JSON mode. Every child killed at `session_shutdown`.
- **All three.** The pickup fix above, so that an answer only a watcher saw still gets its warning.

## Risks

- **The process list.** Codex's doorbell is an argument of `codex queue`, readable by `ps` for the 50 to 100 ms the call takes. It holds the agent and decision ids, never the answer. The mod and the extension pass nothing through arguments; the answer lands in the app's own transcript, as anything the agent reads does.
- **Double delivery.** The Claude Code mod with today's background-wait words woke the agent twice. A Codex agent that calls wait itself and then gets the doorbell spends a turn finding nothing new. Two processes on one session (Plannotator holds a lease for this) weren't tested.
- **A lost wake.** `claude -p`, `pi -p` and `codex exec` all leave the answer on the service with nothing to bring it, and so does any Claude Code exit, since unloading a module kills its children (read from the mod types). On the daemon, a closed Codex thread gets it when resumed, or headless if the daemon still holds the thread. An embedded Codex took up to 8.6 s. In every case only the not-picked-up warning tells the owner, and today it is silenced whenever a wait has seen the answer.
- **Headless turns.** On the daemon, a queued turn for a just-closed thread runs with no window open: the agent acts on the answer while no one watches it.

## What the Blueprint lines could promise, per app

These are proposals for Sam. Nothing under `blueprint/` changes in this pull request.

- **Claude Code in a terminal, with the plugin:** the answer arrives as a new turn within a second once Claude is idle, after its current turn if it is busy, with no waiting words. Without the plugin, and in `-p`, the SDK and the desktop Code tab: today's background wait (B33.2).
- **Codex in the terminal and the ChatGPT app:** a note that the answer is in arrives in the thread that asked, within a second when it is idle, as the next turn when it is busy, and when the thread is resumed if Codex is closed. The note never holds the answer. `codex exec` isn't woken. A Codex started with `-c` overrides takes seconds (2.9 to 8.6 s here; its beat may allow up to 20 s).
- **pi with the extension:** the answer arrives as a follow-up turn once pi settles. Print and JSON mode aren't woken.
- **Claude Desktop chats:** they wait in their turn, as B33.3 says today.
- **The warning:** an owner hears that no agent has picked an answer up 3 minutes after Send whenever no agent has it, including when a wait's caller went away.

## Re-testing

- These results depend on each app's version. Re-run them at every release, as M7 says.
- The owner script used `fixture()`, `makePager()` and `answer()` from `packages/app/test/support.ts`, run from a worktree with `node --experimental-strip-types`. Each app ran in tmux with `env -i`, so no variable of the session that started the lab leaked into it.
- Codex runs embedded whenever any `-c` is given: test the daemon path with no overrides, and keep Sam's own agentpager MCP entry out of reach by using the command from the shell.
- Claude Code 2.1.319 refused a standalone foreground `sleep`; a busy turn needs another long command.
