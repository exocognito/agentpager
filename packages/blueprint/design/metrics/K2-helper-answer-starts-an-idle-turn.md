---
id: K2::helper-answer-starts-an-idle-turn
status: draft
serves:
  - SG1
  - SP6
method: probe
staleAfterDays: 7
---

## Statement

On qualified awake, connected helper/client combinations, an existing answer starts an idle agent's next turn promptly without model polling, and a busy agent receives it promptly after its next safe idle boundary.

## Probe

1. Record candidate, host/client/adapter versions, target, network, local binding and runtime event timestamps. Use D6's real environments and the deployed relay, with production timing policy.
2. For each required client/host combination, perform five idle-session and five busy-session exchanges. Record committed answer acceptance after Undo, the runtime's safe idle boundary where applicable, native turn start, the agent's answer read and explicit acknowledgement.
3. Report every sample and failure. Confirm the agent had no waiting tool open; distinguish transport receipt, queue acceptance, actual turn start and agent acknowledgement. Pairing and inference completion time are not relay latency.
4. Run K1 separately for the no-helper held-read caller. Passing K2 cannot replace the older waiting-agent proof or imply that the phone is background-notified.

## Bar

Every idle sample starts a native turn within five seconds of committed answer acceptance. Every busy sample starts the answer turn within five seconds of the runtime's next safe idle boundary after acceptance. Every sample reads the exact answer and emits an explicit acknowledgement; any wrong session, duplicate answer turn or error fails. These proposed thresholds apply only to the sampled qualified combinations, not offline/exited runtimes or all networks.

## Caveats

1. The five-second thresholds are proposed for owner review, not measurements. Five samples per case are a smoke bar, not an availability or battery-life guarantee.
2. Work already accepted into a runtime, queue congestion, host sleep and expired authentication have separate lifecycle outcomes; no process restart or machine wake is measured.
