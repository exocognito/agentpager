---
id: L1::stdin-and-streaming-for-cold-clients
learnedIn: MSTART, simple-loop run 02 turn 1, 2026-09-26 (PR #40)
---

What happened: run 02 ran pi, Codex and Claude Code cold from the front page's line. A client started with stdin open hung, waiting for input that never came, and the tester could not tell that hang from an agent waiting on the owner. A client whose output was captured whole showed nothing until it exited, so the tester could not read the pairing link while the agent held its answer read open. The run turn exposed the confusion; the author of PR #40 confirmed the stdin hang with their own checks of the clients.

What a role does now: start every non-interactive agent client from an empty temporary directory with stdin closed (`< /dev/null`) and a bounded timeout, and stream its output so the pairing link is readable while the agent waits. The recipe's client lines carry this shape; a client that needs something else gets a note in the artifact saying what and why. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.
