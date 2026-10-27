---
id: J3::happy-pager
for:
  - C2::agent-starts-from-one-url
  - C20::connect-with-an-agentpager-link
  - C21::pair-by-entering-the-agents-code
  - C5::review-and-answer-cards
  - I6::send-and-acknowledgement
statement: An agent starts from the public instructions, pairs with the owner's phone, asks one card and hears the answer.
caveats:
  - One agent and one phone; nothing here proves two agents at once.
---

## Steps

On the local product with its real persistent storage, with one app install:

1. The agent reads the start instructions, starts a pager and shows its link, QR code and code.
2. The owner opens the link and the app at pairing, enters the code, and the pager is paired.
3. The agent asks one card. The owner chooses an option and sends it. The agent receives it and acknowledges, and the row shows it confirmed.
