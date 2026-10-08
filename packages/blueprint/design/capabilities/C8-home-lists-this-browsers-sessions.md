---
id: C8::home-lists-this-browsers-sessions
serves:
  - SC1
  - SI2
  - SP5
statement: Open agentpager.me/app on your phone and see every session this browser holds by its agent's name, and connect another agent from there.
caveats:
  - The list belongs to one browser. Nothing joins sessions across browsers or devices; that needs accounts.
  - An ended or expired row is a label this browser keeps; the service has already forgotten that session's cards.
---

## Behaviors

1. The agent names each session when it creates it. The name shows on the home screen and at the top of the session.
2. Live sessions are listed apart from ended and expired ones, and the list stays current without a reload. Tapping a live row opens its session.
3. From home the owner connects another agent: scan the QR code an agent shows (C1), or give an agent a link (C9).
4. An ended or expired row keeps only the session's name and when it ended. Nothing else from the session stays in the browser.
5. A session that ended or expired before this browser first read it never appears: the phone never saw its name, so it has nothing to show.

## Never

- A session this browser did not claim or join shows on its home screen or opens from it.
