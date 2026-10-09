---
id: C25::page-by-pager-number
serves:
  - SC1
  - SI2
  - SP5
statement: Give agents you trust your pager number, and each opens its own pager on your phone, already paired, with no link to show and no code to tap.
caveats:
  - Numbers carry the Token schema's 192 random bits. Resistance to guessing holds by construction, not by an attack.
---

## Behaviors

1. The app gives the owner a pager number, and a line holding it that is written for an agent's standing instructions, such as AGENTS.md. The owner copies or shares that line and pastes it where only agents they trust read it, since whoever has a number and can reach the service can open pagers on the phone with it and ask cards in them.
2. An agent that has the number opens a pager with its name and an end time of 24 hours, 7 days or 30 days, over HTTPS or MCP, as agentpager.me/start says (C2). The pager is paired from the start. The phone lists it as active, and the agent asks cards right away.
3. Each opening makes a new pager. An agent opens one pager for a piece of work and keeps it for every question in that work.
4. The owner can replace a number. The replaced number then opens nothing, and an agent that tries it is told to get a working number from the owner. Every pager already opened with it keeps working.
5. After a pager is open, the number plays no part: the agent acts with its own pager key, and the pager ends like any other (C22).

## Never

- A pager number the owner has replaced opens a pager.
- A pager number reads, answers or ends a pager.
