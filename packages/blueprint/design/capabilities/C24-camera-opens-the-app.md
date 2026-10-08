---
id: C24::camera-opens-the-app
serves:
  - SC1
  - SP6
statement: Scan your agent's QR code with the Camera, or tap its link, and AgentPager opens straight to pairing for that agent, with no web page in between.
caveats:
  - It stands on D7::apple-developer-program's associated domains. A phone without the app still gets the link's page (C20).
  - The Simulator has no camera. The proof taps the link; a real camera scans a QR code at the owner's walk.
---

## Behaviors

1. Scanning an agent's QR code with the Camera offers to open AgentPager. Opening it shows pairing for that agent (C21).
2. Tapping an agent's link in another app, such as the agent's chat, opens AgentPager the same way.
