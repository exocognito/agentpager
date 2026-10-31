# Handoff to the root session

For a fresh Claude Code session that runs steps 2 to 5 of Sam's plan as the root (METHOD, Sessions). Read `METHOD.md`, `AGENTS.md` and `.agents/plans/2026-10-31-next-roadmap-orchestration.md` first. This file holds only what the repo doesn't say. Claims are marked verified or assumed.

## Sam's plan

Sam, in Claude Code on 31 Oct (verified): "1. Interrogate and propose a version of METHOD.md that combines the best of our Blueprint process and the atomic pages method - lets agree on this first 2. Then do 1-6 3. Then orchestrate the three parallel milestones 4. <Pause for major review and confirm I'm good> 5. Then continue with final two milestones."

Step 1 is done: Sam agreed `METHOD.md` (`DEC-2026-10-31-method`). "1-6" are the six changes from comparing the Blueprint with Atomic Pages:

1. Name every test after the promise it proves, and enforce it in `pnpm check`.
2. Keep the method in the repo: done, as `METHOD.md`.
3. One-line promises in a few files.
4. Caveats become `LIMITS.md`.
5. The Blueprint holds only what's built; "Not built yet" tags go.
6. A dev stage before MENCRYPT's switch-over.

Sam approved this order (verified): 3, 4 and 5 together as the format conversion, then 1, since it needs the final ids. 6 moves out of step 2 and becomes the MENCRYPT lead's first task.

## Before you start

- Sam merges PR #40 (the roadmap) and PR #41 (the method). They touch different files, so either order works (verified). Start from `main` with both.
- Step 2 isn't a milestone, so the go in METHOD (Merging) doesn't cover it yet. Ask Sam whether you merge step 2's pull requests or he does.

## Step 2: convert the Blueprint

- The conversion map is in `.agents/plans/2026-10-31-method.md`, under "Step 2, once agreed". `.agents/plans/2026-10-31-method-sample/` shows the target format for pagers, I17, limits, PRODUCT.md and MENCRYPT. It was checked against `main` at 3489430 (verified). Convert from the current files, not from the sample.
- Answer 4a says the strategy becomes principles "in Sam's words". Show Sam the principles in `PRODUCT.md` as one question before that pull request merges.
- Move documents, not code. `packages/blueprint/design/schemas/` is the wire contract that the service and the command import, and `pnpm designs` writes `design/screens/`. Moving either changes imports and scripts: leave them where they are and name their paths in AGENTS.md, unless the change is small (assumed).
- Suggested pull requests: the format conversion, with AGENTS.md rewritten for METHOD; then tests named by id, the id check in `pnpm check`, and its untested list. Both take a sanity check, since neither changes what the product does (assumed).
- Today no test names a promise: not the 16 server, 10 command and about 32 design and contract tests, nor the 25 iPhone tests (verified on 31 Oct). Expect the untested list to start long.
- If `METHOD.md` or AGENTS.md leaves you guessing, that's a gap in the method. Fix it in a pull request before step 3 and tell Sam. A fresh agent finishing step 2 from the repo alone is the test that the method stands on its own.

## Step 3: three milestones in parallel

- The shape is in the orchestration plan from PR #40. It predates METHOD; where they differ, METHOD wins. Its "orchestrator" is the root. `main` now deploys to dev, and prod only deploys a tag that was green on dev.
- MENCRYPT: Sam expects it to need "minimal input from me" (verified). Its lead builds the dev stage first. If that needs a Cloudflare permission, a DNS record or a credential that isn't in the vault, ask Sam. Never mint one.
- MSITE: Sam wants to "workshop that one quite a bit" (verified). Nothing gets built before the first round with him.
- MOPEN: send its "Sam decides first" questions during step 3, so step 5 isn't waiting on them.
- The review page that METHOD's walk step needs doesn't exist yet. Sam has seen a one-off page of the old Blueprint at https://claude.ai/artifact/YCfaftX4hmCb6dZLoFX8Ya, a snapshot of `main` at 3489430. Its generator is in a scratch folder that may not last, at `/private/tmp/claude-501/-Users-smcllns-Projects-agentpager-worktrees-v2-design/37866243-ba74-41ba-972f-d66de7d5edb7/scratchpad/blueprint-page/` (`build.mjs`, `page.css`, `page.js`). It reads the old format. Build the real one in the repo before step 4.

## Step 4: pause

Stop and wait for Sam to say he's happy. He reviews by:
- trying the three milestones on his phone;
- looking at the live site;
- reading the rebuilt Blueprint page.

Nothing from MOPEN goes public before then. Publishing the repository can't be undone.

## Things you inherit

- pro runs an older `agentpager` than air and mini, which run 1ee6c27. pro was asleep and unreachable over SSH on 31 Oct (verified). When it's awake, copy air's build over: from `/Users/smcllns/Projects/agentpager.worktrees/wake-claude-agents/packages/cli/dist/agentpager` to pro's `~/.agentpager/bin/agentpager.new`, then `mv` it into place. MINSTALL's install line replaces this chore.
- Worktrees from step 1: `agentpager.worktrees/next-roadmap` and `agentpager.worktrees/method` can go once their pull requests merge, and `wake-claude-agents` once pro is updated. Deleting needs Sam's approval of the exact `trash` command.
- Reviewers in Herdr. Wait about 3 seconds after splitting a pane before starting pi in it. Exit pi with ctrl+d, not ctrl+c. Stage files by path: `git add -A` once committed a reviewer's `.pi/` session log. PR #40 adds `.pi/` to `.gitignore`.
