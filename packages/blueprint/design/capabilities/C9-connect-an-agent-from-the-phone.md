---
id: C9::connect-an-agent-from-the-phone
serves:
  - SC1
  - SI2
statement: From your phone, copy one link to an agent; the agent joins your phone directly, then you confirm it with the same emoji handshake.
caveats:
  - The emoji handshake confirms that the agent which joined is the one talking to the owner. It does not identify the agent; anyone holding an unused connect id can join with it until it expires.
  - The sheet takes the first unpaired session it did not list on opening as the one that joined; a pairing link claimed in another tab at the same moment would be taken for it.
  - Only the browser that registered a connect id lists the session made with it. If that browser loses its stored phone key, nobody can pair that session.
---

Deprecated. Succeeded by C20::connect-with-an-agentpager-link: the phone and the agent make the same kind of link (SC1).

## Behaviors

1. The owner asks the home screen for a link to give an agent, and copies it. The link shows only once the service has registered it, and works for as long as an unpaired session lasts.
2. The agent reads the link, which is the start page with the phone's connect id, and joins with a session name. Reading alone joins nothing. A used, expired or unknown link is refused.
3. The new session appears on the phone with its pairing card, and pairing runs as in C1.

## Never

- A refused join, a second browser or a pairing attempt without the agent's emoji stops an agent that already joined from using its key.
