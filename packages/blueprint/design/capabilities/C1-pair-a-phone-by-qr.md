---
id: C1::pair-a-phone-by-qr
serves:
  - SC1
statement: Open the QR code or link your agent shows, choose the emoji it names on the pairing card and press Send, then see the agent confirm you are in.
caveats:
  - The agent's echo of the emoji is the agent's own behaviour; the product proves only that the agent could read the exact choice and acknowledge it.
  - The phone is Playwright's Chromium at 390 px; no real handset or camera scans the code.
  - That the target is drawn at random is shown by reading the code that draws it, not by watching draws.
---

Deprecated. Succeeded by C20::connect-with-an-agentpager-link and C21::pair-by-entering-the-agents-code: the owner's side is the native app (SP2), and pairing is by the agent's three-emoji code (SI2).

## Behaviors

1. The agent creates a session and shows its link, a QR code of the link, and the emoji to choose. The service picks that emoji at random from the five on the card and tells only the agent.
2. The first phone to open the link lands on the pairing card. Nothing on the card marks the right emoji.
3. Choosing the named emoji and pressing Send pairs the phone. A wrong emoji is refused without giving the right one away, and the owner can choose again.
4. The agent receives the choice and acknowledges it.
