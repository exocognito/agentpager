---
id: C8::home-lists-this-browsers-sessions
serves:
  - SC1
  - SI2
  - SP5
statement: Open agentpager.me/app on your phone and see every session this browser holds by its agent's name, and connect another agent from there.
caveats:
  - The list belongs to one browser. Nothing joins sessions across browsers or devices; that needs accounts.
  - An ended or expired row is a label this browser keeps; the service has deleted the session contents. For a phone returning before it ever learned the name, the session object retains only a terminal name/time receipt and a one-way verifier of that phone's key; no cards, answers or usable session keys survive.
---

Deprecated. Succeeded by C23::agents-list: the list lives in the app (SP2), and the service keeps the ended rows (I17).

## Behaviors

1. The agent names each session when it creates it. The name shows on the home screen and at the top of the session.
2. Live sessions are listed apart from ended and expired ones, and the list stays current without a reload. Tapping a row opens its session.
3. From home the owner connects another agent: scan the QR code an agent shows (C1), or give an agent a link (C9).
4. An ended or expired row keeps only the session's name and when it ended. Nothing else from the session stays in the browser.

## Never

- A session this browser did not claim or join shows on its home screen or opens from it.
