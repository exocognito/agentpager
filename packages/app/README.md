# AgentPager app

From `toy-examples/agentpager`:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm start:app
# http://localhost:8787
```

The front page and `/app` run the Blueprint's imported React screens and XState machines. `/start` serves its imported plain Markdown document. The HTTPS API and stateless MCP server share SQLite-backed per-session Durable Objects. A registry object routes pairing links and serializes phone-connect joins. No accounts, notification service, or action execution is implemented.

## Pager number (dogfood)

`POST /api/numbers` with a phone key makes that key's one pager number and retires any older one. An agent with the
number opens a pager with `POST /api/numbers/<number>/pagers {name, lifetime?}` (MCP `page_owner`), already paired to
that phone key, so there is no link or emoji code. `GET /api/numbers` lists, for the phone key, the pagers opened with
any of its numbers. The Registry stores numbers and keys only as digests. This relaxes SI2 for numbered pagers on
purpose: the number is the owner's trust in the agents that can read it.

## Decision briefs (dogfood)

`card.type: "brief"` carries Markdown sections (the canvas Kit) and 2 to 4 lettered options; `attachments` carry
Markdown pages and PNG or JPEG images. The Blueprint schema (`design/ui/components/cards/brief/schema.ts`) refuses a
brief whole with the reason: HTML outside code, a recommendation or option block or Tradeoffs column for a letter
that is no option, a link to a missing attachment, or a size over its limit. The decision keeps each attachment's
name, type and size; the bytes live in their own table, immutable, and go when the pager ends. The phone reads one
with `GET /api/sessions/<id>/cards/<decisionId>/files/<name>` and its phone key.

Versions: a brief's options get their number's keycap as `emoji`, so an iPhone build from before briefs draws a
brief as an emoji card instead of failing the whole pager. A deleted proposal deletes its attachments (a trigger), so
a build from before briefs still clears them when a pager ends. But that build cannot read a stored brief at all:
before rolling the server back past briefs, end the pagers that hold one, or they answer `InvalidInput` until they end.

`fixtures/briefs/` holds the canvas's four examples (D1–D4) word for word. `scripts/briefs.ts <server> <pager number>`
plays the agent over MCP: it opens a pager with the number, asks all four, then acknowledges each answer.

## Local configuration

`PORT`, `AGENTPAGER_INSPECTOR_PORT`, and `AGENTPAGER_PERSIST` select the local listener, inspector and persistent storage (outside the worktree). `AGENTPAGER_UNPAIRED_MS` and `AGENTPAGER_SESSION_MS` are local-only compile-time settings; defaults are 60000 and 180000. The imported schema bounds these at 10000–60000 and 10000–180000. Local startup builds to a private temporary directory, so concurrent instances never race over a bundle or database. Production builds always compile the production 15-minute / 24-hour constants, regardless of these environment variables.

A generated link intentionally names `https://agentpager.me`, including on local workerd. For local use open the **same path and token** on `http://localhost:8787`; never follow it to production during local tests.

## Acceptance proof

```sh
BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-proof \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Every test file starts isolated workerd instances with its own ports and persistence. Their local lifetimes are declared in `fixture(...)` calls and in each `target.json`. Browser tests use real Chromium (390 and 1280 px); HTTPS and official MCP SDK callers use real endpoints. Transport-loss tests let the request reach the real service, then discard its reply. Nothing replaces the service or its storage.

The proof writes screenshots, browser traces, JSON exchanges, latency samples, storage counts, Worker logs and process-group exit records to `BLUEPRINT_EVIDENCE_DIR`. Node's TAP/summary reports every test. Production-only lifetime checks skip locally; real-time expiry, storage inspection and restart journeys skip remotely.

```sh
AGENTPAGER_URL=https://agentpager.me BLUEPRINT_EVIDENCE_DIR=/tmp/agentpager-deployed \
  node --test --experimental-strip-types --test-concurrency=4 packages/app/test/**/*.test.ts
```

Cold agent arrivals are **reviewer dogfood**, not acceptance tests: D2 and `recipe.json` supply the exact isolated pi HTTPS and Codex fetch-only start/resume commands and allowed owner steps. No agent-specific adapter or global client configuration is installed by this product.

## Deployment

Commit and clean the checkout, then `pnpm deploy:app`. The script reads only the prescribed vault item using the service-account token in `~/Agents/.secrets/op-service-account.token`, and supplies its credential and account id only to the one Wrangler deployment process. It creates the `agentpager.me` custom-domain route, verifies the binding, queries DNS and Durable Object placement, and checks the public HTTPS build header. Logs never contain token values. The Worker stays named `ownerpager`, with `Session`/`Registry` SQLite migrations `v1`/`v2`. Build artifacts and vault material are never committed.

### Alerts

Alerts go through Apple's push service with the owner's APNs key (D7). Deployment also reads the vault item `AgentPager APN.p8 key` and gives the key to the Worker as the secret `APNS_KEY_P8`, on Wrangler's stdin; `scripts/build.mjs` sets its key id, team id and topic. A local server (`dogfood`, `start`) cannot reach Apple's service, which speaks HTTP/2 only, so it sends no alerts; the tests point a local server at a stand-in for Apple.

## Enforcement

- Strict imported schemas decode UTF-8 requests before writes. The MCP byte gate refuses invalid UTF-8 before the SDK can normalize it; a refusal-only credential check preserves authorization precedence. Credential syntax is validated before header construction. Inputs are not trimmed or truncated.
- Before claiming, the browser stores a random phone key, then supplies it via `x-phone-key`. A per-link browser lock shares that key across tabs. The SQLite transaction owns first-phone reservation: an identical credential can recover a lost reply; every other claimant is refused. It also owns correct-target pairing, fixed deadlines, ask gating, independent cards and immutable retries. SQL primary/unique keys and update-denying triggers protect proposals, answers and acknowledgements; an ownership/deadline trigger guards session metadata.
- Session alarms and every live operation purge all payload and usable session credential tables on expiry. A minimal terminal refusal/time remains alongside a name and SHA-256 phone-key verifier in that session object. Only the reserved phone's key can retrieve the name through a terminal refusal, so a phone returning after a lost first reply can retain the real name rather than a placeholder. This terminal metadata retention is an explicit C8 caveat deviation for owner review, not a claim of total metadata erasure. The Registry drops its phone key at join. Transactional refusals cannot roll back expiry deletion.
- The phone imports `CardApi`/`HomeApi` layers, real screen components and their machines. Only metadata and owner keys live in localStorage; no cards, answers, acknowledgements or drafts are persisted there. End/expiry removes the keys and pairing-link mappings, retaining only name and end time under a fresh, unrelated label key. Terminal rows have no session identifier or service link. Old terminal records are migrated to this shape. Home recovers pre-persisted pending claim credentials as well as connect links. Discovery commits only against a still-owned pending record under the same cross-tab lock as retirement, so a delayed response cannot recreate a deleted capability or duplicate its label.
- The imported screen's shared literal-prose CSS preserves repeated spaces, indentation and newlines in proposals, choices, answers, acknowledgements and session labels; storage/DOM fidelity alone is not treated as visible fidelity.
- The app lint disallows `any`, type assertions and suppressions in derived TypeScript; the entire pinned design remains under the existing strict typecheck. No design type is widened or bypassed.

## Limits

The local expiry proof is not a 24-hour production wait; Chromium is not a real handset or camera; latency is a five-exchange smoke sample on the recorded network. Platform backups, agent action execution, absent Claude/ChatGPT clients, and cross-device recovery are not claimed. See the promise caveats and the run's deviation log before the owner walk.
