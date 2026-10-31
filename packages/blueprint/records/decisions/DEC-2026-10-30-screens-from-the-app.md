---
id: DEC-2026-10-30-screens-from-the-app
date: 2026-10-30
decidedBy: Sam
basis:
  - Sam in Claude Code, 2026-10-30: "yes to your generating static design images in the repo and deprecating storybook"
---

# The app's own screens are the design record; Storybook goes

[DEC-2026-10-27-swift-app-is-the-brief-design](DEC-2026-10-27-swift-app-is-the-brief-design.md) made the Swift app the brief's design, with its UI tests' screenshots as the record. This extends that to the whole iPhone app, and to the front page. The Storybook copies of the phone screens still showed v1, and an agent could see the real screens only by running the Simulator.

- The design catalogue, `design/screens/`, is the record of what the product looks like: the real app's screens as checked-in images and text, made from the code by `pnpm designs`. It holds each `-demo` state of the phone with its accessibility tree as text, the interactions as storyboards of numbered frames with the action between them, and the front page at 390 and 1280 px.
- Any agent, on any machine, reads the designs from these files. Making them needs a Mac with Xcode; reading them needs nothing.
- `pnpm check` fails when the app, its UI tests or the front page change without `pnpm designs` being run, so the record can't quietly go stale.
- Storybook is deleted: `packages/storybook`, every story, and the v1 phone screens in `design/ui/ios/`. The front page's `MarketingScreen` stays in `design/ui/screens/`, since the app imports it.
- Claude Design and `docs/v2/mocks/` stay places to sketch. A sketch decides nothing until the app draws it.

The Blueprint law still says a product's app imports its design, which SwiftUI cannot do from TypeScript. As in DEC-2026-10-27-swift-app-is-the-brief-design, this is a recorded exception until the rule change lands in exocognito/blueprint.

## Supersedes

- [DEC-2026-10-08-storybook-is-the-design](DEC-2026-10-08-storybook-is-the-design.md): Storybook is no longer the design, and the apps no longer draw what stories show. The app is the design, and the catalogue records it.
