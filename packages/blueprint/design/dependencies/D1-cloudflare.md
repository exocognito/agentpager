---
id: D1::cloudflare
statement: The product's service runs as one Worker on the agentpager.me zone, with one SQLite-backed Durable Object per pager and one registry object, and nowhere else.
providedBy: owner
provided: existing Worker `ownerpager` and SQLite Durable Object classes `Session` (migration tag v1) and `Registry` (tag v2); existing vault item "Cloudflare ownerpager" with fields credential and account_id. The candidate deploy must create and verify the domain binding, DNS and HTTPS on the zone. [DEC-2026-09-29-m1-owner-feedback](../../records/decisions/DEC-2026-09-29-m1-owner-feedback.md) records the dated checks of this credential. Keep the Worker name, class names and applied migration tags; add a later tag for any new class.
caveats:
  - A green deploy shows the candidate is live on the zone; it does not show the zone's DNS is the only path in, or anything about Cloudflare's own availability.
  - The deployed proof shows a deploy of the candidate; it does not show the credential's scope beyond what that deploy exercised. If the existing key cannot create the required binding or deploy, ask the owner to resolve scoped access.
---

Must supply: HTTPS on the apex, with every plain HTTP request redirected to HTTPS and every response carrying Strict-Transport-Security; Durable Objects with SQLite storage, one per pager plus the registry that maps link codes to pagers (DEC-2026-09-26-registry-object); a deploy from the checkout with `deploy:app`, whose log records the Worker name, the account id and the zone and never a token value, which reads the vault item with the op CLI, as the recipe's environment describes, into the environment of that one wrangler process, field credential as `CLOUDFLARE_API_TOKEN` and field account_id as `CLOUDFLARE_ACCOUNT_ID`.

Must never do: serve a build other than the candidate commit, which is why every response carries `X-AgentPager-Build`; answer a request over plain HTTP; store an agent key, phone key or link code other than as its SHA-256 digest; compare a presented key with its stored digest other than in constant time; send a pager's pairing code to a phone; hold a pager outside its Durable Object; let the token reach the worktree, the evidence directory, a log or a transcript; or run a deployed build with local lifetimes ([LOCAL_LIFETIMES](../schemas/exchange.ts#LOCAL_LIFETIMES)). A leaked token is a credential exposure the role flags at once.

Local runs stand on the wrangler the toy root `package.json` pins, with `--persist-to` outside the worktree and local lifetimes set per instance in the way the builder names in its handoff (recipe environment). Where the local host differs from the zone is the recipe's business, not this dependency's.

Proof runs on: the local candidate and https://agentpager.me, through public product paths with real services and persistence. Each local instance runs the shortest local lifetimes its case allows and waits in real time; deployed checks use the production lifetimes. Storage probes and end-time crossings run locally only; there is no deployed wait for a real lifetime.

On the deployed product, after deploying the candidate: every response surface, across repeated session requests, carries the candidate's build; a paired pager's end time is exactly its chosen lifetime after pairing; a link older than the local unpaired lifetime still works; plain HTTP redirects and HTTPS carries Strict-Transport-Security. The Worker's namespace, classes and SQLite placement are inspected apart from what the product shows.
