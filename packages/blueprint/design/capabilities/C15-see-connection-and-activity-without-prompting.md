---
id: C15::see-connection-and-activity-without-prompting
status: draft
serves:
  - SG1
  - SP6
---

## Statement

The owning phone shows whether each helper-connected agent session is live or unreachable and, when known, whether it is thinking, in a tool call or idle, without prompting the model or exposing its content.

## Behaviors

1. Only the phone browser already paired and authorized for that session may read its status; an unpaired claimant gains no status access. Connection and activity are separate: live requires fresh evidence that the helper can reach the relay and that the adapter remains connected to that agent session. Another session on the host being live is not sufficient.
2. A connection report older than 15 seconds is no longer shown as live. The owner sees unreachable and the last observation time; before any evidence, or when the phone cannot obtain fresh state, the view says unknown or stale rather than diagnosing the remote agent as unreachable.
3. A qualified adapter maps native runtime events to thinking (model generation), tool call or idle. The status includes no thought text, prompt, transcript, tool arguments or tool result. Missing, unsupported or incoherent activity evidence is unknown, not inferred idle.
4. Viewing or refreshing status reads the last observed state and its freshness. It never queues a prompt, triggers model inference, approves a tool or resumes work.
5. Ending, expiry or agent finish follows the existing terminal lifecycle. A finished session is shown as finished, never live simply because the helper still runs, and an ended/expired session cannot report new activity.
6. The complete decision flow works without helper telemetry. Non-helper sessions show status unavailable; they are not called unreachable merely because they use remote MCP.

## Caveats

1. The 15-second freshness threshold is a proposed owner-visible policy, not an observed performance result. No real-time claim is made while the phone cannot refresh.
2. Live means recently reachable, not healthy or making progress. Thinking reports a runtime phase, not the content or quality of reasoning.
3. Activity fidelity depends on qualified host APIs; absence of an event is not proof of idleness. A helper heartbeat alone proves neither agent connectivity nor activity.
