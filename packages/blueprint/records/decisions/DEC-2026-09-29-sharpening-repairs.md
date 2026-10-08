---
id: DEC-2026-09-29-sharpening-repairs
date: 2026-09-29
decidedBy: Sam
basis:
  - review of merged PR80–82 using PR83 at 15e7c363bb7074a23a54f1ec384b6d8a9974b177
  - Sam approved all seven recommended choices with lgtm
---

The review compared the merged Blueprint with pre-80 revision `1a4fa51c4a8e0e52237da964b302ddf4d2b582ec`. Sam chose targeted repairs, preserving the ownership work, and kept PR71 unmerged. Approval authorized a repair PR, not a product run or deployment.

The chosen outcomes were:

- Keep decision and history views live while preserving a prepared answer. C7 and the phone machine hold the resulting behavior.
- Keep the inbox row in its waiting state before acknowledgement; show the exact answer in opened history, then in the row after acknowledgement. C3/C4 and E7 hold the sequence.
- Disable Send for invalid Other text and explain why, leaving the draft intact. C3 and the screen hold the interaction; Text owns validity.
- Keep the emoji-and-label row as the selection target, with a separate detail control. SP3 now describes that intent.
- Require one emoji, including supported combined sequences within the existing bound. The schema owns the value check.
- Restore the official MCP SDK and Codex regression samples in E12 and the Chromium/390 px condition in E13. Keep the fixed host roster rather than restoring random sampling.
- Use honest uncertainty copy after a failed reply: “Could not confirm your answer was sent. Your draft is still here.” and “Could not confirm the session ended.” The UI owns those words.

The approved repairs also retain the existing last-message deadline, correct unit checks that had not answered their current question, separate cross-request visibility from storage-placement proof, ship the shared evidence contract and reconcile placement guidance by fact ownership. Current obligations live in the design/process sources, not this record.

The MCP-only host qualification, blind pre-80 calibration and PR71 integration remain separate work. No result from this decision or the design checks proves a deployed product.

Later: [DEC-2026-10-01-mcards-first](DEC-2026-10-01-mcards-first.md) removed C3, C4 and E7 and replaced the phone machine with the card machine; its table names where each removed id went.
