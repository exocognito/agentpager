---
id: C13::set-up-supported-agents-with-one-helper
status: draft
serves:
  - SP5
  - SP6
---

## Statement

An owner can install one optional helper on an agent machine and use its guided setup to connect several supported agent clients there, while agents without the helper retain the complete remote HTTPS or MCP decision flow.

## Behaviors

1. Setup lists supported clients it finds, what each connection would change and any required client approval or restart. The owner chooses which clients to configure; merely discovering a client grants no authority.
2. One installation serves several client sessions on that machine. Repeating setup does not duplicate entries, replace unrelated settings or reset existing sessions. A failed or partial setup names what succeeded, what did not and how to undo the helper-owned changes.
3. Supported clients receive the AgentPager tools and usage guidance without the owner copying a server URL or editing files by hand. Client-required consent and authentication are surfaced, never bypassed; a missing prerequisite fails clearly.
4. Verification reports setup, delivery and status support separately for each selected client/version. A written configuration is not reported as a working connection until the relevant exchange succeeds. Setup verification creates no agent task; delivery stays unverified until a bound real-decision exchange demonstrates it.
5. Each agent session pairs independently and appears under its own agent/session name in the owning phone browser. The helper never shares a session or its credentials between agents merely because they share a host.
6. Disabling one client connection stops its helper integration and removes only changes setup recorded owning; other clients continue. A user-edited or ambiguous entry is reported for manual resolution rather than overwritten.
7. Without any helper installed, the owner can still pair, answer offered options or feedback, receive the agent's acknowledgement and revisit history through remote MCP or HTTPS. There is no helper prerequisite hidden in that path.

## Caveats

1. The support claim is limited to D6's recorded client, host and version combinations. Newly installed clients may need setup rerun, and already-running clients may need reload/restart.
2. One installation does not remove per-session phone pairing, vendor authentication or client-mandated trust prompts.
3. The helper is a same-user integration, not isolation between mutually hostile local processes or users.
