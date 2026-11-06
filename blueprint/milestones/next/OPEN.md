# OPEN · AgentPager in the open

> **Status:** queued · **Order:** after SITE; its cleanup touches the same code as ENCRYPT, which is done by then; FRIENDS follows · **Publishing needs Sam's own go** · numbered when it starts

## Objective

Sam, 31 Oct 2026, on the next roadmap: cleaned-up code and Blueprint published on GitHub with a clean history, "so people can inspect code, fork and self-host". Sam's principle in the strategy, waiting here until it is true: "The code is open: anyone can read it, fork it and run their own".

In Sam's voice, as the old MOPEN doc had it:

Anyone can read AgentPager's code on GitHub, check what it does with their decisions, fork it, and run their own service and app. The repository starts with a clean history and holds no secret. Its code and Blueprint say only what is true now, with nothing left over from retired versions. A guide takes a developer from a fork to their own service on Cloudflare and their own build of the app. Every earlier promise still passes.

## What's known

- The repository is private today; /start tells an agent to ask its owner for access.
- M4 removed `docs/v2`, the workshop notes, the lessons, the parked web milestone and superseded plans from the tree; git keeps them at the tags `blueprint-old-format` and `history-archive`. It also moved the wire contract to `packages/contract` and the front page to `packages/app/src/site`.
- Built for self-hosters: the app's server address in iOS Settings, and the command's choice of server, which each agent's file keeps. In ENCRYPT's design, keys are made on the phone and on the agent's machine and never leave them, so a self-hoster needs nothing extra for encryption.
- Apple delivers alerts only from the team that signed the app, so a service someone else runs can't alert the TestFlight app.

## Still open

Sam decides these first:
1. The licence.
2. Where it lives: a new public repository, or this one made public, and under which owner.
3. What the clean history keeps: one first commit, or the existing history with secrets and retired work filtered out.
4. Alerts on a service someone else runs: a self-hoster builds the app under their own Apple team, or goes without alerts.
5. What the cleanup still removes after M4, for example the retired hosted MCP server's answer.

## Out of scope

- Support, contribution rules or a roadmap for other people's forks.

## Adds · Changes · Retires

- **Adds:** Sam's principle that the code is open, to [PRODUCT.md](../../PRODUCT.md), once it is published.
- **Retires:** what the cleanup removes, quoted here when it goes.

## Log

- 31 Oct · queued in the next roadmap.
- 5 Nov · Sam put it after SITE.
