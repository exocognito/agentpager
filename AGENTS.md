# Working in this repository

AgentPager brings an agent's decisions to Sam's phone. [METHOD.md](METHOD.md) is how it is built. Before you judge or change anything, read down the Blueprint: [blueprint/README.md](blueprint/README.md), [PRODUCT.md](blueprint/PRODUCT.md), the areas in `blueprint/areas/`, [JOURNEYS.md](blueprint/JOURNEYS.md), then the app's own screens in [generated/screens/](blueprint/generated/screens/README.md).

## Working rules

- Work in your own worktree off `origin/main`, and preserve other agents' and Sam's edits.
- Every change is a draft pull request, reviewed as METHOD.md says. Inside a milestone Sam has approved, the root merges each merge-ready pull request (review passed, `pnpm check` and `pnpm test:all` green, no open finding), and Sam reviews after the merge.
- Use pnpm and Node 22.19 or newer.
- Before handing off, run `pnpm check` and `pnpm test:all`. `pnpm check` fails when what the screens are drawn from changed without `pnpm designs`, which needs a Mac with Xcode.
- When Sam is away, page Sam as `~/.agents/agentpager.md` says.

## Deploying and secrets

- Deploy as [packages/app/README.md › Deployment](packages/app/README.md#deployment) says: the service, then the command, then the app. Keep the Worker's name, its Durable Object classes and their migration tags.
- A deployed build never runs local clocks, and every reply names its build.
- Secrets never reach a worktree, log or transcript (I23); flag a leak at once. If a credential falls short, ask Sam for scoped access; never make one.
- Sam's paid Apple team signs the app; Sam keeps its push key in 1Password. Never create or use a signing identity.

## Gotchas

- Alerts need the deployed service: a local server sends none.
- UI tests drive the real app in Simulators, one run at a time. Nothing tests dark appearance or the largest text. Sam's walks and dogfood sample real phones and agent apps.
- Each test file starts its own wrangler on its own ports and storage. Zero tests reported isn't green. Port 4317 is taken on Sam's Mac.
- An MCP client may silently drop a server over a detail another tolerates, so test with two real apps.
- An agent app run without a terminal ends its turn when it asks in chat, and nothing resumes it.
- `pnpm --filter @agentpager/cli build` compiles the command with Bun for this machine; from source, as in its tests, it runs on Node.

## Stages

Three stages, each with its own data, as [METHOD.md › Stages and releases](METHOD.md#stages-and-releases) sets out. A pager number made on one isn't in use on another.

| Stage | Address | How it's deployed | Who uses it |
| --- | --- | --- | --- |
| local | `http://127.0.0.1:8787` from `pnpm start:app`, or the LAN dogfood server (`pnpm --filter @agentpager/app dogfood`) | runs from the checkout; each test file starts its own | the suites, the UI tests and `pnpm designs` |
| dev | https://dev.agentpager.me, Worker `ownerpager-dev` | `pnpm deploy:dev` from a clean checkout of `main`, then `pnpm smoke:dev` | the root after each merge; Sam's walk on the dev phone, HomePhoneLite, with Settings → Server set to dev; binaries built from `main` |
| prod | https://agentpager.me, Worker `ownerpager` | `pnpm deploy:prod`, which refuses anything but a clean tree at a release tag, then `pnpm smoke:prod` | Sam's real agents and phone |

- **The root deploys dev after each merge** and runs `pnpm smoke:dev`. The smoke run pages no one and needs no phone; the one pager it makes, with no alert target, it deletes.
- **Release tags** are `m<n>` for a milestone and `m<n>.<k>` for a fix after it, such as `m4` and `m4.1`. Prod, and the clients used with it, come only from a tag that was green on dev. Those clients are the phone build and the binary on air, mini and pro.
- **Deploy order:** the service, then the binary, then the app.
- **A binary built from `main`** is tested under its own `AGENTPAGER_HOME`, with `--server https://dev.agentpager.me`. It never uses a machine's `~/.agentpager`, which Sam's real agents use.
- **Hostnames.** Run without a terminal, wrangler silently replaces a DNS record or another Worker's domain on its hostname. So `deploy.mjs` refuses a hostname that is neither free nor already its stage's own. The Cloudflare token can't read certificate packs, so no check reads them.
