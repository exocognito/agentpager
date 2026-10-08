# Fetch-only host invocation — proposal from the stack spike

Status: adopted 2026-10-02. Sam approved moving it onto the MCARDS baseline after [DEC-2026-10-01-mcards-first](DEC-2026-10-01-mcards-first.md) dropped MSTART. This record does not accept MSTART or MCARDS.

## Failure observed

The MSTART spike began from main after PR89, with no lessons and no previous app or app history reachable on the cleanroom VM. Source pin: 7ddaad1d004f95cab07af3347a8592444f060b7f; cleanroom root: 3bac9e105ee78aaaad58b081927d5e3bd4a84e71; run: ownerpager-simple-20260930-01.

On Codex 0.158.0, the recipe's network-disabled candidate invocation could not fetch /start: DNS resolution failed. It still exposed shell commands. Both the builder and the independent reviewer reproduced the qualification failure. Enabling native search while disabling shell also left no usable retrieval tool on this exe.dev route.

## Proposed repair

The recipe owns the exact commands. Use the upstream mcp-server-fetch package as a GET-only host facility, with a pinned version and dependency age cutoff. Remove shell, browser, app and plugin execution routes; use a read-only sandbox; preserve the restrictions on same-conversation resume. Add OwnerPager only after the agent asks for its documented owner setup, using session-scoped configuration. Keep MCP approval settings session scoped. Exclude harness context and session pointers from cold-client environments.

E13's “no server configured” means no OwnerPager server configured. The generic fetch facility exists before arrival. The agent still cannot send an OwnerPager exchange over direct HTTPS, before or after setup. This wording clarification needs owner approval with the recipe change.

## Operator qualification

The operator ran separate probes outside the live loop; no running workspace or pinned input changed.

- Codex fetched example.com through the upstream fetch server. Its installed implementation uses HTTP GET and exposes URL, length, offset and raw-content arguments, with no method, arbitrary headers, shell or POST interface.
- The same conversation resumed with OwnerPager tools added by command-line configuration. Fetching /start still worked. A requested file creation failed with the actual read-only sandbox rejection; no file appeared. The global config checksum stayed unchanged.
- A fresh cold session received only the public agent instruction line and E13's two-option request. It requested connector setup. The operator added it to that session and replied only “Added.” The agent paired, asked a two-option question through MCP, reported the exact answer “Clarify first” and acknowledged it. The same 390 px Chromium context showed the acknowledgement. Exit 0 after 141.105 seconds from the first prompt.
- The agent omitted the QR image from its text and asked for restart/reopen. The operator resumed the same conversation only for the explicitly allowed setup step. Retain these limits for review; this is not a claim that every cold-arrival promise holds.

Raw invocations, events, boundary result and screenshots remain under the operator record at `/Users/smcllns/blueprint-runs/ownerpager-stack-20260930/host-qualification-fetch/` and `host-cold-fetch/`, and on the preserved VM. These are qualification records for the proposed invocation. They do not replace the current loop's E13 proof or permit a pass on its original pin. A repaired pin must run the ordinary builder, rerun and independent reviewer; M2 must retain all M1 regressions.

## MCP startup race

Observed 2026-10-03 in run ownerpager-simple-20261003-01 on the 2-core cleanroom VM. A fresh fetch-only start listed its tools, found no fetch and asked the owner instead of reading /start. Codex 0.158.0 starts MCP servers in the background and does not wait for them before the first turn. Under CPU load the fetch server was often not ready.

Operator probes ran outside any run, with four busy loops loading the VM's two cores, and listed each start's tools:

- Without `required`: fetch present in 2 of 3 starts, 5 of 6 with an installed copy of the fetch server, and 2 of 6 with `startup_timeout_sec=60`.
- With `required=true` on every server: fetch present in 18 of 18 starts, 6 of them with no installed copy of the fetch server. Both fetch and OwnerPager tools were present in 6 of 6 resumes against https://agentpager.me/mcp.
- A required server with a missing command made Codex exit 1 with "required MCP servers failed to initialize", before any agent message.

The recipe now sets `required=true` on every MCP server in the fetch-only start and resume.

## Source bootstrap fixes

The same proposal fixes the root deploy:app dispatch to invoke the app's script. A temporary workspace regression reproduced pnpm's unrelated built-in deploy error before the fix and reached the harmless fixture script after it. It never deploys a Worker. The recipe also records the runtime's supported compatibility date, as observed in the first scaffold's retained startup error. The ordinary M1 reviewer accepted both implementation repairs.

The first paired PR review found that the proposed resume command used --last while qualification used an exact session ID. The recipe now carries the start event's thread_id into resume, matching the qualified flow. The next exact-head review includes this correction, the deployment regression and the refreshed gap record.

The spike recipe also chose between /mcp and /cards/mcp. MCARDS has one product surface, so the recipe now names only https://agentpager.me/mcp. The host qualification exercised that endpoint.

E13 now lives in [E5::start-page-suffices](../../design/v1/evidence/E5-start-page-suffices.md) as its `cold` case, since #104 consolidated the evidence.
