# AgentPager root handoff (10 Nov 2026, M7 CLIENTS released)

Read `AGENTS.md`, then `METHOD.md` and the Blueprint starting at `blueprint/README.md`. Claims are marked [V] verified or [A] assumed. For current work and its owners, see [AGENTS.md › The board](../../AGENTS.md#the-board).

## Where things stand

- **The root** is the Codex desktop chat on pro (session `01a1c6c0-7d86-7212-be85-e35f69484a5f`), which took over AgentPager and its Todoist board on 10 Nov. The prior root, Claude Code’s `M7 CLIENTS milestone root` (session `c1366f05` on pro), led M7 to release and handed over its follow-ups. `AgentPager Clients/Ship Design` (session `ced0885f`) led M7 until 9 Nov. The M6 root (session `9c483b84`) finished its follow-ups and approved cleanup. [V, 10 Nov, by the session handoff and prior trackers]
- **8 Nov: M6 TIDY is released, and M7 CLIENTS started the same day,** led then by `AgentPager Clients/Ship Design` (above), with its plan, `.agents/plans/2026-11-08-m7-clients.md`. No walk on dev, as Sam chose (question 6): Sam dogfoods M6 on prod, and fixes follow as `m6.<k>`. The tag `m6` is annotated (tag object 7e2211a), pushed, on c9cc3c3, #78's merge. M6's pull requests merged in this order: #68, #69, #70, #71, #72, #74, #75, #73, #76, #77 and #78; #79 records the release, and #81 the release's last check (`blueprint/milestones/M6-tidy.md` › Log). M6's plan is `.agents/plans/2026-11-07-m6-tidy.md`. [V]
- **9 Nov: M7 CLIENTS is released,** with no walk on dev, as Sam chose on the pager that day: pro first, then mini and air (`blueprint/milestones/M7-clients.md` › Log) [A, 10 Nov: Sam's two pager answers, by the root's tracker]. The tag `m7` is annotated (tag object bf77f6c), pushed, on 5511193, #93's merge [V, 10 Nov]. M7's pull requests merged in this order: #82, #83, #84, #85, #88, #86, #89, #91, #92, #94 and #93, with #90, the board, between #86 and #89; #95 records the release [V, 10 Nov]. INSTALL is next, still queued (`blueprint/milestones/next/INSTALL.md`).
- **`m6.1` is released:** an annotated tag (tag object 1f0a685), pushed, on 9fbb490, #79's merge, which was green on dev. It adds #80, merged as 076caf0: the command's history skips a line that doesn't decode, where one half-written line made the whole history read as empty, and an append after such a line starts on a fresh line (`packages/cli/src/store.ts`). It changes only the command, with no change to the service, the contract or the app since `m6` (`M6-tidy.md` › Log). [V]
- **M5 ENCRYPT is shipped:** released on 7 Nov without its walk, at Sam's word (`blueprint/milestones/M5-encrypt.md`). **M4 HOUSE is shipped** too (`blueprint/milestones/M4-house.md`); its ledger is kept at tag `m4-house-ledger`. [V]
- **dev** (https://dev.agentpager.me) last verified on 10 Nov at b560d75, the merge of [#96](https://github.com/exocognito/agentpager/pull/96), by its `X-AgentPager-Build` header. `pnpm smoke:dev` passed 10 of 10 with 0 retries, including the upgrade check against the `m7` baseline, now the default. M7’s release at 5511193 previously passed the same smoke suite against `m6`. [V, 10 Nov, by the prior root’s smoke logs]
- **prod** (agentpager.me) runs `m7`, 5511193, by its header [V, 10 Nov]. `pnpm deploy:prod` ran from the clean worktree `m7-release` at the tag, and `pnpm smoke:prod` passed 9 of 9, 0 on retry [V, 10 Nov, by the root's release logs]. Before that it ran `m6.1`, 9fbb490: `pnpm deploy:prod` ran at `m6`, from the clean worktree `m6-release` at the tag, and again at `m6.1`, and each time `pnpm smoke:prod` passed 9 of 9, 0 failed. Sam's real pager has moved into its own store: after the deploy, the `m5` command (464d559), as the root's agent there, read its status, the pager on with 0 open, and the `m6` binary then read the same. [V]
- **Binaries:** pro, mini and air run the same `m7` build, 5511193. `agentpager setup` ran on all three. On air on 10 Nov, Sam chose to update pi first. It went from 0.99.1 to 1.4.0, then setup installed the Claude Code plugin and pi extension. A second run changed nothing. Restart Claude Code and pi on air to load them. [V, 10 Nov, by the setup logs and the completed [Air card](https://app.todoist.com/app/task/6hxQq9WrqrXJcmwh)]
- **Phones:**
  - Sam's iPhone Air has the app built at `m6`, installed over M5's when the phone came within reach at 06:14 on 8 Nov. The root's agent on prod then sent Sam a card with the `m6.1` binary, and Sam answered it on the phone (`M6-tidy.md` › Log). [V] `m6.1` changed nothing in the app, and M7 shipped no app build: between `m6.1` and `m7`, `packages/ios` differs by one caption in a UI test and one sentence of its README [V, 10 Nov].
  - HomePhoneLite, the dev phone, was disconnected when `pnpm phone:dev` ran at c473367, so it still has an older app from `main` [V]; which one isn't recorded here [A].

## What Sam does next

1. **Use M7 on prod,** with the `m7` binary on pro, mini and air and the `m6` app on the iPhone Air. Codex's wake wasn't run as installed at the release, so Sam's next question from Codex is its first run that way; on pro, Codex asks before every AgentPager tool call, which stops a woken thread until a person allows it (`M7-clients.md` › Log) [V, 10 Nov, by the root's wake results]. Fixes follow as `m7.<k>`, each from a tag that was green on dev (AGENTS.md › Stages).
2. **Connect HomePhoneLite,** so the root can run `pnpm phone:dev` on it.
3. **Hear what M6 carries forward,** which the root reports to Sam (`M6-tidy.md` › Not solved, carried forward, and Things you inherit, below). PRODUCT.md's two sentences on the 30 days no longer wait for Sam: Sam chose option A on the phone on 8 Nov, and #81 made them say the 30 days count only while the agent's pager is on, as I17.6 does.
4. **Answer what M7's before-release read brought for Sam:** the wording changes that only Sam makes, which wait for Sam and go in a later pull request, and the root's calls listed for Sam to overturn (`M7-clients.md` › Log, 10 Nov) [V, 10 Nov, by #93's triage and the root's tracker].
5. **Give the go to start INSTALL.** It is queued in the [Blueprint](../../blueprint/milestones/next/INSTALL.md) and [on the board](https://app.todoist.com/app/task/6hxHRQVqXq79MRMh). Its plan will number it and bring Sam the open decisions. The dev deadline is under The upgrade baselines. [V, 10 Nov, by the board and session handoff]

## M7 handoff notes

- The outstanding M7 checks and wording review are on the board. Test Claude Desktop and Codex wakes with a local server and a dedicated test home where the client can pass it through. The installed Codex MCP entry on pro did not pass through `AGENTPAGER_HOME`. Track the real installed wake separately from Codex’s approval prompt. Claude Code’s sign-in on pro is expected to expire between 14 and 17 Nov [A, by the prior root’s tracker].
- Sam owns the dotfiles settings edits from setup on pro, mini and air, and decides whether Claude Desktop on pro keeps the restored `agentpager` MCP entry. [V, 10 Nov, by the session handoff]
- The pre-release read found a small code follow-up. Card prose rejects HTML inside inline code even though the brief contract allows it. See the [review triage](https://github.com/exocognito/agentpager/pull/93#issuecomment-6759057398) and the [wording card](https://app.todoist.com/app/task/6hxMWVqc69q7xV8h). [V, 10 Nov, by the prior root’s review]
- The prior root’s local evidence is under its Claude Code M7 scratchpad on pro. `state.md` is the tracker, `smoke-dev-96.log` records the dev check, and `release/air/air-update.log` and `release/wakes/RESULTS.md` record the client checks. These files are temporary. [V, 10 Nov, by inspection]

## The upgrade baselines

- All four are on pro in `~/.agentpager-baselines/dev/`, outside every worktree. They hold keys and pager numbers, so nothing prints them. [V]
- `m4`: format 1, from before the encryption switch. Nothing reads it: M5's switch deleted its agent, and its pager stays. [V, #58 and #63]
- `m5`: recorded at M5's release by the `m5` binary. It proved M6's move on dev: after each merge from #72 on, `pnpm smoke:dev` read it back unchanged from the moved store. Since #79, nothing reads it. Its agent is forgotten if idle after 8 Dec 2026. [V]
- `m6`: recorded on 8 Nov by the `m6` binary (c9cc3c3). `--verify` passed at the release and again from #79's worktree: the pager on, with the key its number names; one open decision; one acknowledged decision with its answer; both attachments; and the `m6` copy's status for its agent. `pnpm smoke:dev` read it from #79 until #96, only reading: M7's upgrade checks. From #96 on, nothing reads it. Its agent is forgotten if idle after 2026-12-08T08:33Z. [V; from #96 on, 10 Nov, `packages/app/scripts/smoke.mjs`]
- `m7`: recorded on 9 Nov by the `m7` binary (5511193), which read it back as recorded: the pager on, with the key its number names; one open decision; one acknowledged decision with its answer; both attachments; and its own status for its agent. `pnpm smoke:dev` reads it from #96 on, only reading, as the last release's (`packages/app/README.md` › Upgrade baseline). Before #96, on dev at fc49860, `pnpm smoke:dev --baseline-tag m7` passed 10 of 10, 0 on retry, reading it back as recorded. [V, 10 Nov, by the root's baseline log and its smoke log]
- **The deadline:** the `m7` baseline's agent is forgotten if idle after 2026-12-10T05:15Z [V, 10 Nov, by the root's baseline log and its smoke log]. So the next milestone's upgrade check, `pnpm smoke:dev` with its code on dev, must run before then. After that the agent is gone, and the check fails until it moves to a newer baseline, a change to `smoke.mjs` as #79's and #96's were (`packages/app/README.md` › Upgrade baseline).

## Things you inherit

- **Reviews on pro:** [V]
  - Grok, through Sam's xAI subscription login: `env -u XAI_API_KEY pi --model xai/grok-latest --thinking high` in print mode, `--thinking low` for a sanity check, with no `op run`. Sam disabled the old xAI API key on purpose on 6 Nov.
  - Codex, via `codex exec -m gpt-6.1-sol --sandbox read-only` with its stored login; never accept its prompt to trust the primary clone.
  - DeepSeek over Fireworks is Sam's fallback when Grok is unavailable, and has no key on pro.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`]. Agents run Simulators one at a time, under `lockf -k ~/Projects/agentpager-worktrees/.simulator.lock`; never delete the lock file.
- **Carried forward from M6** (`M6-tidy.md` › Not solved, carried forward), none of them a line or a limit yet, but for the third, which M7 fixed: [V]
  - an `m5` command still running, such as an MCP server started before the update, appends to the history without the lock until it restarts;
  - the command reads the history without the lock, so it can catch a half-written last line; from `m6.1` (#80) it skips that line, where the whole history read as empty;
  - a wait whose client had gone away still collected an answer that came meanwhile, so the owner's warning that no agent picked it up never came: M7 fixed it in #85, as B32.12, which dev and prod both run since `m7` [V, 10 Nov]; a command from before M7 still picks an answer up by reading it (the note under B32);
  - no rollback once a stage runs M6: prod fixes forward, as `m6.<k>`.
- **The old stores** stay on both stages, unused, until a release after TIDY's has proven the move on prod; what a pager's store deletes or forgets, it erases from them too (`M6-tidy.md` › Out of scope). [V]
- **Known leftovers** from M4 (question 10):
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **The primary clone** sits on `main` at cfb78c0, behind `origin/main`, with a change to `blueprint/areas/5-answering.md` [V]; whose it is isn't recorded here [A]. No agent works in it; leave the change as it is. Its untracked `review.txt` went to the Trash with the M6 root's cleanup [V].

## For Sam to approve trashing

Nothing is trashed until Sam approves the exact command. [V]

- **Done on 8 Nov:** the M6 root's approved cleanup moved the 32 worktrees of M5's and M6's pull requests, releases, reviews and builds to the Trash, with the primary clone's `review.txt` and the tests' temp folders, and removed two lab Simulators. [V: the 32 worktrees are in the Trash, `review.txt` is gone from the primary clone, and neither Simulator is listed]
- **Worktrees:** `m5-deploy`, detached at `main`'s commit of the M6 root's last dev deploy, from which it deploys dev: done once it stops, since each deploy can start from a fresh one [A]. The M7 root deploys from its own, `m7-deploy`.
- **Local branches:** the 24 `m5/*` and `m6/*` branches of the pull requests whose worktrees went, each merged into `main` and still on GitHub. [V]
- **Temp folders:**
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9c483b84-af30-4404-8405-a682adc7cdf1/`, the M6 root's, 8.6 GB: logs, review briefs, build output, and test baselines whose keys are for local servers only. The `m6` app it holds is installed on the iPhone Air (Where things stand).
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/86f845ec-30ed-4f3f-8a1b-48f4067f3344/`, the previous root's, 5.2 GB.
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/73b382d5-966c-4273-83a1-29b5ba84ea15/` (636 KB) and `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9896b490-6d8f-4eca-85ec-86cb7768a7dc/` (empty), from other sessions.
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders.
  - `/private/tmp/claude-501/ap-*.log`, eleven logs from the morning of 6 Nov, before M5 [A: the `m4` release's].
