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

A pilot from 9 Nov 2026: live work status is on the [AgentPager board](https://app.todoist.com/app/project/6hxGh4F57m9GmG79) in Todoist. These rules live only here; a brief, plan or handoff links to this section and never restates it. In this section a card is a board card, a Todoist task, and what AgentPager sends Sam (TERMS.md › Card) is a page.

- **One card per outcome,** with its owner, status, next action and evidence kept current. Its section is its status:

  | Section | A card is here when |
  | --- | --- |
  | Intake | a milestone, bug or tweak is captured and being assessed |
  | Design Review | a proposal is ready for Sam to review |
  | Ready | the approach and checks are clear and the work is queued |
  | Building | it is being implemented, verified and code reviewed, through merge |
  | Merged | it is integrated and awaiting release |
  | Shipped | it is verified in production: link the release evidence and complete the card |

  Work with no production release is completed when its acceptance checks pass.
- **Design Review is a gate** for a UI change, a meaningful new technical design, or a change where Sam needs to agree what done means or how to verify it. The card shows before-and-after UI mocks or the affected statechart or schema, as applicable, with the proposed acceptance checks. Wait for Sam's approval before implementing. A simple change with a clear approach and success check goes straight to Building. If an approved design needs to change, the same card goes back through Design Review.
- **A blocking decision for Sam** keeps the card in its stage and adds the label `waiting-on-sam`. Page Sam with a decision that stands on its own on a phone: the question, context, options and their consequences, the recommendation, and any relevant UI mocks labelled by option. Todoist links go in agent handoffs, never in the page. Record what became of the answer once on the card, and clear the label when the decision is resolved.
- **Agents** reread their card when they start or resume, and update it before they hand off. An agent that can't read or update the board says so in its handoff. **The milestone lead** gives each agent its card's link, and reconciles the card against the pull request and deploy evidence at merge and at release.
- **What lives where.** Todoist owns live work status. AgentPager carries decisions and replies. The Blueprint holds approved product intent and milestone checkpoints. The repo and deploy checks hold implementation and release evidence.

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
