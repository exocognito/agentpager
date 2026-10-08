---
id: D3::owner-browser
statement: The owner's side runs in a phone browser and also holds at desktop width.
providedBy: recipe
provided: the Chromium that the recipe's setup installs on the run's host
caveats:
  - Chromium at two widths stands for every phone and desktop browser. The loop samples no other engine and no real handset.
---

Deprecated. Succeeded by D6::iphone-app: the owner's side is a native iPhone app, and the web app is parked (SP2).

Must supply: a real browser engine that the tests drive and that a role uses when it plays the owner.

Must never do: let a rendered story or fixture stand in for the product's own screen.

Proof runs on: Chromium at 390 px, the phone width. The card and history screens, the home screen and the front page also run at 1280 px. A second device is a separate browser context.
