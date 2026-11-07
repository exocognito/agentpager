# AgentPager app

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm start:app
# http://localhost:8787
```

The front page runs the Blueprint's imported React marketing screen; the owner's side of the product is the iPhone app in `../ios`, and the old web app address `/app` redirects to the front page. `/start` and the retired `/mcp` tell an arriving agent to install the `agentpager` command (`../cli`), whose transport is the HTTPS API. The API uses one SQLite-backed Durable Object per agent (`Agent`) and one `Registry` for pagers. No accounts, and no action execution.

## Pagers and agents

A **pager** is made on the phone: `POST /api/pagers {number, publicKey, autoOff}` with the phone key. The phone makes
a Curve25519 key pair and the number `ap1_` + base64url(pager id ‖ the first 8 bytes of the public key's SHA-256); the
server checks that the fingerprint matches and keys the pager by its id. The name lives only on the phone. A pager is
on or off (`POST /api/pagers/<id>/settings {on?, autoOff?}`); auto-off (`never`, `24h`, `7d`, `30d`) lands in the same
off state. `GET /api/pagers/<id>` returns the pager and every agent on it with its open and answered decisions.
`POST /api/pagers/<id>/delete` deletes it and its agents.

Anyone may read a pager's public key, `GET /api/pagers/<id>/key`: the command checks it against the number's fingerprint
before it seals anything to it, and pins it. An **agent** is whatever connected with the number:
`POST /api/agents {number, identity}` (`agentpager connect`) makes a new one every time, with its own key; `identity` is
who asked, the project and the computer, sealed to the pager's key. It has no lifetime; housekeeping forgets it 30 days
after its last activity.
While its pager is off, every call but status is refused `PagerOff` and nothing is queued; the phone's answers too.
An agent asks with a request id its command chose (`requestId`, a token), and the decision is stored under the id
`decisionIdOf(agentId, requestId)` makes (`packages/contract/exchange.ts`), so no two agents' decisions share an id. The
same ask again with that request id and the same `digest` (a keyed digest of the card only its agent can make), as after
a lost reply, returns the same decision without storing or alerting again; another card with it is refused
`RequestIdTaken`.

**End to end.** The service holds every card, attachment, identity, answer and acknowledgement as an encrypted part
(`packages/contract/envelope.ts`) it can't read, and checks only each part's shape and size (`Sealed` in
`exchange.ts`). An ask sends `{requestId, digest, card, attachments?, preview}`, each part sealed to the pager's key and
bound to the decision; the card names the key the phone seals its answer to, which the service never sees otherwise.
The phone answers with `{requestId, answer}`; an acknowledgement is `{answerId, acknowledgement, preview}`. Alerts carry
only a plain fallback and the preview (`packages/contract/alerts.ts`). Agents stored before the switch are forgotten at
its first start, with all they stored; every pager stays (`registry.ts`, `agent.ts`).

Every request names its client in `X-AgentPager-Client`, as `<client>/<protocol> <build>` (`CLIENT_HEADER` and
`PROTOCOL` in `packages/contract/exchange.ts`). An agent's call without it, or from a protocol older than the service
accepts (`OLDEST_PROTOCOL` in `src/contract.ts`), is refused `UpdateRequired`, before its key or input is read, with how
to update. Since the encryption switch (protocol 2) the phone's calls need it too: an older app is refused the same way,
never `UnknownPager`.

## Decision briefs (dogfood)

`card.type: "brief"` carries Markdown sections (the canvas Kit) and 2 to 4 lettered options; `attachments` carry
Markdown pages and PNG or JPEG images. The contract's brief schema (`packages/contract/brief.ts`) refuses a
brief whole with the reason: HTML outside code, a recommendation or option block or Tradeoffs column for a letter
that is no option, a link to a missing attachment, or a size over its limit. The command holds every card to it before
it seals it, and the phone again when it opens one; the service can't read it. The card part names each attachment;
the service keeps each attachment's part and its size by slot, immutable, and they go when the pager ends. The phone
reads one with `GET /api/agents/<id>/cards/<decisionId>/files/<slot>` and its phone key, and opens it bound to that slot.

`fixtures/briefs/` holds the canvas's four examples (D1–D4) word for word. `scripts/briefs.ts <server> <pager number>`
plays the agent over the HTTP API, sealing as the command does: it connects with the number, asks all four, then
acknowledges each answer.

## Local configuration

`PORT`, `AGENTPAGER_INSPECTOR_PORT`, and `AGENTPAGER_PERSIST` select the local listener, inspector and persistent storage (outside the worktree). `AGENTPAGER_AUTO_OFF_MS` (every auto-off choice), `AGENTPAGER_IDLE_MS` (housekeeping) and `AGENTPAGER_PICKUP_MS` (the warning when no agent collects an answer) are local-only compile-time clocks, so tests cross them in real time; zero or unset is the production value. Local startup builds to a private temporary directory, so concurrent instances never race over a bundle or database. Production builds always compile the production clocks.

## Acceptance proof

```sh
BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-proof \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Every test file starts isolated workerd instances with its own ports and persistence. Their local clocks are declared in `fixture(...)` calls. Browser tests use real Chromium (390 and 1280 px); HTTPS callers use real endpoints (the MCP server's tests are the binary's, in `../cli`). Transport-loss tests let the request reach the real service, then discard its reply. Nothing replaces the service or its storage.

The proof writes screenshots, browser traces, JSON exchanges, latency samples, storage counts, Worker logs and process-group exit records to `BLUEPRINT_EVIDENCE_DIR`. Node's TAP/summary reports every test. 

```sh
AGENTPAGER_URL=https://agentpager.me BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-deployed \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Cold agent arrivals are not acceptance tests: Sam's walks and dogfood sample real agent apps (AGENTS.md › Gotchas).

## Deployment

Commit and clean the checkout, then `pnpm deploy:dev`, and `pnpm smoke:dev` after it; `pnpm deploy:prod` deploys only a commit at a release tag (the stages are in the root `AGENTS.md`). `scripts/stages.ts` names each stage's Worker and hostname: dev is `ownerpager-dev` at `dev.agentpager.me`, with Durable Object namespaces of its own, and prod is `ownerpager` at `agentpager.me`. Both deploy the same build. The script reads only the prescribed vault item using the service-account token in `~/Agents/.secrets/op-service-account.token`, and supplies its credential and account id only to the one Wrangler deployment process. It refuses a hostname that already has a DNS record or another Worker's domain, creates the stage's custom-domain route, verifies the binding, queries DNS and Durable Object placement, and checks the public HTTPS build header; `--verify` runs only those checks, for the smoke run. Logs never contain token values. The prod Worker stays named `ownerpager`, with SQLite migrations `v1` (`Session`), `v2` (`Registry`) and `v3`, which renames `Session` to `Agent`. v1's sessions are not read by v2: each forgets itself at its next alarm, and the Registry drops v1's link and number tables. Deploy v2 with the v2 iPhone build: v1 pagers stop working at once. Build artifacts and vault material are never committed.

### Upgrade baseline

Each release records an upgrade baseline on dev before the next milestone's code reaches dev (METHOD.md › The milestone loop). `pnpm baseline:dev --binary <the release's agentpager> --tag m<n>` makes a pager there as the phone does, with no alert target, so it pages no one. That binary connects to it under its own `AGENTPAGER_HOME` and asks two cards: one with a PNG and a page, which the phone answers and the binary collects and acknowledges, and one left open. The script reads it all back over the phone's API. Without `--binary`, it builds one from a checkout at the tag. The record goes to `~/.agentpager-baselines/dev/<tag>/`, outside every worktree: the pager's keys, number and phone key, the agent and decision ids, the binary's home, and a copy of the binary, so the next milestone's upgrade check can run the old command without rebuilding it. Its format is at the top of `scripts/baseline.mjs`. The script prints no key or number, never overwrites a record, and never touches `~/.agentpager`; `--verify` reads a record back and changes nothing. The service forgets an agent idle for 30 days, so the upgrade check has to run within 30 days of the baseline. The smoke run's upgrade check reads the last release's record (`--baseline-tag`, `m4` for M5): `node --experimental-strip-types scripts/smoke.mjs --stage local --server <url>` runs it, with the rest of the smoke run that a local server can, against a local baseline under `AGENTPAGER_BASELINES`. A record from before the encryption switch is format 1; `--verify` reads format 2.

### Alerts

Alerts go through Apple's push service with the owner's APNs key (B17, in `blueprint/areas/4-getting-paged.md`). Deployment also reads the vault item `AgentPager APN.p8 key` and gives the key to each stage's Worker as the secret `APNS_KEY_P8`, on Wrangler's stdin; `scripts/build.mjs` sets its key id, team id and topic. A local server (`dogfood`, `start`) cannot reach Apple's service, which speaks HTTP/2 only, so it sends no alerts; the tests point a local server at a stand-in for Apple.

## Enforcement

- Strict imported schemas decode UTF-8 requests before writes; a wrong key wins over invalid input (I4). Inputs are not trimmed or truncated.
- Agent and phone keys are stored only as SHA-256 digests and compared in constant time. SQL keys and update-denying triggers keep decisions, answers, acknowledgements and attachments immutable. Every one of them is an encrypted part the service can't read (I20).
- Every agent call that sends something asks the Registry for its pager's state first; a deleted pager's agent forgets itself on its next call.
- The app lint disallows `any`, type assertions and suppressions in derived TypeScript; the entire pinned design remains under the existing strict typecheck.

## Limits

Off is not atomic with a write (accepted 30 Oct for dogfooding, to fix later): an agent call checks its pager in the Registry and then writes in its own object, so a request already past that check when the owner turns the pager off still lands, a window of one Registry round trip; everything sent after the switch is refused. Closing it needs one writer per pager. The local auto-off and housekeeping proofs run on seconds, not the production days. Encryption hides what is said, not who pages whom, when, how much or how often. Platform backups, agent action execution and cross-device recovery are not claimed.
