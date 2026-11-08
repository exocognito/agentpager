# Handoff to the next root session (8 Nov 2026, M6 TIDY released)

Read `AGENTS.md`, then `blueprint/README.md`. This file covers only what those two files don't. Claims are marked [V] verified or [A] assumed; each [V] was checked on 8 Nov 2026, when this was brought up to date, by the root at the release or by the pull request that brought it up to date (#79).

## Where things stand

- **The root** is session 9c483b84, a Claude Code session on pro [V]. On 6 Nov it was in Herdr pane w1:pK and paged Sam as agentpager agent ap-9tbn; on 7 Nov it connected again to Sam's real pager on prod with the `m5` binary (`blueprint/milestones/M5-encrypt.md` › Log), so its agent's id may have changed since [A]. The previous root, session 86f845ec, stepped back on 6 Nov and no longer merges, deploys or touches the repo.
- **8 Nov: M6 TIDY is released, and CLIENTS is next.** No walk on dev, as Sam chose (question 6): Sam dogfoods M6 on prod, and fixes follow as `m6.<k>`. The tag `m6` is annotated (tag object 7e2211a), pushed, on c9cc3c3, #78's merge. M6's pull requests merged in this order: #68, #69, #70, #71, #72, #74, #75, #73, #76, #77 and #78; #79 records the release (`blueprint/milestones/M6-tidy.md` › Log). The root's plan is `.agents/plans/2026-11-07-m6-tidy.md`. [V]
- **M5 ENCRYPT is shipped:** released on 7 Nov without its walk, at Sam's word (`blueprint/milestones/M5-encrypt.md`). **M4 HOUSE is shipped** too (`blueprint/milestones/M4-house.md`); its ledger is kept at tag `m4-house-ledger`. [V]
- **dev** (https://dev.agentpager.me) runs c9cc3c3, by its `X-AgentPager-Build` header, where `pnpm smoke:dev` passed 10 of 10, its upgrade check reading the `m5` baseline. Once #79 merges, the upgrade check reads the `m6` baseline instead, and the root runs `pnpm smoke:dev` again. [V]
- **prod** (agentpager.me) runs the `m6` release, c9cc3c3, by its header. `pnpm deploy:prod` ran from the clean worktree `m6-release` at the tag, and `pnpm smoke:prod` passed 9 of 9, 0 failed. Sam's real pager has moved into its own store: after the deploy, the `m5` command (464d559), as the root's agent there, read its status, the pager on with 0 open, and the `m6` binary then read the same. [V]
- **Binaries:** the ones on air, mini and pro are c9cc3c3, built at `m6`, each copied and then moved over the old one. [V by `agentpager version` on each at the release; on pro again by #79]
- **Phones:**
  - Sam's iPhone Air: the app built at `m6` is ready but not installed, since the phone was unreachable at the release. It is a Debug build for any iOS device, with agentpager.me as its default server and the alert extension, bundle `me.agentpager.app.dev`, as M5's, in this root's temp folder: `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9c483b84-af30-4404-8405-a682adc7cdf1/scratchpad/m6/iphone-m6-build/Build/Products/Debug-iphoneos/AgentPager.app`. [V] Until it is installed, the phone has the `m5` app, last installed there at M5's release, which works with M6 (question 4). [A]
  - HomePhoneLite, the dev phone, was disconnected when `pnpm phone:dev` ran at c473367, so it still has an older app from `main` [V]; which one isn't recorded here [A].

## What Sam does next

1. **Dogfood M6 on prod,** with the `m6` binary on air, mini and pro, and on the iPhone Air once it has the `m6` app. Fixes follow as `m6.<k>`, each from a tag that was green on dev (AGENTS.md › Stages).
2. **Connect the phones:** the iPhone Air, reachable and unlocked, so the root can install the `m6` app with `devicectl`; and HomePhoneLite, so the root can run `pnpm phone:dev` on it.
3. **Hear what M6 carries forward,** which the root reports to Sam (`M6-tidy.md` › Not solved, carried forward, and Things you inherit, below). One waits for Sam: PRODUCT.md, Sam's file, still says an agent idle 30 days is forgotten, without saying that only time while its pager is on counts (I17.6).
4. **Answer CLIENTS's questions** once its plan pull request asks them. CLIENTS is next (`blueprint/milestones/next/CLIENTS.md`): which agent apps AgentPager supports, judged on whether an idle agent can be woken when its answer arrives. Its plan numbers it and asks Sam only the questions that matter where Sam might not take the recommendation (METHOD.md › Sessions).

## The upgrade baselines

- All three are on pro in `~/.agentpager-baselines/dev/`, outside every worktree. They hold keys and pager numbers, so nothing prints them. [V]
- `m4`: format 1, from before the encryption switch. Nothing reads it: M5's switch deleted its agent, and its pager stays. [V, #58 and #63]
- `m5`: recorded at M5's release by the `m5` binary. It proved M6's move on dev: after each merge from #72 on, `pnpm smoke:dev` read it back unchanged from the moved store. Once #79 merges, nothing reads it. Its agent is forgotten if idle after 8 Dec 2026. [V]
- `m6`: recorded on 8 Nov by the `m6` binary (c9cc3c3). `--verify` passed at the release and again from #79's worktree: the pager on, with the key its number names; one open decision; one acknowledged decision with its answer; both attachments; and the `m6` copy's status for its agent. `pnpm smoke:dev` reads it from #79 on, only reading. [V]
- **The deadline:** the `m6` baseline's agent is forgotten if idle after 2026-12-08T08:33Z [V]. So the next milestone's upgrade check, `pnpm smoke:dev` with its code on dev, must run before 8 Dec 2026. After that the agent is gone, and the check fails until it moves to a newer baseline (`packages/app/README.md` › Upgrade baseline).

## Things you inherit

- **Reviews on pro:** [V]
  - Grok, through Sam's xAI subscription login: `env -u XAI_API_KEY pi --model xai/grok-latest --thinking high` in print mode, `--thinking low` for a sanity check, with no `op run`. Sam disabled the old xAI API key on purpose on 6 Nov.
  - Codex, via `codex exec -m gpt-6.1-sol --sandbox read-only` with its stored login; never accept its prompt to trust the primary clone.
  - DeepSeek over Fireworks is Sam's fallback when Grok is unavailable, and has no key on pro.
- **Renders:** `pnpm designs` runs on pro, with Xcode 27.2 and the iPhone 17e Simulator on iOS 27.2 [V]. Its fingerprint hashes every byte of its sources, so a comment change in one needs a re-render too [V, `designs.mjs`]. Agents run Simulators one at a time, under `lockf -k ~/Projects/agentpager-worktrees/.simulator.lock`; never delete the lock file.
- **Carried forward from M6** (`M6-tidy.md` › Not solved, carried forward), none of them a line or a limit yet: [V]
  - an `m5` command still running, such as an MCP server started before the update, appends to the history without the lock until it restarts;
  - the command reads the history without the lock, so it can catch a half-written last line;
  - a wait whose client has gone away still runs to its time and collects an answer that comes meanwhile, so the owner's warning that no agent picked it up never comes;
  - no rollback once a stage runs M6: prod fixes forward, as `m6.<k>`;
  - PRODUCT.md's two sections on the 30-day clock, which wait for Sam (What Sam does next, 3).
- **The old stores** stay on both stages, unused, until a release after TIDY's has proven the move on prod; what a pager's store deletes or forgets, it erases from them too (`M6-tidy.md` › Out of scope). [V]
- **Known leftovers** from M4 (question 10):
  - the id check's "Known limits" at the top of `scripts/blueprint.mjs`;
  - `DECISIONS.md` still names the retired limit L20.
- **The primary clone** sits on `main` at cfb78c0, behind `origin/main`, with a change to `blueprint/areas/5-answering.md` and an untracked `review.txt` [V]; whose they are isn't recorded here [A]. No agent works in it; leave both as they are.
- **In progress when this was written:** the worktree `m6-history-read`, on branch `m6/history-read`, whose draft pull request #80 is an `m6.1` fix to how the command reads its history [V]. It isn't on the list below.

## For Sam to approve trashing

Nothing is trashed until Sam approves the exact command. Everything below awaits that approval. Every worktree below is clean, and its branch or head is on `main`, except `m6-released`'s until its pull request merges. [V]

- **Worktrees** in `~/Projects/agentpager-worktrees/`:
  - M5's merged pull requests, with their local branches: `m5-plan` (#57), `m5-baseline` (#58), `m5-answers` (#60), `m5-hardening` (#59), `m5-envelope` (#61), `m5-extension` (#62), `m5-switch` (#63), `m5-wrapup` (#64), `m5-walk` (#65) and `m5-keep` (#67). Their branches are still on GitHub too.
  - Review copies, done: `m5-envelope-review` (26271ec) and `m5-switch-review` (0bef035).
  - Builds at `m4`, done: `m5-baseline-m4` and `m5-hardening-m4`, detached at 9849671. The `m4` baseline keeps its own copy of the binary.
  - `m5-switch-before`, detached at 5f5fd4d, the `m4`-era server for the local upgrade check: done.
  - `m5-release`, detached at 464d559, from which the root deployed prod at `m5`: done.
  - `m5-deploy`, detached at c9cc3c3, from which the root deploys dev: done once the root stops using it, since each deploy can start from a fresh one [A].
  - `m5-root-phone`, detached at 7a7a16d, the root's phone build [A]: done.
  - M6's merged pull requests, with their local branches: `m6-plan` (#68), `m6-upgrade` (#69), `m6-answers` (#70), `m6-history-lock` (#71), `m6-store` (#72), `m6-closed` (#73), `m6-deploy-check` (#74), `m6-wake` (#75), `m6-clock` (#76), `m6-finish` (#77) and `m6-wrapup` (#78). Their branches are still on GitHub too.
  - `m6-release`, detached at c9cc3c3, from which the root deployed prod at `m6`: done.
  - `m6-released` (#79, which brought this file up to date): once it merges.
- **Temp folders:**
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9c483b84-af30-4404-8405-a682adc7cdf1/`, this root's, 8.7 GB: logs, review briefs, build output, and test baselines whose keys are for local servers only. It holds the `m6` app for the iPhone Air (Where things stand), so not before that is installed, or built again from the tag.
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/86f845ec-30ed-4f3f-8a1b-48f4067f3344/`, the previous root's, 5.2 GB.
  - `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/73b382d5-966c-4273-83a1-29b5ba84ea15/` (636 KB) and `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager/9896b490-6d8f-4eca-85ec-86cb7768a7dc/` (empty), from other sessions.
  - `/private/tmp/claude-501/claude-501/`, which holds only empty folders.
  - `/private/tmp/claude-501/ap-*.log`, eleven logs from the morning of 6 Nov, before M5 [A: the `m4` release's].
