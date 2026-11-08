# M6 · Tidy state

> **Status:** planning · **Started:** 7 Nov 2026 · **Order:** after M5; CLIENTS follows · **Word:** TIDY

## Objective

Three of the hardening items the 30 Oct engineering review held for ENCRYPT, which Sam split off on 6 Nov into their own milestone, right after it (DEC-2026-11-06-store-after-encrypt), under the word Sam chose the same day (DEC-2026-11-06-tidy):
- **One writer per pager:** one store per pager, holding its row, its agents and their decisions. This is what closes L10, a call that lands as the pager turns off.
- **Smaller polls,** both of them: the phone reads one object per pager instead of one per agent, and a waiting agent is woken when its answer arrives instead of checking storage every 100 ms.
- **The agent's lifecycle:** connected, finished, idle, forgotten, and deleted with its pager, as one state machine. Finishing closes the agent's open decisions, so they can't be answered (Sam's answer to the question put on 6 Nov, recorded in [M5-encrypt.md](M5-encrypt.md), question 5).

## Owner decides first

Six questions for Sam, each with options and ★ on the recommendation, so Sam can answer in one line, such as `1a 2a 3a 4a 5b 6a`. Questions 1 and 2 are TIDY's own, from its queued doc; 3 to 6 came up in planning. Each builds on What's known, below.

1. **What the move to one store per pager keeps.** Each pager's row is in the Registry and each agent's decisions are in that agent's own store, so one store per pager moves stored data.
   - (a) ★ Keep everything: every pager, agent, decision, attachment, answer and acknowledgement, with when each answer was collected or warned about, and each agent's id, key and last activity. Each agent's next call works as before, and the phone shows the same. The upgrade check proves it on dev against the `m5` baseline, before 8 Dec 2026, when the baseline's agent would be forgotten:
     - after the move reaches dev, `pnpm smoke:dev` reads the baseline back as `baseline.mjs --verify` does, and every check passes unchanged: the pager, on, with its key and number; its one agent, whose who-asked opens; the open decision; the acknowledged one with its answer, its collection and its acknowledgement; both attachments, byte for byte; and the `m5` command's own status for that agent;
     - and the agent's last activity is unchanged, so its forget date doesn't move;
     - the check only reads, so every smoke run can repeat it;
     - a local test runs the whole loop on moved data: `m5`'s service on fresh storage, a local baseline, then TIDY's service on the same storage, where the phone answers the open decision and the `m5` command collects and acknowledges it.
   - (b) Start again: the move deletes every agent and decision and keeps every pager, as M5 did. Sam's agents connect again, and the phone's decisions go; each machine's history keeps its own. A second release exception in a row (METHOD › Stages and releases), with less code.
   - Not offered: keep the agents and drop their decisions. Agents waiting on an answer would find their decision gone, which costs both (a)'s move and (b)'s loss.
   - Why ★: it is METHOD's rule, and the last chance to practise a move that keeps data before FRIENDS brings data that isn't Sam's. It costs one pull request through the adversarial loop and a local upgrade test.
2. **A decision that finishing closed.** Sam chose on 6 Nov that finishing closes the agent's open decisions so they can't be answered. What the phone shows, and what an agent waiting on one is told:
   - (a) ★ The phone moves it to its project's answered decisions, saying who asked finished before it was answered. Its question and brief stay readable, with nothing to pick or send, and it no longer counts as waiting, on the pager or the badge. An agent waiting on it is told that it closed unanswered when the agent finished, and its wait ends, a wait with no end too.
   - (b) The agent is told the same. On the phone it stays among the project's open decisions, after the ones the owner can answer, greyed, with the same words, until the agent is forgotten. The owner sees what was left undone first; the open list then holds decisions the owner can't answer.
   - Not offered: the decision leaves the phone at finish. PRODUCT.md › Unblock my agent from my phone says the owner can look back at an agent's decisions until its pager is deleted or it has been idle 30 days.
   - In each, an answer the service stored before the agent finished stays the answer, and the agent can still collect and acknowledge it (B25.13).
   - Why ★: a closed decision is done, like an answered one, and the open list keeps holding only what the owner can act on.
3. **An off pager's agents and the 30-day clock.** The service forgets an agent 30 days after its last activity, whether or not its pager is on, and the phone shows only what the service lists. So a pager off for more than 30 days comes back with none of its agents or decisions. B22.4 says that while a pager is off the phone keeps everything, as PRODUCT.md › A pager is on until I turn it off does, and I17.6 says an agent idle for 30 days is forgotten. Two lines disagree there, so Sam chooses (METHOD › Rules of thumb):
   - (a) ★ The clock runs only while the pager is on: an agent is forgotten 30 days after its last activity or its pager last turning on, whichever is later. B22.4 holds however long a pager stays off. I17.6 and TERMS › Agent change to say so.
   - (b) The clock runs while the pager is off, as today. PRODUCT.md and B22.4 change to say the phone keeps an off pager's decisions for up to 30 days.
   - Not offered: the phone keeps its own copy of what the service forgot. That is a new feature, and the phone couldn't fetch those decisions' attachments.
   - Why ★: turning a pager off is the owner's pause, and coming back to an empty pager breaks what Sam approved. The cost is that an abandoned off pager keeps its encrypted decisions on the service until the owner deletes it.
4. **Clients from M5, through TIDY's release.** The release deploys the service, then the command on Sam's machines, then the app (AGENTS.md › Stages). METHOD says a client from the previous release keeps working or is told plainly to update, and the `m5` app can't be told plainly: on any refusal it says only that it can't reach the server.
   - (a) ★ Both keep working: the service keeps M5's routes and replies, and adds only what the `m5` command and app ignore. Until it is updated, the `m5` app shows a decision that finishing closed as still open, and Send on it is refused, so it shows as open again; the `m5` command shows the service's own words for it. No exception.
   - (b) Both must update: the service refuses `m5` clients. The command is told how to update (B25.14). The app says only that it can't reach the server until Sam's phone has the new build, a release exception, as M5's question 8 was. Sam's agents' waits end at the deploy, until their binaries are replaced. Less code.
   - Not offered: keep the command working and require the new app. The phone would still need (b)'s exception, and the closed state can be added without breaking the `m5` app.
   - Why ★: nothing breaks between the service deploy and the client builds, and with 1(a) Sam's agents carry on without connecting again.
5. **PRODUCT.md › Stack** names the service's storage, one Durable Object for the pagers and one per agent, which TIDY changes. Only Sam changes PRODUCT.md.
   - (a) The sentence names the new shape: one Durable Object per pager, holding its agents and their decisions.
   - (b) ★ The sentence keeps where the service runs, a Cloudflare Worker at agentpager.me, and drops how it stores things, which the code holds; 6 Privacy's header says it as built.
   - Not offered: leave it as it is. It would contradict the code, and PRODUCT.md outranks the code (METHOD › Rules of thumb), so the code would read as wrong.
   - Why ★: METHOD keeps structure in code, and the layout would go stale again at the next change. What Sam relies on, that turning a pager off stops everything at once, is I17's.
6. **TIDY's walk.** Sam released M5 without its walk on dev, and said Sam would dogfood at TIDY ([M5-encrypt.md](M5-encrypt.md) › Log, 7 Nov).
   - (a) ★ No walk on dev: once TIDY is green on dev, its upgrade check included, and reviewed, the root releases it, and Sam dogfoods it on prod. Fixes follow as `m6.<k>`.
   - (b) Sam walks it on dev first, on HomePhoneLite, then the release.
   - Why ★: it is how Sam chose to work on 7 Nov, and the upgrade check proves the move on dev, against the `m5` baseline, before prod has it.

## Slice

| Layer | What M6 delivers there |
| --- | --- |
| Blueprint | this doc; Sam's answers; the approved lines in their areas with the code that makes them true; L10 retired; PRODUCT.md › Stack as Sam chooses (question 5) |
| Service | one store per pager, holding its row, its agents and their decisions, so turning a pager off and every call on it happen one after the other (L10); what M5 stored moved into it (question 1); the phone's read of a pager served by that one store; a waiting agent's read ended by what it waits for, its answer, its decision closing or its pager turning off or going, instead of a check every 100 ms; finishing closes the agent's open decisions; the 30-day clock as question 3 chooses; M5's routes and replies kept (question 4) |
| Command | its words for a decision that closed unanswered, in wait, status, history and finish; the history file's trim takes a lock, a small fix found in planning (What's known) |
| Phone app | a decision that finishing closed, shown as question 2 chooses; nothing else changes on screen |
| Tests | tests named by the ids M6 adds and touches, I17.2 among them with a call that lands as the pager turns off; a local upgrade test from `m5`'s service to TIDY's on the same storage |
| Dev stage | the upgrade check against the `m5` baseline in `pnpm smoke:dev`, in place of M5's against `m4`, run before 8 Dec 2026; the `m6` baseline recorded at the release |

**One new kind of complexity:** moving stored data from one store to another, once. The wake and the closed state are changes of kinds the product already has: a wait held inside one store, and one more state for a decision, with words for it on each side. In this order they stay that way: the move first, alone, with nothing on the wire changed; then the wake, inside the new store; then the lifecycle, through every layer. The pull requests, in order, are in [.agents/plans/2026-11-07-m6-tidy.md](../../.agents/plans/2026-11-07-m6-tidy.md).

## Out of scope

- Waking an agent's own app when its answer arrives. That is L11, for CLIENTS. TIDY's wake is the service's: the wait the command already holds returns sooner and costs less.
- How often the phone reads, and pushing changes to it while it is open (K1, measured at FRIENDS). The phone still reads each pager every 3 seconds, with one store behind each read.
- Removing the old stores and what they hold: they stay, unused, until a release after TIDY's has proven the move on prod.
- New features for owners: the milestone changes how the service keeps and reads a pager, and what finishing does to open decisions.

## What's known

Verified on 7 Nov 2026 against `main` at 464d559, the `m5` tag, which dev and prod both run (`X-AgentPager-Build`). Assumptions are marked.

- **Today's stores** (`packages/app/src/worker.ts`, `registry.ts`, `agent.ts`; `packages/app/scripts/build.mjs`, `deploy.mjs`):
  - One Registry holds every pager's row (its public key, its phone key's digest, its switch, auto-off and alert target) and which agents connected to it.
  - One store per agent holds that agent (its who-asked, key digests, and when it finished and was last active) and its decisions, attachments, answers and acknowledgements, with when each answer is due its warning, was collected and was warned about. Its decisions, attachments, answers and acknowledgements are written once and never changed.
  - The service's storage classes came with migrations `v1` to `v3`; a new class needs `v4`, and the deploy checks each class and binding by name.
  - After ENCRYPT, the service stores only encrypted parts and what it needs to route them, so the move is of ciphertext and routing data.
- **L10's window** (`agent.ts` › `on`, `handle`): each call that sends something asks the Registry whether its pager is on, then writes in its own store. The owner's off can land in the Registry between the two. Asking, waiting, acknowledging, finishing and the phone's answer each have the window; connecting doesn't, since the Registry checks the switch and records the agent in one step.
- **The phone's poll** (`AppModel.swift` › `pollLoop`, `refreshAll`; `worker.ts`, the pager read): while open, the app reads each of its pagers every 3 seconds. Each read asks the Registry for the pager, then every agent on it for all its decisions, open and answered, each with its whole card.
- **The agent's wait** (`agent.ts` › `handle`, read; `packages/contract/exchange.ts` › `ANSWER_WAIT_MAX_SECONDS`): one read holds up to 50 seconds and checks storage every 100 ms. It checks the pager is on when it starts and when the answer comes, not between. The command's wait with no end asks again after each, and ends on a refusal (`packages/cli/src/commands.ts` › `wait`).
- **The wake has no effect an owner sees:** the 100 ms loop already meets PRODUCT.md's bar, the answer within a second of the Undo window closing. Waking cuts what the service does while a wait holds, so it isn't a question.
- **Finish today** (`agent.ts`, finish and answer; `DecisionView.swift`): it stops new asks, and the phone can still answer the agent's open decisions, though nothing will collect them; the phone marks who asked as finished. Finishing while the pager is off is refused (I17.2).
- **Forgotten** (`agent.ts` › `alarm`; `packages/app/src/contract.ts` › `AGENT_IDLE_MS`, `unknownAgent`): 30 days after an agent's last activity, whatever its pager's state, its store forgets everything and the Registry stops listing it. The phone shows only what the service lists (`AppModel.swift` › `apply`), so the agent and its decisions go from the phone at its next read (question 3). The agent's file and history stay on its machine, and its next call is told it was forgotten.
- **Deleted with its pager** (`registry.ts`, delete and `erase`): the Registry deletes the pager's row and queues its agents to forget, tried at once and then every minute until done; until then an agent finds its pager gone at its next call. The phone drops the pager with its keys, the keys its agents first named and its kept answers (`AppModel.swift` › `drop`). Agents' files stay on their machines (L15).
- PRODUCT.md, I17.5, I17.6 and B31 already say what forgotten and deleted mean for the phone and the history, so neither is a question beyond question 3.
- **The `m5` clients** (question 4):
  - The app reads a pager's decisions with a fixed list of states (`API.swift` › `SealedStatus`), so a state it doesn't know fails the whole read; it ignores fields it doesn't know. On any refusal it says only that it can't reach the server, and only a refusal saying the pager is gone drops it (`AppModel.swift` › `apply`).
  - The command ignores fields it doesn't know (`packages/cli/src/client.ts`), prints any refusal's own words, and its wait with no end stops at one (`commands.ts`).
- **The history** (`packages/cli/src/store.ts`): already one file per pager on each machine, which every agent on that pager appends to. Past 1,000 lines the command rewrites it without the lock the agent's file takes, so two agents on one machine can lose a line then.
- **The `m5` baseline,** recorded on dev at the release (`~/.agentpager-baselines/dev/m5/`, by the `m5` binary): a pager with no alert target, one agent, one decision answered, collected and acknowledged with a PNG and a page, and one open. `baseline.mjs --verify` reads it back and changes nothing. Its agent is forgotten if idle after 8 Dec 2026.
  - `pnpm smoke:dev` still checks M5's exception against the `m4` baseline (`smoke.mjs`), and leaves a finished agent on that baseline's pager each run. A check against `m5` can't, since `--verify` expects one agent.
- **Assumed:**
  - A Durable Object can't read another's storage, so the move copies each pager's row from the Registry and each agent's rows from its store, through calls between them.
  - One pager's store holds all of its agents' decisions: a SQLite-backed Durable Object holds up to 10 GB.
  - Once a pager's switch and the calls on it are in one store, a transaction there can't interleave with another call, so the two can't race. The store's pull request tests it.
  - A wait held in memory goes when its store restarts, and the command asks again, so a missed wake costs at most one wait's time.

## Proposed lines

For Sam's approval, in the areas' grammar. None is in an area yet: each reaches its area with the code that makes it true, and its tests name its id.

**B25.13, changed** (2 Agents), whatever question 2 chooses
13. An agent that finishes shows as finished on the phone and can ask nothing more. Its open decisions close unanswered and can't be answered. It can still wait for and acknowledge the answers already sent, and finishing again changes nothing.

**B32, a clause added** (2 Agents)
11. @M6: A wait for a decision that closed unanswered ends, telling the agent so. A wait with no end stops too.

**B5, a clause added** (5 Answering), with question 2's (a)
17. @M6: A decision that closed unanswered, because its agent finished, offers nothing to pick or send, and says that who asked finished before it was answered. It shows with its project's answered decisions, and its brief stays readable.
- With (b), its second sentence reads: It stays among its project's open decisions, after the ones the owner can answer, and its brief stays readable.

**I17.6, changed** (1 Pagers), with question 3's (a)
6. An agent is forgotten the same way, and its pager stops listing it, 30 days after its last activity or its pager last turning on, whichever is later, and never while its pager is off. Activity is asking, the owner's answer, acknowledging and finishing; waiting for an answer is not.
- With (b), I17.6 stays, and B22.4's first sentence reads: While a pager is off, the phone keeps everything for up to 30 days, and its decisions stay readable.

**I17's notes** (1 Pagers): the note that a call the service has already checked can still land (L10) goes; I17.2 then holds as written.

**TERMS, changed**
- Decision: One question from an agent, with the owner's answer and the agent's acknowledgement. The app calls it a decision. It is open until the owner answers it; if its agent finishes first, it closes unanswered and can't be answered.
- Agent, with question 3's (a): its last sentence reads: It lasts until its pager is deleted, and is forgotten after 30 days with no activity while its pager is on.

**Retires,** once built: L10, turning a pager off can let one call through (1 Pagers).

**Dropped by the line test:**
- That the phone reads one store per pager, and that a wait is woken rather than checking storage: mechanism the code shows. PRODUCT.md already sets the wait's bar.
- That the move keeps every agent and decision: METHOD's release rule, which the upgrade check proves, as M5's was for its exception. I24 already says a restart loses nothing.
- That an answer sent in the Undo window after the agent finished is refused: B5.14 shows what the service holds, and B25.13 says a closed decision can't be answered.
- That an answer stored before the agent finished stays the answer: B25.13 says the agent can still wait for and acknowledge it.

## Adds · Changes · Retires

- **Adds,** once approved and built: B32.11 and B5.17. One store per pager, with what M5 stored moved into it (question 1). The upgrade check against the `m5` baseline on dev, and the `m6` baseline at the release.
- **Changes:** B25.13 and TERMS › Decision, for what finishing does to open decisions; I17.6 and TERMS › Agent with question 3's (a), or PRODUCT.md and B22.4 with (b); I17's notes, which lose L10's; PRODUCT.md › Stack, as Sam chooses (question 5); the headers of 1 Pagers, 2 Agents and 6 Privacy, which name the stores, as built.
- **Retires:** L10, turning a pager off can let one call through (1 Pagers). Its id is never reused.

## Log

- 6 Nov · queued: Sam split three of ENCRYPT's hardening items into this milestone, to run right after ENCRYPT and before CLIENTS.
- 6 Nov · Sam chose its word on the pager, TIDY over the proposed STORE ([M5-encrypt.md](M5-encrypt.md), question 7).
- 7 Nov · planning: M5 released, and TIDY started as M6. PR #68 moves this doc out of `next/`, asks Sam's six questions, proposes the lines, marks M5 released and adds the plan, `.agents/plans/2026-11-07-m6-tidy.md`. `pnpm check` green (154 clauses, 25 tested), `pnpm test:all` 629 passed (556, 3, 8, Swift 17, 32 and 13).
