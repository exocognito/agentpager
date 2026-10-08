---
id: I5::answers-never-change
serves:
  - SI3
  - SI8
statement: A stored answer and its proposal never change, including feedback and every retry, and history offers no control that could change them.
caveats:
  - Nothing is proved about tampering with storage below the API.
---

Repeating a send with the same request id returns the stored receipt. Changing its input, or answering again with a new request id, is refused. An acknowledgement cannot be replaced.
