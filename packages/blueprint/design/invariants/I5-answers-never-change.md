---
id: I5::answers-never-change
serves:
  - SI3
  - SI8
statement: A stored answer and the decision it answers never change, including feedback and every retry, and an answered decision offers no control that could change them.
caveats:
  - Nothing is proved about tampering with storage below the API.
---

Repeating a send with the same request id returns the stored receipt. Changing its input, or answering again with a new request id, is refused. An acknowledgement cannot be replaced.

One change was made on purpose: decisions stored before 31 Oct 2026 carried `kind` and an emoji on each option, and each was rewritten once without them when PR #33 took them off the wire (DEC-2026-10-30-v2-promises). Nothing else in them changed.
