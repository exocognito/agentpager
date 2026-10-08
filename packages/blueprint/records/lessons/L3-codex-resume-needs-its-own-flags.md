---
id: L3::codex-resume-needs-its-own-flags
learnedIn: MSTART, simple-loop run 03 builder turn 1, 2026-09-26 (PR #45)
---

What happened: the builder tried to continue a Codex conversation with `codex exec resume --last` in the test directory. Codex refused: "Not inside a trusted directory". Passing `-s` as on the first call failed too, because `resume` takes no `-s` flag; sandbox settings go through `-c`. PR #45 then ran the resume lines for all three clients on the host and wrote them into the recipe.

Historical invocation from that run: continue a client in the directory it started in. pi: `pi -c -p "ANSWER"`. Claude Code: `claude --resume <session id> -p "ANSWER"` with the same flags as the first call. Codex: `codex exec resume --last --skip-git-repo-check -c 'sandbox_mode="workspace-write"' -c sandbox_workspace_write.network_access=true "ANSWER"`.

Current invocations belong to the [recipe](../../../../recipe.json), selected for the client's access mode. Keep the current [D2::agent-clients](../../design/dependencies/D2-agent-clients.md) cold-arrival conditions across resume; do not enable HTTPS for an MCP-only sample by copying the old command above. The lesson is that start and resume flags differ, not that every client should use the historical flags.
