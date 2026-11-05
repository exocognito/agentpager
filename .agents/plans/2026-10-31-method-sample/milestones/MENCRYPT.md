# MENCRYPT · Decisions the service can't read

Status: planning.

## Objective

My decisions, their attachments, my answers and my agents' acknowledgements are encrypted between my agent's machine and my phone, and the service carries only ciphertext and what it needs to route it. The agentpager command checks my pager's key against its number before it encrypts anything to it. Alerts still show me the real question: an extension on my phone decrypts them.

## Out of scope

- Hiding which pager and which agent, when, and how big each part is.
- Moving a pager's keys to a new phone, or recovering them (L9).

## Owner decides first

1. Decisions stored before the switch: (a) ★ deleted at the switch, since only Sam's own pagers hold any; (b) kept readable until the service forgets them as usual (I17.6).
2. An agentpager command from before the switch: (a) ★ refused, with the line that updates it (MINSTALL); (b) keeps working unencrypted until a set date.

## Adds

Written as they are agreed in design: the encryption capability (today's C30 behaviours 3 to 6), the service-holds-nothing-readable invariant (today's I20) and the command's key check (today's I19, tagged part).

## Changes

C17's alert clause, to say alerts carry ciphertext that an extension on the phone decrypts. The old line is quoted here when it changes.

## Retires

L11, quoted here when it goes.

## Where it lives

| Layer | Source | View |
| --- | --- | --- |
| Wire contract | `packages/blueprint/design/schemas/exchange.ts` | `generated/protocol.md`, to add |
| Storage | `packages/app/src/agent.ts` | `generated/data.md`, to add |
| Command | `packages/cli/src/` | walks, to add |
| iPhone app and its extension | `packages/ios/` | `generated/screens/` |

## Log

Nothing yet.
