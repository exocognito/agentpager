---
id: I10::helper-delivery-stays-bound-and-bounded
status: draft
serves:
  - SI3
  - SI4
  - SI5
  - SI8
  - SP6
---

## Statement

A helper delivers only authorized, unexpired answers to their locally bound agent session and exact proposal, preserves delivery uncertainty across retries and restarts, and cannot revive ended or finished authority.

## Clauses

1. Local binding fixes the helper host, client instance, real agent-session identity, AgentPager session and pending proposal identity. A remote message cannot choose an executable, path, environment, prompt template or a different session binding.
2. Before submission, the helper validates the authorized answer, decision and answer IDs, proposal identity, session lifecycle and freshness against the bound state. Unknown, modified, cross-session, revoked or over-limit inputs are refused whole.
3. Duplicate notifications and repeated reads converge on one delivery record. A crash or timeout between submission and receipt is uncertain unless the adapter can establish a safe outcome; the helper does not blindly queue it again. Queue acceptance never fabricates an agent acknowledgement.
4. End, expiry, finish or explicit local disconnect invalidates pending continuation. The helper rechecks lifecycle before any new submission, clears local payloads/credentials when the existing retention contract requires it, and does not rebind the session automatically on restart. Input already accepted by a runtime cannot be claimed to have been recalled.
5. The helper uses only scoped local communication and outbound relay connections; it opens no remotely reachable command listener. A client adapter invokes only a locally authorized integration with structured parameters, without shell interpolation of remote content.
6. Relay credentials are absent from model tool arguments, process arguments and routine logs in the helper path. Status carries only state/time metadata. Resource and retry bounds are enforced locally as well as by the service and reviewed before activation.

## Caveats

1. Unless the owner chooses and approves a separate end-to-end authenticity design, the relay remains trusted to authenticate owner answers and see plaintext. This invariant does not survive a malicious relay fabricating an otherwise valid answer. TLS is not an end-to-end owner signature.
2. A service-delivered browser client is also part of that trust boundary. Keeping keys on a phone does not remove the relay from trust if it can replace the code using them.
3. Expiry/revocation prevents subsequent submissions; it does not undo input already accepted by the agent or external actions already performed. Exact business-action-once behavior remains the agent/tool system's responsibility.
4. OS/runtime compromise and provider backups are not covered. Credential containment from model context is not isolation from unrestricted same-user code.
