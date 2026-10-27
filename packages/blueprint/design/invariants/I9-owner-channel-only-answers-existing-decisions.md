---
id: I9::owner-channel-only-answers-existing-decisions
status: draft
serves:
  - SP6
---

## Statement

The helper exposes no phone-to-agent instruction channel: it returns answers to existing decisions and serves content-free status without expanding execution authority; existing pairing and session controls retain their own contracts.

## Clauses

1. A phone-originated request that would deliver input to an agent must name an authorized open decision and its exact proposal. A message without that binding, a different target agent, or a request type outside the closed answer protocol is refused before an adapter is invoked.
2. Written feedback remains an answer to that decision under C6. The protocol has no independent chat, task, status-prompt, steer, shell, file-write, process-launch or tool-permission operation.
3. Status reads only observed connection/activity state. They never ask an agent to summarize its work or consume an inference turn.
4. The helper neither changes agent sandbox/approval settings nor auto-approves native permission requests. An answer on an AgentPager card is not a native tool grant.
5. Installing or configuring the helper never installs arbitrary remote-specified code, accepts a client trust prompt, authenticates a client, or starts an agent task on the owner's behalf.

## Caveats

1. Authenticated feedback may still influence an agent with its existing permissions. A closed transport schema is not semantic confinement of model behavior or a read-only model sandbox.
2. A compromised owner endpoint can submit valid answers in its authorized scope. Hostile same-user code, compromised client runtimes and a compromised installer/update signer are outside this invariant's assurance boundary.
