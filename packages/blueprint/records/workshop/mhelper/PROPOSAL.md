# Proposal: MHELPER after MCARDS

Status: exploration, not approved design or build authorization. Base: AgentPager origin/main `a7ba1792d2461919ed6ca82fff353afa2a1effa5`, verified against GitHub main. [Open the HTML review](proposal.html). [Draft milestone](../../../roadmap/milestones/MHELPER.md).

## Recommended product shape

Keep the complete remote HTTPS/MCP decision flow as the base. An optional helper is one installation on the machine where supported agents run. Guided setup connects selected clients, preserves unrelated settings and reports capability support honestly. Each agent keeps its own paired session, cards, lifecycle and credentials. The same phone browser can list these independent sessions; there is no shared machine-wide authority or merged decision queue.

The helper waits outside the model and delivers only answers to existing decisions. Idle supported sessions can continue; busy sessions wait for a safe turn boundary. The phone can read connection state (live/unreachable, with unknown/stale when evidence is absent) and native activity (thinking/tool call/idle, otherwise unknown). Reading status never sends a prompt or consumes an inference turn. Existing written feedback is still a bounded answer attached to its decision, not a separate task channel.

No arbitrary phone instructions, status-summary prompts, remote shell, steering, native permission approvals, process restart or machine wake are added. Installing a binary does not grant those powers implicitly.

## What the owner has settled

1. The helper is optional progressive enhancement. Remote MCP may long-poll and must support the complete decision flow without it.
2. One setup should streamline several supported agents on a laptop or spike VM. Client consent and per-session identity still matter.
3. Phone-visible status is connection and activity telemetry only, not an invitation to prompt the model for a narrative update.
4. The phone answers existing decisions; it does not initiate arbitrary instructions. The earlier research direction that promoted installed integration over the base or explored unsolicited chat is superseded for this proposal.
5. C2's no-wake wording is not a hard requirement against enhancement. It describes the existing installation-free path.

## Proposed Blueprint packet

| Layer | File | Role |
| --- | --- | --- |
| Strategy | SP6 in STRATEGY.md | Draft progressive-enhancement stance, preserving existing active entries. |
| Roadmap | MHELPER after MCARDS | Proposed order only; milestone remains draft and has no runnable deliverables selection. |
| Capability | C13 | One owner-selected setup for several clients; no-helper parity. |
| Capability | C14 | Exact existing-answer continuation and honest delivery states. |
| Capability | C15 | Fresh connection/activity telemetry with no model call. |
| Invariant | I9 | Closed owner-channel authority; no general instructions or permission bypass. |
| Invariant | I10 | Session/proposal binding, bounded retries, expiry/revocation and credential handling. |
| Dependency | D6 | Real host/client qualification and an explicit support matrix. |
| Metric | K2 | Proposed native turn-start latency, kept separate from K1's held-read latency. |
| Journeys | J3, J4 | Multi-client setup and independent decisions; reconnect, misuse and lifecycle isolation. |
| Terms | Draft helper terms | Shared vocabulary without changing the existing Session or Agent identities. |

New C/I/K/D/J promises and new strategy/term entries are draft. Active MCARDS selections, schemas, machines, effects, screens, recipe and runtime code are unchanged. MHELPER omits `deliverables` intentionally because a runnable milestone must select active promises; its numbered Proposed deliverables list is the exact future selection for owner review. Before activation, approve/promote selected statements and required items, fill the real block, and pass the design/verification gates. Neither an empty selection nor status changes alone authorize a build.

## Concrete owner walk

1. On a fresh Linux VM, install one helper and choose its Codex CLI and Pi integrations. See exact intended changes, perform vendor-mandated consent, and get separate setup/delivery/status checks.
2. Start two agents. Each pairs independently to the same phone browser. Observe which session is live and whether each native runtime is thinking, in a tool call or idle.
3. Let each agent post a decision and finish its current turn. Answer them out of order, including feedback. Only the originating sessions continue and each agent acknowledges its own answer.
4. Restart/disconnect the helper and observe truthful freshness and delivery uncertainty. End one session before reconnection; its pending authority never revives. The other continues.
5. Repeat a fresh complete remote-MCP exchange without using local helper tools. The helper is not necessary to use AgentPager.

## Suggested implementation boundary, not yet executable design

Use a small helper core with per-session bindings and thin client adapters. The agent's local tools can use stdio MCP; the helper can initially reuse existing outbound HTTPS held reads. No inbound command listener or WebSocket rewrite is required to prove continuation. A single binary is the distribution goal; Bun is one candidate, not an owner-mandated runtime. Installing the helper does not mean no client extension or consent can ever be required; guided setup owns those supported-client steps and makes them visible.

The ordinary local state is a client setup record, independent session bindings, pending decision/proposal identities, durable delivery outcomes and observed activity freshness. Cloud Durable Objects remain authoritative for sessions/cards. The helper keeps only the local state needed for delivery and telemetry and clears content/credentials according to the existing lifecycle. A helper must be installed on the VM running the agent, not merely on an unrelated laptop.

The phone protocol adds status reads only. It gains no generic send-message endpoint. An answer event identifies a known decision, proposal, answer and session. The adapter receives a locally selected session target and opaque answer reference, not a cloud-supplied command/path. Its fixed retrieval operation returns the exact stored answer. Post/answer/acknowledgement and lifecycle remain separate from local connection/activity events.

Schema/machine design must distinguish unbound, bound, pending, verified, submitted, uncertain, acknowledged and invalidated delivery states, plus unknown/live/unreachable connection and unknown/thinking/tool-call/idle activity. Not every cross-product is legal: terminal sessions cannot stay live, and queued/uncertain is not acknowledged. These are design requirements to derive from the promises, not a claim that types or transitions already enforce them.

## What gets reversed or clarified

| Existing source | Proposed treatment | What stays |
| --- | --- | --- |
| DEC-2026-09-26-agent-reach rejects a helper because curl/MCP do the same | Preserve history; a new owner approval record would supersede that rationale for optional setup, telemetry and native continuation. | HTTPS/MCP reach and the complete base flow. |
| C2 caveat says no helper/adapter and no wake | Scope the caveat to the installation-free path. | C2's pairing and complete exchange promise. |
| SP2 describes only service access | Add an optional local connection layer without changing per-session ownership. | One agent and one phone per session; same cloud service. |
| D1 says the product runs in the cloud and nowhere else | Scope that placement to the cloud relay; identify optional local helper processes. | Worker/DO authority, deployment identity and session storage boundary. |
| D2 prohibits client-global changes for a cold test | Keep that prohibition for the no-helper cold arrival; qualify owner-selected helper setup separately under D6. | Unqualified facilities never count as supplied. |
| Existing home/lifecycle/feedback decisions | No reversal. | Several independent rows in one browser, per-session pairing, 24-hour lifetime, explicit Send/Undo, immutable answers, agent-only acknowledgement and feedback attached to a decision. |

[contract-amendments.patch](contract-amendments.patch) contains exact candidate changes to existing SP2, C2, D1 and D2. It is review material, not applied to those active entries. It is a zero-context patch: validate it against this exact proposal tree with `git apply --check --unidiff-zero packages/blueprint/records/workshop/mhelper/contract-amendments.patch` before any deliberate application. It deliberately does not promote drafts, fill MHELPER's deliverables, or represent a complete activation/pin operation. Original decision records remain untouched; only the owner's later approval can establish a superseding decision.

## Assumptions for explicit owner review

| Choice | Concrete proposal | Why it needs approval |
| --- | --- | --- |
| Client/host acceptance roster | Linux x64 VM: Codex CLI + Pi. macOS arm64: Codex CLI + Codex desktop. Claude and other clients are unpromised until separately qualified. | This exercises both multi-family setup and a desktop surface, but is not verified feasible support. Narrow the roster rather than fake missing APIs. |
| Status freshness | 15 seconds maximum before a connection loses live status; unknown/stale when the phone itself lacks fresh data. | This is a proposed product timer, not a measured bound or evidence of battery efficiency. |
| Continuation latency | Five seconds from committed answer to native turn start when idle; five seconds after the safe idle boundary when busy. | Native scheduling is distinct from K1's one-second delivery to a waiting caller. |
| Per-agent authorization | Keep independent pairing per session; one install configures clients but does not silently authorize future sessions. | One machine-wide pairing would be a separate identity/ownership change. |
| Relay trust | For the bounded helper proposal, retain the current trusted, plaintext-readable relay; require explicit acceptance before automatic-delivery activation. | A malicious relay can forge an answer within this trust model. No cloud-compromise resistance is claimed. If that is unacceptable, design end-to-end authenticity and independently trusted phone code before promoting C14/I10. |

End-to-end confidentiality is a separate decision from message authenticity and helper distribution. Native phone installation, push delivery and removing three-second foreground browser polling are also separate work. This proposal does not imply that any of them already exist or include them as hidden prerequisites. A future untrusted-relay design must address bootstrap/key substitution and the server-delivered browser-code trust boundary; adding a signature field alone does not solve it.

## Work remaining before an approved build input

1. Agree the assumptions above and reconcile exact amendments with SP2/SP5, C2, D1/D2 and the historical reach decision. No arbitrary-instruction path may reappear as a fallback for missing client APIs.
2. Qualify real registration, session identity, safe continuation and activity APIs per target; record provenance and versions. Report unsupported features rather than scrape transcripts or ask a model to infer status.
3. Design the installation/disable flow, support matrix, status presentation, delivery uncertainty and revoked/terminal views. A source/architecture report is not a reviewed product screen; produce playable design stories before pinning.
4. Add typed schemas, machines, effects and routes for the helper/status boundary while preserving current remote MCP/HTTPS behavior. Keep model parameters, execution settings and arbitrary destinations out of the owner protocol.
5. Derive bounded TLA+ and closure checks, enforcement/coverage mapping and real-product verification from the approved promises and design. Include cross-session spoofing, replay, crashes at submission boundaries, status freshness, rejected unsolicited messages and end/expiry races. No formal/model result or runtime proof exists in this packet.
6. Review and pin one exact cumulative packet with the owner. Add the full approved deliverables block and change MHELPER's status only when eligible. A completed milestone still needs a real product walk; no self-merge or background launch is authorized here.

## Verification of this proposal

The proposal review checks file/reference integrity, draft status, active-contract preservation, exact patch applicability and HTML presentation. Those are documentation checks, not proof that a helper, native wake adapter, phone push system or secure cryptographic channel works. This proposal is independent of the earlier research PR and starts from origin/main, so that research history cannot accidentally become an approved runtime contract.
