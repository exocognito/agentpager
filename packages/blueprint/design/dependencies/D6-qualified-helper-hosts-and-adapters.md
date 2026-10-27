---
id: D6::qualified-helper-hosts-and-adapters
status: draft
providedBy: recipe
---

## Statement

The helper's setup, delivery and activity claims stand on explicitly qualified external agent runtimes and host environments, with each client capability and its limits recorded separately.

## Provided

1. A Linux x64 VM with Codex CLI and Pi, and a macOS arm64 host with Codex CLI and the Codex desktop coding-agent experience, installed and authenticated through owner-supplied legitimate access. Their exact OS, binary provenance, client and adapter versions, invocations and agent-backend locations are recorded by the recipe before approval; none is invented from a model's memory.
2. Native client interfaces capable of registering tools, preserving real session identity, delivering a follow-up answer without a model wait loop and reporting generation/tool-call/idle events. The helper and its adapters are product code, not supplied dependencies; client support is qualified against the actual interfaces they use.
3. A per-client matrix separates setup, answer wake-up and activity telemetry. A missing interface is an explicit unsupported capability and cannot satisfy a required case through transcript scraping, a fake event source or a manual prompt.
4. A host service mechanism that can keep the helper running after setup or terminal closure without requiring administrator privileges. The recipe records startup, shutdown, state placement, permissions and the effect of sleep/offline conditions. Client-required approvals remain visible to the owner.

## Never

1. Treat an installed executable or shared configuration file as proof of working desktop wake-up or telemetry, change global client configuration outside the owner-approved helper setup, or borrow credentials the owner did not supply.
2. Present Claude, another client, a new architecture or an unqualified version as supported merely because a protocol could theoretically connect it.

## Proof runs on

1. A real Linux VM with at least one simultaneous Codex CLI session and one Pi session, through one installed helper and the deployed relay, with one owning phone browser and independently paired sessions.
2. The macOS host with actual CLI and desktop sessions, through the same relay, testing setup, answer delivery and native activity evidence separately. Qualification records preserve failed attempts and identify any unsatisfied required case.
3. Existing no-helper HTTPS and remote-MCP paths against real clients, plus prior product regression proof. Host timing and vendor responses are not mocked; deterministic fault injection supplements rather than replaces the real client walks.

## Caveats

1. This draft names a proposed acceptance roster, not verified support. If a required client lacks a suitable API, revise the roster or design with the owner before activation; the builder must not silently weaken activity or delivery claims.
2. Virtualized and sampled hosts do not prove every OS, machine, account policy or future client version. Installing the helper on a laptop does not give it authority over a different VM or backend.
