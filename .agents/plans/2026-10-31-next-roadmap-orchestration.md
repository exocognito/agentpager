# Running the next roadmap with an orchestrator

How Sam works with one orchestrator agent that runs MENCRYPT, MINSTALL and MSITE in parallel, then MOPEN and MFRIENDS, and asks Sam only at design gates and walks. The roadmap and milestones are in `packages/blueprint/roadmap/`; the decision is `DEC-2026-10-31-next-roadmap`.

## Shape

- **One orchestrator**, a long-lived Claude Code session in Herdr with its own agentpager agent id. It owns the roadmap, starts and briefs the leads, sequences merges, deploys, and is the only agent that pages Sam about the roadmap as a whole.
- **One lead per milestone**, in its own worktree off `origin/main` and its own Herdr pane. A lead turns its milestone's "Sam decides first" list into one pager card, writes the promise changes, builds in PR-sized slices and runs `pr-adversarial-review` on each PR.
- **Reviewers** are started by each lead, as the skill says. MENCRYPT's PRs take the adversarial loop, since they cross the trust boundary and change stored data. Most MSITE PRs take a sanity check.

The Blueprint's own simple loop (builder and reviewer in a cleanroom VM) isn't used: AgentPager's recipe is retired with v2 (README), and this week's work ran as worktrees and PRs (verified).

## Where Sam comes in

| Milestone | Before building | During | At the end |
| --- | --- | --- | --- |
| MENCRYPT | One card: the two switch-over questions | Nothing expected | Walk on the phone |
| MINSTALL | One card: download host, machines, update path, demo agent | Sam's own App Store Connect steps: the TestFlight app, the Beta App Review submission. Agents never sign or hold Apple credentials (D6, D7) | Install from a TestFlight link and the one line, on a clean machine |
| MSITE | Workshop round 1: who it's for and what it must say | Round 2, structure; round 3, how it looks. Each round is published as real pages to look at on the phone, and Sam answers by comments or a card | Look at the live page |
| MOPEN | One card: licence, home, history, alerts for self-hosters, what goes | Reading the public repository before it goes public. Publishing can't be undone | Fork and self-host guide read-through |
| MFRIENDS | Who to invite, and how feedback comes back | Sam's own invitations | Sam's call on what changes next |

Each card carries the lead's recommendation, so a gate can be one tap. An answer the lead can't act on goes back to the orchestrator, not straight to Sam again.

## Rules that keep parallel work from colliding

- **Owners of shared files.** MENCRYPT owns the wire contract (`packages/blueprint/design/schemas/`), the Agent object's storage and the command's send path. MINSTALL owns the command's build and release scripts and the install endpoint. MSITE owns the front page (`MarketingScreen.tsx`, `marketing.css`) and `/start`'s words. A lead that needs another's file asks the orchestrator.
- **The iPhone project file.** MENCRYPT adds a notification service extension and an App Group, and MINSTALL changes signing and the push environment. Both edit `project.pbxproj`, so the orchestrator merges one, then has the other rebase.
- **The switch-over waits for the update path.** MENCRYPT's refusal of commands from before encryption ships only once MINSTALL's install line can update them.
- **One Simulator run at a time.** `pnpm designs` takes the iPhone 17e Simulator for about 12 minutes and rewrites the catalogue, so the orchestrator runs it for one PR at a time (verified: 12 min on the last run).
- **Only the orchestrator deploys**, from `main` after a merge, the service before the binaries (D1).
- **MOPEN's cleanup starts after MENCRYPT merges.** Its decisions and a secrets audit can start at once.

## Keeping Sam informed

The orchestrator pages Sam only for gates and walks. For everything else, Sam can read the Blueprint page, regenerated from `main` after each merge (assumed: needs `pnpm blueprint:page`, not built yet).

## To start

1. Sam merges the roadmap PR.
2. The orchestrator sends three cards: MENCRYPT's switch-over, MINSTALL's decisions, and MSITE's first workshop brief.
3. It starts three leads as the answers arrive. MENCRYPT can start building at once, since its questions only shape the switch-over at the end.
