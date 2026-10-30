# AgentPager app

From `toy-examples/agentpager`:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm start:app
# http://localhost:8787
```

The front page runs the Blueprint's imported React marketing screen; the owner's side of the product is the iPhone app in `../ios`, and the old web app address `/app` redirects to the front page. `/start` and the retired `/mcp` tell an arriving agent to install the `agentpager` command (`../cli`), whose transport is the HTTPS API. The API uses one SQLite-backed Durable Object per agent (`Agent`) and one `Registry` for pagers. No accounts, and no action execution.

## Pagers and agents (v2, `docs/v2/`)

A **pager** is made on the phone: `POST /api/pagers {number, publicKey, autoOff}` with the phone key. The phone makes
a Curve25519 key pair and the number `ap1_` + base64url(pager id ‖ the first 8 bytes of the public key's SHA-256); the
server checks that the fingerprint matches and keys the pager by its id. The name lives only on the phone. A pager is
on or off (`POST /api/pagers/<id>/settings {on?, autoOff?}`); auto-off (`never`, `24h`, `7d`, `30d`) lands in the same
off state. `GET /api/pagers/<id>` returns the pager and every agent on it with its open and answered decisions.
`POST /api/pagers/<id>/delete` deletes it and its agents.

An **agent** is whatever connected with the number: `POST /api/agents {number, app, project}` (`agentpager connect`) makes a
new one every time, with its own key. It has no lifetime; housekeeping forgets it 30 days after its last activity.
While its pager is off, every call but status is refused `PagerOff` and nothing is queued; the phone's answers too.

## Decision briefs (dogfood)

`card.type: "brief"` carries Markdown sections (the canvas Kit) and 2 to 4 lettered options; `attachments` carry
Markdown pages and PNG or JPEG images. The Blueprint schema (`design/ui/components/cards/brief/schema.ts`) refuses a
brief whole with the reason: HTML outside code, a recommendation or option block or Tradeoffs column for a letter
that is no option, a link to a missing attachment, or a size over its limit. The decision keeps each attachment's
name, type and size; the bytes live in their own table, immutable, and go when the pager ends. The phone reads one
with `GET /api/agents/<id>/cards/<decisionId>/files/<name>` and its phone key.

A brief's options also get their number's keycap as `emoji`.

`fixtures/briefs/` holds the canvas's four examples (D1–D4) word for word. `scripts/briefs.ts <server> <pager number>`
plays the agent over the HTTP API: it connects with the number, asks all four, then acknowledges each answer.

## Local configuration

`PORT`, `AGENTPAGER_INSPECTOR_PORT`, and `AGENTPAGER_PERSIST` select the local listener, inspector and persistent storage (outside the worktree). `AGENTPAGER_AUTO_OFF_MS` (every auto-off choice) and `AGENTPAGER_IDLE_MS` (housekeeping) are local-only compile-time clocks, so tests cross them in real time; zero or unset is the production value. Local startup builds to a private temporary directory, so concurrent instances never race over a bundle or database. Production builds always compile the production clocks.

## Acceptance proof

```sh
BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-proof \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Every test file starts isolated workerd instances with its own ports and persistence. Their local clocks are declared in `fixture(...)` calls. Browser tests use real Chromium (390 and 1280 px); HTTPS and official MCP SDK callers use real endpoints. Transport-loss tests let the request reach the real service, then discard its reply. Nothing replaces the service or its storage.

The proof writes screenshots, browser traces, JSON exchanges, latency samples, storage counts, Worker logs and process-group exit records to `BLUEPRINT_EVIDENCE_DIR`. Node's TAP/summary reports every test. 

```sh
AGENTPAGER_URL=https://agentpager.me BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-deployed \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Cold agent arrivals are **reviewer dogfood**, not acceptance tests: D2 and `recipe.json` supply the exact isolated pi HTTPS and Codex fetch-only start/resume commands and allowed owner steps. No agent-specific adapter or global client configuration is installed by this product.

## Deployment

Commit and clean the checkout, then `pnpm deploy:app`. The script reads only the prescribed vault item using the service-account token in `~/Agents/.secrets/op-service-account.token`, and supplies its credential and account id only to the one Wrangler deployment process. It creates the `agentpager.me` custom-domain route, verifies the binding, queries DNS and Durable Object placement, and checks the public HTTPS build header. Logs never contain token values. The Worker stays named `ownerpager`, with SQLite migrations `v1` (`Session`), `v2` (`Registry`) and `v3`, which renames `Session` to `Agent`. v1's sessions are not read by v2: each forgets itself at its next alarm, and the Registry drops v1's link and number tables. Deploy v2 with the v2 iPhone build: v1 pagers stop working at once. Build artifacts and vault material are never committed.

### Alerts

Alerts go through Apple's push service with the owner's APNs key (D7). Deployment also reads the vault item `AgentPager APN.p8 key` and gives the key to the Worker as the secret `APNS_KEY_P8`, on Wrangler's stdin; `scripts/build.mjs` sets its key id, team id and topic. A local server (`dogfood`, `start`) cannot reach Apple's service, which speaks HTTP/2 only, so it sends no alerts; the tests point a local server at a stand-in for Apple.

## Enforcement

- Strict imported schemas decode UTF-8 requests before writes; a wrong key wins over invalid input (I4). Inputs are not trimmed or truncated.
- Agent and phone keys are stored only as SHA-256 digests and compared in constant time. SQL keys and update-denying triggers keep proposals, answers, acknowledgements and attachments immutable.
- Every agent call that sends something asks the Registry for its pager's state first; a deleted pager's agent forgets itself on its next call.
- The app lint disallows `any`, type assertions and suppressions in derived TypeScript; the entire pinned design remains under the existing strict typecheck.

## Limits

The local auto-off and housekeeping proofs run on seconds, not the production days. Nothing is encrypted end to end yet (Stage 3): the server reads cards, attachments and answers. Platform backups, agent action execution and cross-device recovery are not claimed.
