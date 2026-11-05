# AgentPager

AgentPager makes it easy for me to leave my agents working on my computer or in a cloud VM and send owner decisions to my phone so they can continue to do useful work while I am away. It is an app on my phone that pages me when an agent needs me, the way a pager would.

## Principles

*Sketch: the hero features, guarantees and principles of today's STRATEGY.md, merged and in Sam's words. Each one's checkable detail moves to the line named in brackets.*

- I make pagers on my phone and give agents their numbers. Only agents I give a number reach me, and I can turn any pager off. [SC1, SI2, SI5 → C22, C25, C26, I17]
- When my agent needs me, my phone alerts me, even with the app closed. [SC2 → C17]
- A decision leads with the question; the rest is one tap away. Letters tell options apart, and ✶ marks the recommendation. [SP7, SP8 → C5]
- An answer takes two taps, and I have a few seconds to undo. The agent receives exactly what I sent, and only the agent acknowledges. [SI1, SI3, SI4, SI8 → C5, I5, I6]
- Text is refused whole, never truncated. [SI6 → I4, `values.ts`]
- Plain language, and the platform's own components. [SP1, SP6]
- Agents reach AgentPager only through the agentpager command, which holds the rules they write by. [SP5, SI11 → C25, C27]
- No accounts, no paid plans, and the code is open. [SP2]

## Pinned design decisions

Numbers only: no links, QR codes or emoji pairing. The agentpager command is the one home for the rules agents write by. A decision is written as card.yaml and compiled by the command. Encryption comes before the friends rollout. No Settings screen in the app: notifications and the server address live in iOS Settings. Notes are answers to one decision, never standing guidance for other agents.

## Goals

- I come back to finished work, not a question I never saw. Later, measure the stops prevented and the time or tokens unblocked. [SG1]
- An agent unsure about a risky step asks me instead of stopping or taking the risk. Later, measure fewer bad decisions and unnecessary stops. [SG2]

## Stack

- A Cloudflare Worker at agentpager.me, with one SQLite Durable Object for the pagers and one per agent.
- A native SwiftUI app on iPhone.
- The agentpager command, built with Bun into one file: a command line and a local MCP server.
- TypeScript with Effect Schema for the wire contract, which the service and the command import.

## Milestones

A milestone gets its row when Sam commits to it. Rows with the same order run in parallel. Status: queued · planning · designing · building · done · dropped.

| Order | Milestone | Status |
| --- | --- | --- |
| — | MAPP · AgentPager on my iPhone | done |
| — | MPAGERS · Pagers on my phone | done |
| — | MCOMMAND · The agentpager command | done |
| 1 | MENCRYPT · Decisions the service can't read | planning |
| 1 | MINSTALL · AgentPager installs in a minute | planning |
| 1 | MSITE · A front page for AgentPager as it is now | planning |
| 2 | MOPEN · AgentPager in the open | queued |
| 3 | MFRIENDS · AgentPager for people I invite | queued |

## Roadmap

Nothing else is planned. A feature joins the roadmap when owners using AgentPager, Sam included, show they need it.
