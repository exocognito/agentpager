---
id: I22::a-broken-card-is-never-sent
serves:
  - SI6
  - SI11
statement: A card that is broken in structure never leaves the agent's machine; the agentpager command refuses it before sending, with one line per problem.
caveats:
  - An agent that calls the service directly skips the command. The service then refuses only what breaks its own contract (I4).
  - Once decisions are encrypted (C30), the service can no longer read a card to refuse it, and the command's check is the only one.
---

Broken in structure means what can be checked without judging the writing: the card does not parse, misses a required key or has an unknown one, has fewer than two or more than four options, names an image or page that is not attached, puts a line break in a one-line field, or is over a limit (SI6). The command also holds the brief it compiles to the service's own contract, so nothing the service would refuse leaves the machine. Nothing about how a card is written is refused (C27).

The service refuses whole whatever breaks its contract (I4), but it allows the detail up to 1,000 characters, not 280, and does not check that one-line fields are on one line.

**Breaking this looks like:**
1. a broken card that the command sends;
2. a card refused for how it is written;
3. a card cut or changed to fit a limit.
