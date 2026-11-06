# STORE · One store per pager

> **Status:** queued · **Order:** after ENCRYPT, before CLIENTS · numbered when it starts · its word is M5's question 7

## Objective

Three of the hardening items the 30 Oct engineering review held for ENCRYPT, which Sam split off on 6 Nov into their own milestone, right after it (DEC-2026-11-06-store-after-encrypt):
- **One writer per pager:** one store per pager, holding its row, its agents and their decisions. This is what closes L10, a call that lands as the pager turns off.
- **Smaller polls,** both of them: the phone reads one object per pager instead of one per agent, and a waiting agent is woken when its answer arrives instead of checking storage every 100 ms.
- **The agent's lifecycle:** connected, finished, idle, forgotten, and deleted with its pager, as one state machine. Finishing closes the agent's open decisions, so they can't be answered (Sam's answer to the question put on 6 Nov, recorded in [M5-encrypt.md](../M5-encrypt.md), question 5).

## What's known

- **Today** a pager's state lives in two places: the pager's row in the one Registry for all pagers, and each agent's own store, which checks the Registry on every call that sends something. On each machine every agent on a pager appends to one history file.
- **L10:** a call the service has already checked against its pager when the owner turns the pager off still lands. One writer per pager makes the switch and the call one sequence.
- **The phone's poll:** while open, the app reads each of its pagers every 3 seconds, and each read asks every agent on that pager.
- **The agent's wait:** while an agent waits for its answer, the service checks for it every 100 ms, up to 50 seconds a call.
- **Finish today** stops new asks, and the agent's open decisions stay answerable, though no agent will pick up the answer.
- PRODUCT.md › Stack says the service has one Durable Object for the pagers and one per agent. One store per pager changes that sentence, which only Sam changes.
- After ENCRYPT, the service stores only encrypted parts and what it needs to route them, so the move is of ciphertext and routing data.

## Still open

Sam decides these first, at its Plan:
1. Moving to one store per pager moves what ENCRYPT stored: whether that move must keep every agent and decision (METHOD's rule), as recommended, or may start again.
2. What the phone shows for a decision that finishing closed, and what an agent that waits on it is told.

## Out of scope

- New features for owners: the milestone changes how the service keeps and reads a pager, and what finishing does to open decisions.

## Adds · Changes · Retires

- **Changes:** B25.13 and B5, for what finishing does to open decisions; PRODUCT.md › Stack, if Sam agrees.
- **Retires:** L10, turning a pager off can let one call through (1 Pagers).

## Log

- 6 Nov · queued: Sam split three of ENCRYPT's hardening items into this milestone, to run right after ENCRYPT and before CLIENTS.
