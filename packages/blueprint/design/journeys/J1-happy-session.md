---
id: J1::happy-session
for:
  - C1::pair-a-phone-by-qr
  - C2::agent-starts-from-one-url
  - C5::review-and-answer-cards
  - C7::revisit-decisions
  - C8::home-lists-this-browsers-sessions
  - I6::send-and-acknowledgement
statement: An agent starts from the public instructions, pairs, asks two cards and hears both answers, and the owner finds the session again from home.
caveats:
  - One agent and one phone; nothing here proves two agents at once.
---

Deprecated. Succeeded by J3::happy-pager.

## Steps

On the local product with its real persistent storage, in one session:

1. Read the public start instructions, pair and acknowledge.
2. Ask two cards. Choose an option on the second without Send; send and acknowledge the second, then answer and acknowledge the first. Read history.
3. Return home and reopen the session row.
