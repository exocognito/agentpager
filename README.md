# AgentPager

Bring an agent's decisions to the owner's phone. The [strategy](packages/blueprint/strategy/STRATEGY.md), [executable design](packages/blueprint/design/) with its [journeys](packages/blueprint/design/journeys/) and [wire contract](packages/blueprint/design/schemas/exchange.ts), and the [roadmap](packages/blueprint/roadmap/ROADMAP.md) are the product contract. The [workshop](packages/blueprint/records/workshop/) that preceded them is history: `strategy.md` there was promoted into the package with the edits `DEC-2026-09-25-mstart-scope` records, the tldraw board holds the round 3 proposal, and the visual workshop's variant E is the history behind the screens. The apps own appearance, and the [design catalogue](packages/blueprint/design/screens/README.md) records it.

MCARDS, the first milestone, created `packages/app/` from this contract in a cleanroom run using [recipe.json](recipe.json). That recipe is retired with v2: it still targets the retired hosted MCP, so don't run it (`docs/v2/06-blueprint-update-plan.md`). `design/` is the one design folder.

## Layout

| Path | Holds |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json` | The pnpm workspace. Root scripts only delegate to the packages. |
| `recipe.json` | The MCARDS cleanroom run's host, tools, setup and test command. Retired with v2; don't run it. |
| `packages/blueprint/` | The contract, the design code with its unit tests, the design catalogue (`design/screens/`) and the records. |
| `packages/ios/` | The SwiftUI iPhone app, its UI tests and the Xcode project. |
| `packages/app/` | Created by a run: the Worker, client, deploy and dogfood scripts and acceptance tests. The root scripts delegate to it by name. |

## See the design

The design is the real app. The [design catalogue](packages/blueprint/design/screens/README.md) in `packages/blueprint/design/screens/` holds its screens as images and text: every iPhone screen state with its accessibility tree, the main interactions as storyboards of numbered frames with the action between them, and the front page at 390 and 1280 px. Reading it needs nothing installed.

Use Node 22.19 or newer and pnpm. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

`pnpm designs` regenerates the catalogue on a Mac with Xcode and the iPhone 17e Simulator: it starts a local server, runs the iPhone UI tests against it and renders the front page in headless Chromium. If Chromium is missing, run `pnpm --filter @agentpager/app exec playwright install chromium`. `pnpm check` fails when anything the catalogue is drawn from (the iPhone app, its UI tests, the brief fixtures, the wire contract or the front page) changed since it was made; run `pnpm designs` and commit the result.

`pnpm test` (or `pnpm test:unit`) runs the design's unit tests in `packages/blueprint`. `pnpm test:app` runs the server's acceptance tests against local workerd, `pnpm test:cli` builds and tests the binary, and `pnpm test:all` every suite. The app implements real effects and transport; its acceptance tests prove runtime integration.

## Build the product

Runs use the [simple loop](https://github.com/exocognito/blueprint/blob/main/src/process/simple-loop.md). The app and the binary import the Blueprint's schemas and components by relative path (`../../blueprint/design/...`). It supplies the Worker, the Durable Objects behind pagers and agents, the card API layer and routing. The HTTP API's routes, auth headers and error statuses are in `packages/app/src/worker.ts` and `contract.ts`; [D1](packages/blueprint/design/dependencies/D1-cloudflare.md) names the build header. `/start` and the retired `/mcp` send an arriving agent to the `agentpager` command (`packages/cli`). Test fixtures stay outside package exports.

## Reset deployed data (retired)

The MCARDS cleanroom runs deleted the `ownerpager` Worker and its data before each run. That procedure is retired: agentpager.me now holds real owners' pagers, so never delete the Worker or its data. The old command is in git history.
