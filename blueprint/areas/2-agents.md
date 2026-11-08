# 2 Agents

> **Definition:** The agent's side of an exchange, through the agentpager command: connecting with a pager number as a new agent, waiting for the answer in its own app, acknowledging it, and the history kept on its machine. Writing and checking a card belongs to 3 Cards, and installing and setting up the command to 7 Getting started.
> **Serves:** [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone) · [Reach the agents owners actually use](../PRODUCT.md#reach-the-agents-owners-actually-use) · [An acknowledgement always comes from the agent](../PRODUCT.md#an-acknowledgement-always-comes-from-the-agent) · [Pinned design decisions](../PRODUCT.md#pinned-design-decisions)
> **Relies on:** the agent apps owners already use, such as Claude Code, Claude Desktop, Codex, Cursor and pi, which the owner installs and signs in to. Each runs the command from its shell, or starts it as a local MCP server that setup adds without an agent's key or a pager number (B29.6), and says who it is. How an answer reaches a waiting agent depends on the app (B33).
> **Code:** `packages/cli/src/commands.ts`, `detect.ts`, `mcp.ts`, `store.ts`, `client.ts`, `main.ts`; `packages/app/src/pager.ts` (connecting, and every call an agent makes, in its pager's store), `wake.ts` (the waits it holds, each woken by what it waits for), `agent.ts` (each agent's way to its pager's store), `worker.ts` (which client each call names)
> **Screens:** [journeys/pager](../generated/screens/journeys/pager/README.md) · [phone/answered.png](../generated/screens/phone/answered.png) · [phone/notpickedup.png](../generated/screens/phone/notpickedup.png)
> **Walked by:** J3, J4, J5

## Behaviors

### B25 · @M3 · Connect with a pager number

2. The agent connects with the number, from the command line or through the command's MCP server. The number can instead come from `AGENTPAGER_PAGER`, so it needn't be written where transcripts show it.
<!-- B25.3 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
4. Each connect makes a new agent on the pager (I21). The phone shows its decisions under its project with who asked (B23), and the owner taps nothing to let it in.
5. The reply gives the agent its agent id and says that it shows on the owner's phone as a new agent, that it should use that id for every question in this piece of work, and that connecting again adds another agent. It ends by prompting the agent to read the card contract before its first card (B27).
6. The agent's key stays in a file on its machine that only the machine's user can read, and is never printed. Later calls name the agent only by its agent id.
7. A pager number only connects agents. It never reads, answers, turns off or deletes anything, and once an agent is connected the number plays no further part.
<!-- B25.8, B25.9 and B25.10 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
11. An agent can connect to a server other than agentpager.me. Every later call for that agent, from the command line or MCP, goes to the same server.
<!-- B25.12 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
13. An agent that finishes shows as finished on the phone and can ask nothing more. Its open decisions close unanswered and can't be answered. It can still wait for and acknowledge the answers already sent, and finishing again changes nothing.
14. @M5: A command too old for the service is refused on every call, stores nothing, and is told plainly how to update.

- The text usually goes in the project's AGENTS.md.
- A number carries the pager's 128-bit random id. That it can't be guessed holds by construction, not by an attack.
- Nothing checks the name an agent gives for itself.

### B32 · @M3 · Wait for the answer, then acknowledge it

2. One wait returns well within the time limits agent apps put on a single command or tool call, with the option chosen, the owner's note, or pending. An agent can ask a wait to return sooner.
<!-- B32.3 and B32.4 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
5. A note arrives word for word. The agent is told to follow it, to ask a new card if it still needs a decision, and to acknowledge this one with what it will do (B6).
6. An answer waits on the service for as long as its agent exists, so a wait that is cut off loses nothing.
7. From the command line, an agent can wait with no end. That wait keeps going through an unreachable or restarting service until the answer arrives, and ends early only on a refusal or a reply that isn't AgentPager's.
8. The agent acknowledges an answer with its next steps, and the owner sees them on the decision (B7, B17). Only the first acknowledgement counts, and one sent before the answer is refused, with how to wait first.
<!-- B32.9 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
10. A reply the command can't get or can't read is never taken as success. When nothing left the machine, the agent is told so. When the request may have reached the owner, the agent is told to check its status before trying again.
11. @M6: A wait for a decision that closed unanswered ends, telling the agent so. A wait with no end stops too.
12. @M7: An answer counts as picked up only once the agent's command has received it. A wait whose agent went away before then doesn't count, so the owner is still told it wasn't picked up (B5.13).

- An acknowledgement is the agent's own words, never AgentPager's. Collecting an answer is not acknowledging it (I6).
- If no agent collects an answer 3 minutes after Send, the owner is told once, on the decision (B5) and by an alert (B17).
- While the pager is off, waiting and acknowledging are refused like every other call, and nothing is queued (I17).

### B33 · @M3 · Each agent app is told how it wakes

1. The command words its waiting for an agent's app only when it identifies the app for certain. Every other agent, Codex, Cursor and pi among them, is told to wait with the command.
2. Claude Code is told to run the wait with no end as a background command, by the command's full path, then carry on or end its turn: the command ends when the owner answers, and Claude Code wakes the agent with the answer. A pending wait says the same.
3. A Claude Desktop chat is told not to end its turn until the answer comes, because the answer reaches it only while it works. It checks briefly between steps of other work, holds the wait again and again once its work runs out, and when the link to the computer drops, pauses and tries again. Two hours after it asked, it is told to stop waiting and tell its owner, and the answer stays on the service for its next wait.

- Verified on 30 Oct 2026, in the wake lab and then on the deployed product with Sam's iPhone ([docs/research/2026-10-30-agent-wake-lab.md](../../docs/research/2026-10-30-agent-wake-lab.md)). Claude Code, in a terminal and in the Claude desktop app's Code tab, woke when its background wait ended, including after a 40-minute wait. Claude Desktop chats waited from the ask reply's words alone, collected answers within 2 seconds of their being sent, and rode out a dropped link and a 75-second freeze of the app.
- Codex, Cursor and pi were not tested for waking, and nothing wakes them when the answer arrives (L11). For them, setup and who asked follow each app's documented or observed behaviour.

### B31 · @M3 · History on the agent's machine

1. The command records every decision asked from its machine, each answer its waits receive and each acknowledgement it sends, in one file per pager that only the machine's user can read.
<!-- B31.2 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
3. Nothing from the history is printed unless an agent asks for it, and none of it is sent to the service.
4. Each pager's file keeps its latest 1,000 lines, and older ones are dropped.

- It holds only what this machine asked. Agents on other machines, on the same pager, keep their own, and an answer never collected on this machine isn't in it.
- The owner's notes in it answer their own decisions. They are not guidance for other agents.

## Invariants

### I21 · @M3 · Every connect is a new agent

Why: [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone)

1. Every connect makes a new agent on its pager, with its own id and key, and never joins an agent already there.
2. Nothing matches agents by name or project, so two agents with the same app and project stay two agents.
3. An agent's key acts only on that agent's own decisions. It never reads, answers or acknowledges another agent's.
4. Helpers on the same machine that pass the same agent id ask as that one agent, and each can wait for the answers to its own decisions.

- The agent id is unique on its machine only, and is not a secret. The key stays in the agent's file (B25).
- Sharing an agent id works only on the machine that holds its file (L14).

## Limits

### L11 · @M3 · Only Claude agents wake by themselves

- What people meet: Codex, Cursor, pi and every other agent are told to call wait again while the answer is pending. One that keeps working in its turn and keeps calling wait gets the answer. One that ends its turn gets it only when something starts its next turn, so the owner has to nudge it. The owner is told when no agent has picked up an answer after 3 minutes (B17).
- Why it waits: only Claude Code and Claude Desktop were tested for how an answer reaches them, and on 30 Oct Sam chose words for those two and left the rest unchanged.
- What would fix it: a tested way for each app to wake its agent when the answer arrives, worded for that app as B33 does for Claude.
- When to revisit: CLIENTS, which settles which agent apps AgentPager supports.

### L12 · @M3 · A Desktop chat stops waiting after two hours

- What people meet: a Claude Desktop chat whose decision is still unanswered two hours after it asked ends its turn and tells its owner. An answer after that reaches it only when the owner next works in that chat.
- Why it waits: a Desktop chat is reached only while its turn lasts, and nothing from outside starts a new turn when the answer arrives.
- What would fix it: a way to wake a Desktop chat when its answer arrives. The 30 Oct lab ruled out a waiting card in the chat and the chat's scheduled check-ins.
- When to revisit: CLIENTS.

### L13 · @M3 · Cloud sessions are untested

- What people meet: an agent in a cloud session with a shell, such as one the Claude mobile app starts in a cloud VM, may work, but nothing promises it.
- Why it waits: cloud sessions with a shell should work too, but none has been tried.
- What would fix it: a recorded run of the command in one, including whether its network reaches agentpager.me and whether a long wait keeps the session from pausing. The 30 Oct lab saw a Claude Desktop chat's own cloud VM blocked from agentpager.me until the owner allowed it, and pause a few minutes after its turn ended.
- When to revisit: CLIENTS.

### L14 · @M3 · An agent id works on one machine only

- What people meet: a coordinator on a Mac and a helper on a VM can't share an agent. Each connects, and the phone shows two agents in the same project.
- Why it waits: on 29 Oct Sam confirmed that each machine connects for itself, with no sharing of agent ids across machines. Use will show whether grouping by project is enough.
- What would fix it: a way to carry an agent to another machine, such as a one-time export that the helper imports.
- When to revisit: when an owner needs one agent across machines.

### L15 · @M3 · Deleting a pager leaves its agents' files

- What people meet: after a pager is deleted, its agents' files and its history stay on each machine that connected to it, until someone removes them by hand.
- Why it waits: the service can't reach the agent's machine, and the command learns the pager is gone only on its next call.
- What would fix it: the command removing a pager's agents and history once the service says the pager is gone.
- When to revisit: FRIENDS, when owners other than Sam ask what stays on their machines.
