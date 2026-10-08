---
id: DEC-2026-09-26-registry-object
date: 2026-09-26
decidedBy: blueprint-6e, an agent acting under the delegation Sam gave for the period of DEC-2026-09-26-agent-reach
basis:
  - SP2
losers:
  - a Durable Object id derived from the pairing token (leaks the mapping into the id)
  - a KV store for the mapping (eventual consistency breaks one-use links)
cost: One more Durable Object class and a migration tag; D1 records `Registry` at tag v2.
---

On 2026-09-26, in PR #38 (item 4), blueprint-6e accepted the registry Durable Object that maps pairing tokens to sessions and recorded it in the recipe. The agent acted under the authority Sam gave that day to open and merge PRs that repair MSTART until phone dogfood worked.

The need: a pairing token must find its session before any session id is known. SP2 gives each session one Durable Object, and one object per session cannot be found by token. So one registry object holds the map from token to session; the session object keeps everything else.

The owner has not separately confirmed this ruling. Merging this record approves it.
