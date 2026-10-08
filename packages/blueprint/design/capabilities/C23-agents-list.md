---
id: C23::agents-list
serves:
  - SC1
  - SI2
  - SP6
statement: Open AgentPager to see each agent with a pager on this phone, which are waiting on you, and which pagers have ended and why.
caveats:
  - The list belongs to one phone. Nothing joins pagers across phones; that needs accounts.
  - Deleting the app, or losing the keys it stores, loses its pagers. There is no recovery.
  - Until C17::get-paged, the list refreshes only while the app is open. A closed app learns nothing until it is opened.
---

## Behaviors

1. The Agents list shows active pagers apart from ended ones. Each row names the agent and gives its status and time, worded like "Pager active · Ends in 24h", "Pager not paired · Ends in 14m" or "Pager ended · 1d ago". Active rows show how many decisions are open.
2. With no pagers, the list says how to connect an agent. A + button on the list opens Connect an Agent (C20).
3. Tapping an active row opens that agent's screen, with its open decisions, each marked unread, kept apart from the answered ones. Tapping a row that is not yet paired opens pairing.
4. An ended row keeps only the agent's name and why and when the pager ended. It stays for 7 days after the end, then disappears. Tapping it opens the ended screen (C22).
5. While open, the list stays current without the owner refreshing it.

## Never

- A pager that this phone did not make or pair shows in its list.
