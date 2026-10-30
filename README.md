# AgentPager

Bring an agent's decisions to the owner's phone. The [strategy](packages/blueprint/strategy/STRATEGY.md), [executable design](packages/blueprint/design/) with its [journeys](packages/blueprint/design/journeys/) and [ways in](packages/blueprint/design/effects/routes.ts), and the [roadmap](packages/blueprint/roadmap/ROADMAP.md) are the product contract. The [workshop](packages/blueprint/records/workshop/) that preceded them is history: `strategy.md` there was promoted into the package with the edits `DEC-2026-09-25-mstart-scope` records, the tldraw board holds the round 3 proposal, and the visual workshop's variant E is the history behind the screens; `design/ui/` owns appearance.

MCARDS, the first milestone, creates `packages/app/` from this contract in a cleanroom run using [recipe.json](recipe.json). `design/` is the one design folder; it also holds the draft promises and screens for the later milestones MACCOUNT and MPRORESEARCH. Alchemy is deferred by SP2.

## Layout

| Path | Holds |
| --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json` | The pnpm workspace. Root scripts only delegate to the packages. |
| `recipe.json` | Host, tools, setup and test command for a run. The driver reads it here. |
| `packages/blueprint/` | The contract and the design code with its stories, unit tests, the statechart script and records. |
| `packages/storybook/` | The Storybook server and config and the browser story tests. It loads every story under `packages/blueprint/design/`. |
| `packages/app/` | Created by a run: the Worker, client, deploy and dogfood scripts and acceptance tests. The root scripts delegate to it by name. |

## Run the design

Use Node 22.19 or newer and pnpm. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm storybook
```

Open http://localhost:6013. The screen stories show every home and card screen state and the front page at 390 px and 1280 px; the journeys drive the real machines against in-memory services, which prove only the fixture interaction, never the service.

```sh
pnpm check
pnpm test
pnpm diagram:check
pnpm build:storybook
```

Browser tests require Chromium; if missing, `pnpm exec playwright install chromium` from `packages/storybook`, the package that depends on Playwright (from this directory pnpm does not find the command). `pnpm diagram` regenerates [cards.html](packages/blueprint/design/machines/cards.html) and `cards.mmd` from the card machine.

`pnpm test` runs the design's unit tests in `packages/blueprint` and the story tests at both viewports in `packages/storybook`; `pnpm test:unit` runs only the first. The stories preview and test the same exported design components the product imports. The app implements real effects and transport; its acceptance tests prove runtime integration through the recipe command. Storybook fixtures remain design proof only.

## Build the product

Runs use the [simple loop](https://github.com/exocognito/blueprint/blob/main/src/process/simple-loop.md). The app imports `@agentpager/blueprint` via `workspace:*`, through the subpaths its [`package.json`](packages/blueprint/package.json) `exports` lists. It supplies the Worker, the Durable Object behind the session store tag, the card API layer and routing. Since v2 (`docs/v2/`), the HTTP API's routes, auth headers and error statuses are in `packages/app/src/worker.ts` and `contract.ts`, ahead of the Blueprint update; [D1](packages/blueprint/design/dependencies/D1-cloudflare.md) names the build header. `/start` and the retired `/mcp` send an arriving agent to the `agentpager` command (`packages/cli`). Test fixtures stay outside package exports.

## Reset deployed data

Before each run the operator deletes the `ownerpager` Worker with its Durable Object data, so no tables from earlier candidates remain. Run this on the VM:

```sh
OP_SERVICE_ACCOUNT_TOKEN="$(cat ~/Agents/.secrets/op-service-account.token)" \
CLOUDFLARE_API_TOKEN='op://Yolo Sam/Cloudflare ownerpager/credential' \
CLOUDFLARE_ACCOUNT_ID='op://Yolo Sam/Cloudflare ownerpager/account_id' \
op run -- bash -c 'printf "header = \"Authorization: Bearer %s\"\n" "$CLOUDFLARE_API_TOKEN" | curl -sS --fail-with-body --config - -X DELETE "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/ownerpager?force=true"' < /dev/null
```

Success is `"success": true`. A 404 with code 10007, "This Worker does not exist", means it is already gone. agentpager.me serves nothing until the run's first deploy. `wrangler delete` does not work here: the vault token cannot list KV namespaces, so it fails after deleting the Worker.
