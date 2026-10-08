---
id: J3::happy-pager
for:
  - C2::agent-starts-from-one-url
  - C20::connect-with-an-agentpager-link
  - C21::pair-by-entering-the-agents-code
  - C5::review-and-answer-cards
  - C7::revisit-decisions
  - C23::agents-list
  - I6::send-and-acknowledgement
statement: An agent starts from the public instructions and pairs with the owner's phone, then asks two cards and hears both answers, and the owner finds the agent again from the Agents list.
caveats:
  - One agent and one phone; nothing here proves two agents at once.
---

## Steps

On the local product with its real persistent storage, with one app install:

1. The agent reads the start instructions, starts a pager and shows its link, QR code and code.
2. The owner opens the link. The app opens to pairing, the owner enters the code, and the pager is paired.
3. The agent asks two cards.
4. The owner chooses on the second without pressing Send, then sends the second and the first. The agent acknowledges both.
5. The owner reopens one answered card.
6. The owner returns to the Agents list and reopens the agent.
