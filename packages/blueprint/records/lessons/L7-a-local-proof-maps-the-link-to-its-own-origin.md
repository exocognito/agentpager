---
id: L7::a-local-proof-maps-the-link-to-its-own-origin
learnedIn: MSTART, VM run 01 turns 5 and 6, 2026-09-29 (PR #74)
---

What happened: under wrangler dev the request host is the configured production host, so a pairing link the local product returned named ownerpager.com. A local test that followed it as given reached the deployed product, not the instance under test, and the turn 5 review asked the recipe to state the substitution. Builders and reviewers asked for this rule in four of the run's six turns.

What a role does now: a local proof takes the link's path and token to its own local origin and says so in its artifact. That mapping is test support, not a product change: the product keeps returning the production host, and no one makes it return a local one. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.

Now held by: the [recipe](../../../../recipe.json) environment states the local link mapping; this file is history.
