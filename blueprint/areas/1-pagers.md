# 1 Pagers

> **Definition:** The pagers the owner makes on the phone, and the iPhone app that holds them: making a pager and giving out its number, the Pagers and Pager screens, turning a pager off and on, auto-off, deleting, and what an off or deleted pager means for its agents. Reading and answering a decision is 5 Answering, alerts and the badge are 4 Getting paged, connecting with a number is 2 Agents, the pager's keys and the number's fingerprint are 6 Privacy, and installing the app is 7 Getting started, with its limit L24.
> **Serves:** [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone) · [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone) · [A pager is on until I turn it off](../PRODUCT.md#a-pager-is-on-until-i-turn-it-off) · [Stack](../PRODUCT.md#stack) · [Feel native](../PRODUCT.md#feel-native) · [Pinned design decisions](../PRODUCT.md#pinned-design-decisions)
> **Relies on:** an iPhone with iOS 26, where the app runs · the iPhone's Keychain, which keeps each pager's keys on that phone only and out of its backups · iOS Settings, which holds the app's server address · Cloudflare, where the service keeps each pager's state and its agents (6 Privacy)
> **Code:** `packages/ios/AgentPager/`, the app: `Views/PagersView.swift`, `Views/PagerView.swift`, `Views/PagerDetailView.swift`, `Model/AppModel.swift`, `Model/Keychain.swift`, `Model/Wording.swift`, `Settings.bundle` · `packages/app/src/registry.ts` (pagers, off, auto-off, delete) · `packages/app/src/agent.ts` (the off check on every call, forgetting idle agents) · `packages/app/src/contract.ts` (the auto-off and idle times)
> **Screens:** [pagers](../generated/screens/phone/pagers.png) · [empty](../generated/screens/phone/empty.png) · [pager](../generated/screens/phone/pager.png) · [detail](../generated/screens/phone/detail.png) · [new](../generated/screens/phone/new.png) · journeys: [pager](../generated/screens/journeys/pager/README.md), [off-and-on](../generated/screens/journeys/off-and-on/README.md), [delete](../generated/screens/journeys/delete/README.md)
> **Walked by:** J4, J5

## Behaviors

### B26 · @M2 · Make a pager on the phone

1. From Pagers, the owner starts a new pager. New pager asks for a name and when the pager turns off: never, or after 24 hours, 7 days or 30 days. Never is the default.
2. A pager's name is seen only on this phone. The service never gets it.
3. The phone makes the pager's number itself (I19), so New pager shows the text to give agents, with the number, before Create. Copying it copies the text as one block.
4. The text names the pager's server, agentpager.me unless the app is set to another (B23.10), and gives the command that connects an agent with this pager's number.
5. @M3: On a server other than agentpager.me, the command in the text names that server too, so the agent connects there.
<!-- B26.6 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
7. If Create gets no reply, pressing it again makes the same pager, not a second one.
8. The same text is in the pager's detail at any time (B22). The number shows only there and in New pager, never on Pagers.
9. A phone holds as many pagers as the owner makes, each with its own number, keys and switch.

- The text, as chosen on 29 Oct 2026: "When I'm away and you need my decision, use agentpager.me MCP or CLI to send me decisions:", then "$ agentpager connect ap1_…" on its own line.
- The owner gives the text to an agent, for example in AGENTS.md, and the agent connects with it (B25). It works for an agent only once the agentpager command is installed where it runs (B29); an agent without it can find how to install it at the server's /start (B18). The app itself gives no install instructions, as chosen on 29 Oct.

### B23 · @M2 · Pagers and the Pager screen

4. A pager's decisions are grouped by project. Projects with open decisions come first, the one waiting longest on top. In each project, open decisions come oldest first, each with its question, who asked and how long ago.
5. Each project folds its answered decisions into one row with their count, which opens them (B7). With nothing open in that project, the row also names who asked.
<!-- B23.6 dropped in Sam's review, 6 Nov 2026; ids are never reused -->
7. The phone lists the pagers whose keys it holds, with the state the service reports for each. A pager is dropped from the phone, with its keys, only when the service says it no longer exists.
8. While the service can't be reached, the phone shows what it last read, and Pagers says it can't reach the server and when it last updated. While the service can be reached, Pagers shows no such line.
9. A pager made on another phone never shows on this one.
10. The server's address is set in iOS Settings; the app has no Settings screen of its own. The phone shows only the pagers made on the server it is set to.
11. @M4: A pager made on dev.agentpager.me is marked dev on its row in Pagers and on its own screen. A pager made on agentpager.me isn't.

- The server's address is for self-hosters. Left empty, the app uses agentpager.me.
- The phone counts a server as dev when its address starts with `dev.`, as /start does (B18.5), so a pager made on a local server isn't marked.

### B22 · @M2 · Turn a pager off and on, or delete it

2. A pager's row says whether it is active and, if it turns off by itself, how soon; or that it is off, and since when.
3. Turning a pager off stops its agents reaching the owner (I17). It doesn't stop the agents themselves.
4. While a pager is off, the phone keeps everything, and its decisions stay readable. The owner can't answer until the pager is on again, and an open decision offers to turn it on (B5).
5. Turning a pager on makes its open decisions answerable again and starts its auto-off again.
6. Auto-off is never, or after 24 hours, 7 days or 30 days. It counts from when the pager was last turned on, or from the change if the owner changes it while the pager is on. A choice made while the pager is off waits until it is turned on.
7. Auto-off lands in the same off state as the switch, off since the time it was due.
8. The phone shows the state and turn-off time the service reports. It never turns a pager off by its own clock.
9. Deleting a pager asks to confirm, saying that its decisions are deleted from this phone and the service, and that agents with its number can't reach the owner.
10. Confirming removes the pager from the phone, and the service forgets it with its agents and their decisions (I17.5).

- Rows read, for example, "Active · Stays on", "Active · Turns off in 18h" and "Off since yesterday".

## Invariants

### I17 · @M2 · Off pagers deliver nothing

Why: [Only agents I give a number reach my phone](../PRODUCT.md#only-agents-i-give-a-number-reach-my-phone)

1. A pager turns off only when its owner turns it off or its auto-off comes due (B22), and turns on only when its owner turns it on. No activity puts off its auto-off.
2. Once a pager is off, every call from its agents that sends or collects something (asking, waiting for an answer, acknowledging, finishing), every connect with its number and every answer from its phone is refused. An agent is told plainly that its message was not delivered, and to ask again once its owner turns the pager on, or to ask for another number.
3. Nothing is queued: nothing refused while a pager is off arrives once it is turned on again.
4. While a pager is off, an agent can still ask whether its pager is on, and the phone still reads the pager and every decision with its attachments.
5. When a pager is deleted, the service deletes the pager, its agents, and their decisions, attachments, answers, acknowledgements and key digests. Its number connects nothing, and its agents' keys are refused as unknown.
6. An agent with no activity for 30 days is forgotten the same way, and its pager stops listing it. Activity is asking, the owner's answer, acknowledging and finishing; waiting for an answer is not.

- A call the service has already checked when the owner turns the pager off can still land (L10).
- Nothing is claimed about copies in the platform's own backups, such as Cloudflare's point-in-time recovery.
- The agentpager command's files on an agent's machine, its history among them (B31), stay after a pager is deleted (L15, in 2 Agents).

### I24 · @M3 · A restart loses nothing

Why: [Unblock my agent from my phone](../PRODUCT.md#unblock-my-agent-from-my-phone)

1. Closing and reopening the app, or restarting the service on unchanged storage, loses no pager, decision or agent, and each agent's next call works with the same id.

## Limits

### L9 · @M2 · A pager lives only on the phone that made it

- What people meet: a pager's keys stay in the Keychain of the phone that made it, on that device only. They are not in its backups, they don't move to a new phone, and nothing joins pagers across phones. A second phone shows none of the first one's pagers, and a lost or replaced phone loses its pagers for good: the owner makes new ones and gives agents the new numbers.
- Why it waits: moving a pager to a new phone, or recovering its keys, was left out of M2, and ENCRYPT leaves it out too.
- What would fix it: a way to move a pager's keys to another phone, or to recover them.
- When to revisit: when an owner changes phone.

### L10 · @M2 · Turning a pager off can let one call through

- What people meet: an agent's call that the service has already checked against its pager when the owner turns the pager off still lands. The window is one check inside the service; everything sent after the switch is refused (I17.2).
- Why it waits: accepted on 30 Oct 2026 for dogfooding, to fix later.
- What would fix it: one writer per pager, which [M6 · TIDY](../milestones/M6-tidy.md) builds.
- When to revisit: TIDY, right after ENCRYPT.

### L25 · @M5 · A leaked number can connect any number of agents

- What people meet: nothing limits how fast a pager number can connect agents. Until the owner turns the pager off (I17.2), whoever has a leaked number can connect any number of agents, and each one can page the owner. Such a number still reads nothing.
- Why it waits: on 6 Nov 2026 Sam chose to leave it out of ENCRYPT ([M5-encrypt.md](../milestones/M5-encrypt.md), question 9), since it isn't part of what encryption guarantees, and turning the pager off stops it.
- What would fix it: the service limiting how fast one number can connect agents.
- When to revisit: before other people get numbers, at [FRIENDS](../milestones/next/FRIENDS.md).
