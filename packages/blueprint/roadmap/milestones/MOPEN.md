---
id: MOPEN
title: AgentPager in the open
status: draft
deliverables:
  - D1::cloudflare
  - D6::iphone-app
  - D7::apple-developer-program
---

# MOPEN · AgentPager in the open

## Objective

Anyone can read AgentPager's code on GitHub, check what it does with their decisions, fork it, and run their own service and app. The repository starts with a clean history and holds no secret. Its code and Blueprint say only what is true now, with nothing left over from retired versions. A guide takes a developer from a fork to their own service on Cloudflare and their own build of the app. Every earlier promise still passes.

## Out of scope

- Support, contribution rules or a roadmap for other people's forks.

## Sam decides first

- The licence.
- Where it lives: a new public repository, or this one made public, and under which owner.
- What the clean history keeps: one first commit, or the existing history with secrets and retired work filtered out.
- Alerts on a service someone else runs. Apple delivers alerts only from the team that signed the app, so someone else's service can't alert the TestFlight app. A self-hoster builds the app under their own Apple team, or goes without alerts.
- What the cleanup removes, for example `docs/v2/`, the workshop notes, the parked web milestone and the retired hosted MCP's answer.
