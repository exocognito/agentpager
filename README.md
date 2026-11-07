# AgentPager

Bring an agent's decisions to the owner's phone. The [Blueprint](blueprint/README.md) is the product contract: [what it's for](blueprint/PRODUCT.md), the promises of each [area](blueprint/areas/), the [journeys](blueprint/JOURNEYS.md) and the [milestones](blueprint/README.md#milestones), with the [wire contract](packages/contract/exchange.ts) in code. [METHOD.md](METHOD.md) is how it is built. The apps own appearance, and the [design catalogue](blueprint/generated/screens/README.md) records it.

## Layout

| Path | Holds |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json` | The pnpm workspace. Root scripts only delegate to the packages. |
| `blueprint/` | The Blueprint: the product contract, its milestones and, in `generated/screens/`, the design catalogue written by `pnpm designs`. |
| `docs/research/` | Findings that outlive a milestone, such as the [30 Oct wake lab](docs/research/2026-10-30-agent-wake-lab.md). |
| `packages/contract/` | The wire contract: the schemas the server, the binary and the phone exchange, with their unit tests. |
| `packages/ios/` | The SwiftUI iPhone app, its UI tests and the Xcode project. |
| `packages/app/` | Created by a run: the Worker, the front page (`src/site/`), deploy and dogfood scripts and acceptance tests. The root scripts delegate to it by name. |

## See the design

The design is the real app. The [design catalogue](blueprint/generated/screens/README.md) in `blueprint/generated/screens/` holds its screens as images and text: every iPhone screen state with its accessibility tree, the main interactions as storyboards of numbered frames with the action between them, and the front page at 390 and 1280 px. Reading it needs nothing installed.

Use Node 22.19 or newer and pnpm. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

`pnpm designs` regenerates the catalogue on a Mac with Xcode and the iPhone 17e Simulator: it starts a local server, runs the iPhone UI tests against it and renders the front page in headless Chromium. If Chromium is missing, run `pnpm --filter @agentpager/app exec playwright install chromium`. `pnpm check` fails when anything the catalogue is drawn from (the iPhone app, its UI tests, the brief fixtures, the wire contract or the front page) changed since it was made; run `pnpm designs` and commit the result.

`pnpm test` (or `pnpm test:unit`) runs the unit tests of the wire contract (`packages/contract`, with its encrypted-part vectors under Node and a Bun-compiled binary) and the front page (`packages/app/src/site`), and `swift test` for the phone's side of the encrypted-part format (`packages/ios/AgentPagerCrypto`), so it needs Bun and Swift. `pnpm test:app` runs the server's acceptance tests against local workerd, `pnpm test:cli` builds and tests the binary, and `pnpm test:all` every suite. The app implements real effects and transport; its acceptance tests prove runtime integration.

## Build the product

The app and the binary import the wire contract by relative path (`../../contract/...`). It supplies the Worker, the Durable Objects behind pagers and agents, the card API layer and routing. The HTTP API's routes, auth headers and error statuses are in `packages/app/src/worker.ts` and `contract.ts`; every request names its client in `X-AgentPager-Client` and every reply carries the build header `X-AgentPager-Build` ([packages/app/README.md › Deployment](packages/app/README.md#deployment)). `/start` and the retired `/mcp` send an arriving agent to the `agentpager` command (`packages/cli`). Test fixtures stay outside package exports.

## Reset deployed data (retired)

The MCARDS cleanroom runs deleted the `ownerpager` Worker and its data before each run. That procedure is retired: agentpager.me now holds real owners' pagers, so never delete the Worker or its data. The old command is in git history.
