# Working in this repository

AgentPager brings an agent's decisions to Sam's phone. [METHOD.md](METHOD.md) is how it is built. Before you judge or change anything, read down the Blueprint: [blueprint/README.md](blueprint/README.md), [PRODUCT.md](blueprint/PRODUCT.md), the areas in `blueprint/areas/`, [JOURNEYS.md](blueprint/JOURNEYS.md), then the app's own screens in [generated/screens/](blueprint/generated/screens/README.md).

## Working rules

- Work in your own worktree off `origin/main`, and preserve other agents' and Sam's edits.
- Every change is a draft pull request, reviewed as METHOD.md says. When Sam gives the root the go for a milestone, the root merges each of its merge-ready pull requests (review passed, `pnpm check` and `pnpm test:all` green, no open finding), and Sam reviews after the merge.
- Don't build to what v2 retired: link, QR and emoji pairing, sessions with end times, emoji cards, the web app, the hosted MCP and `recipe.json`.
- Use pnpm and Node 22.19 or newer.
- Before handing off, run `pnpm check` and `pnpm test:all`. `pnpm check` fails when what the screens are drawn from changed without `pnpm designs`, which needs a Mac with Xcode. It also fails when `blueprint/generated/by-milestone.md` or `untested.md` is stale, after a change to the areas, JOURNEYS.md or an id in a test's name: run `pnpm blueprint` and commit them.
- When Sam is away, page Sam as `~/.agents/agentpager.md` says.

## The board

The [AgentPager board](https://app.todoist.com/app/project/6hxGh4F57m9GmG79) in Todoist is the source of truth for live work status. Briefs, plans and handoffs link here. A card is a Todoist task. A page is what AgentPager sends Sam.

- **One card per independent outcome.** A milestone, bug fix or investigation gets a card. Its steps, pull requests, checks and questions are subtasks. Complete each when its evidence is recorded. Promote a subtask when it gains an independent outcome.
- **A card's section shows its status.** Keep its outcome, owner, status, next step, evidence and completion criteria current.

  | Section | A card is here when |
  | --- | --- |
  | Intake | it is captured and being assessed, or queued for Sam's go |
  | Design Review | the review is being prepared or is with Sam for approval |
  | Ready | the approach and checks are clear and the work is queued |
  | Building | implementation, verification or code review is under way |
  | Merged | the change is integrated and release or verification is pending |
  | Shipped | the release is verified in production and the evidence is linked |

  Close out the subtasks before completing their card. For a shipped card, link production verification. For work without a production release, link the passing acceptance checks.
- **One milestone at a time.** The next card stays in Intake until the previous milestone's card and subtasks are complete, subject to the [exceptions in METHOD.md](METHOD.md#when-things-get-written). For earlier milestones that predate subtasks, complete their remaining closeout cards or apply the same exceptions before starting the next one. Report the open items when the gate is blocked.
- **Every milestone opens with [Design Review](METHOD.md#the-milestone-loop).** Link one draft PR from the card. Add a subtask for each review part and link its evidence or mark it as inapplicable. Get Sam's approval before implementation. Outside milestones, use the same gate for UI changes, meaningful technical design, or changes where Sam needs to agree what done means. A small fix with clear acceptance checks can go straight to Building. Return to Design Review if an approved design needs to change.
- **Later ideas wait for Sam.** Keep uncommitted ideas in Intake with the `later` label. When Sam commits to one, remove the label, add its milestone row and queued doc, then assess it.
- **A blocking decision for Sam** gets `waiting-on-sam` on the subtask once the question is ready for Sam, and on its card while the card cannot move. Page Sam with a question that stands on its own, its options and consequences, a recommendation, and any relevant UI mocks. Keep Todoist links out of pages and include them in handoffs. Record the answer once on the card and clear the labels when resolved.
- **Keep the board current as work happens.** Read the card, its subtasks and recent comments at start and resume, and check for new owner replies before reporting a blocker or handing off. Update the board in the same piece of work as a PR open, merge, deploy or owner decision. Link the PR and card to each other. The milestone lead gives each agent its task link and records who reconciled the card, when, and against which PR or deploy evidence. An agent that lacks board access says so in its handoff.
- **Keep evidence where it belongs.** The [Blueprint milestone table](blueprint/README.md#milestones) mirrors the milestone cards. Update a row when the milestone starts or finishes. Milestone docs hold designs, answers and history. GitHub and deploy results settle factual disagreements about what merged or shipped. Fix the board from that evidence, then fix the mirror from the board.

## Stages

Three stages, each with its own data, as [METHOD.md › Stages and releases](METHOD.md#stages-and-releases) sets out. A pager number made on one isn't in use on another.

| Stage | Address | How it's deployed | Who uses it |
| --- | --- | --- | --- |
| local | `http://127.0.0.1:8787` from `pnpm start:app`, or the LAN dogfood server (`pnpm --filter @agentpager/app dogfood`) | runs from the checkout; each test file starts its own | the suites, the UI tests and `pnpm designs` |
| dev | https://dev.agentpager.me, Worker `ownerpager-dev` | `pnpm deploy:dev` from a clean checkout of `main`, then `pnpm smoke:dev` | the root after each merge; Sam's walk on the dev phone, HomePhoneLite, which runs `main`'s app from `pnpm phone:dev`; binaries built from `main` |
| prod | https://agentpager.me, Worker `ownerpager` | `pnpm deploy:prod`, which refuses anything but a clean tree at a release tag, then `pnpm smoke:prod` | Sam's real agents and phone |

- **The root deploys dev after each merge** and runs `pnpm smoke:dev`. The smoke run pages no one and needs no phone; the one pager it makes, with no alert target, it deletes.
- **Release tags** are `m<n>` for a milestone and `m<n>.<k>` for a fix after it, such as `m4` and `m4.1`. Prod, and the clients used with it, come only from a tag that was green on dev. Those clients are the phone build and the binary on air, mini and pro.
- **Deploy order:** the service, then the binary, then the app.
- **The dev phone** gets its builds from `pnpm phone:dev`: it builds the app with dev.agentpager.me as its default server, then installs and launches it on HomePhoneLite. The project's default stays agentpager.me, since Sam's own iPhone takes the same team's builds, and the Settings app's Server field still overrides either. Sam permits agents to control the dev phone (5 Nov 2026): installing, launching and reading its state with `devicectl`.
- **A binary built from `main`** is tested under its own `AGENTPAGER_HOME`, with `--server https://dev.agentpager.me`. It never uses a machine's `~/.agentpager`, which Sam's real agents use.
- **Hostnames.** Run without a terminal, wrangler silently replaces a DNS record or another Worker's domain on its hostname. So `deploy.mjs` refuses a hostname that is neither free nor already its stage's own. The Cloudflare token can't read certificate packs, so no check reads them.

## Deploying and secrets

- [packages/app/README.md › Deployment](packages/app/README.md#deployment) has the service's steps. Each stage keeps its Worker's name, its Durable Object classes and their applied migration tags; a new class needs a later tag.
- A deployed build never runs local clocks, and every reply names its build.
- Secrets never reach a worktree, log or transcript (I23); flag a leak at once. If a credential falls short, ask Sam for scoped access; never make one.
- Sam's paid Apple team signs the app; Sam keeps its push key in 1Password. Never create, request or use an Apple signing identity, certificate or account on Sam's behalf.

## Gotchas

- Alerts need the deployed service: a local server sends none.
- UI tests drive the real app in Simulators, one run at a time. Nothing tests dark appearance or the largest text. Sam's walks and dogfood sample real phones and agent apps.
- Each test file starts its own wrangler on its own ports and storage. Zero tests reported isn't green. Port 4317 is taken on Sam's Mac.
- An MCP client may silently drop a server over a detail another tolerates, so test with two real apps.
- Run an agent app without a terminal with stdin closed, a time limit and its output streamed. It ends its turn when it asks in chat, nothing resumes it, and its resume flags differ from its start flags.
- `pnpm --filter @agentpager/cli build` compiles the command with Bun (no version pinned) for this machine; from source, as in its tests, it runs on Node.
