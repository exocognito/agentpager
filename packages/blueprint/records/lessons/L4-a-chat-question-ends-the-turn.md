---
id: L4::a-chat-question-ends-the-turn
learnedIn: MSTART, simple-loop run 02 reviewer turns 2 and 3, and run 03 builder turn 1, 2026-09-26 (PRs #42, #43, #45)
---

What happened: in run 02 a cold pi read `/start`, asked the owner in chat which way in to use, and ended its turn. Claude Code waited on the owner until its pairing link expired. Codex asked its question in chat instead of through OwnerPager. In run 03 agents sent their question through OwnerPager and then ended the turn before the answer came, and the builder's first fix was to resume every such client. A non-interactive client ends its turn whenever its agent asks anything in chat; nothing resumes it on its own, so how the tester answers decides the result.

What a role does now: treat a turn that ends on a chat question as what the owner would see. When the agent asks for something `/start` tells owners to do, such as adding the MCP server, do it, answer briefly and only what was asked, and continue the same conversation. When the agent asks its question in chat instead of through OwnerPager, say only "please send it to my phone" and record it. When it ended after sending through OwnerPager but before it had the answer and acknowledged it, record a failure for that client and do not resume it to rescue the run. When the pairing link expired, open the replacement the agent shows. Never explain how OwnerPager works. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.

Now held by: [D2::agent-clients](../../design/dependencies/D2-agent-clients.md) owns the cold arrival's owner steps and the never-rescue rule; this file is history.
