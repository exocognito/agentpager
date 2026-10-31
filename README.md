# AgentPager

Bring an agent's decisions to the owner's phone. The [strategy](packages/blueprint/strategy/STRATEGY.md), [executable design](packages/blueprint/design/) with its [journeys](packages/blueprint/design/journeys/) and [wire contract](packages/blueprint/design/schemas/exchange.ts), and the [roadmap](packages/blueprint/roadmap/ROADMAP.md) are the product contract. The [workshop](packages/blueprint/records/workshop/) that preceded them is history: `strategy.md` there was promoted into the package with the edits `DEC-2026-09-25-mstart-scope` records, the tldraw board holds the round 3 proposal, and the visual workshop's variant E is the history behind the screens; `design/ui/` owns appearance.

MCARDS, the first milestone, created `packages/app/` from this contract in a cleanroom run using [recipe.json](recipe.json). That recipe is retired with v2: it still targets the retired hosted MCP, so don't run it (`docs/v2/06-blueprint-update-plan.md`). `design/` is the one design folder; it also holds the draft promises and screens for the later milestones MACCOUNT and MPRORESEARCH. Alchemy is deferred by SP2.

## Layout

| Path | Holds |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json` | The pnpm workspace. Root scripts only delegate to the packages. |
| `recipe.json` | The MCARDS cleanroom run's host, tools, setup and test command. Retired with v2; don't run it. |
| `packages/blueprint/` | The contract and the design code with its stories, unit tests and records. |
| `packages/storybook/` | The Storybook server and config and the browser story tests. It loads every story under `packages/blueprint/design/`. |
| `packages/app/` | Created by a run: the Worker, client, deploy and dogfood scripts and acceptance tests. The root scripts delegate to it by name. |

## Run the design

Use Node 22.19 or newer and pnpm. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm storybook
```

Open http://localhost:6013. The stories show the front page and the iPhone screens at 390 px and 1280 px.

```sh
pnpm check
pnpm test
pnpm build:storybook
```

Browser tests require Chromium; if missing, `pnpm exec playwright install chromium` from `packages/storybook`, the package that depends on Playwright (from this directory pnpm does not find the command).

`pnpm test` runs the design's unit tests in `packages/blueprint` and the story tests at both viewports in `packages/storybook`; `pnpm test:unit` runs only the first. `pnpm test:app` runs the server's acceptance tests against local workerd, `pnpm test:cli` builds and tests the binary, and `pnpm test:all` every suite. The stories preview and test the same exported design components the product imports. The app implements real effects and transport; its acceptance tests prove runtime integration. Storybook fixtures remain design proof only.

## Build the product

Runs use the [simple loop](https://github.com/exocognito/blueprint/blob/main/src/process/simple-loop.md). The app and the binary import the Blueprint's schemas and components by relative path (`../../blueprint/design/...`). It supplies the Worker, the Durable Object behind the session store tag, the card API layer and routing. Since v2 (`docs/v2/`), the HTTP API's routes, auth headers and error statuses are in `packages/app/src/worker.ts` and `contract.ts`, ahead of the Blueprint update; [D1](packages/blueprint/design/dependencies/D1-cloudflare.md) names the build header. `/start` and the retired `/mcp` send an arriving agent to the `agentpager` command (`packages/cli`). Test fixtures stay outside package exports.

## Reset deployed data (retired)

The MCARDS cleanroom runs deleted the `ownerpager` Worker and its data before each run. That procedure is retired: agentpager.me now holds real owners' pagers, so never delete the Worker or its data. The old command is in git history.
