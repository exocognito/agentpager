---
id: DEC-2026-10-08-storybook-is-the-design
date: 2026-10-08
decidedBy: Sam
basis:
  - Sam in Claude Code, 2026-10-08: "Claude Design for sketching/generation, port to storybook the canonical design, implement in different places (xcode, etc)."
  - Sam's iOS canvas "AgentPager iOS — native redesign" (claude.ai artifact SYyjPi2HdYsv7o5Ty2RMUZ)
---

# Storybook is AgentPager's design; Claude Design sketches, and the apps draw what it shows

Three tools draw AgentPager's screens, and only one decides:

- Claude Design is where Sam sketches and generates screens. A sketch decides nothing until it is ported.
- Storybook, from `design/ui/ios/`, is the design: one story per screen and state, with the app's words in `words.ts`. Sam reviews it on the canvas story, which lays out every screen in rows as his Claude Design canvas does.
- The apps, now the iPhone app in `packages/ios`, draw what the stories show, in the same words.

The Swift app cannot import the stories, so its words are a copy. Sam took the proposal to find drift by putting each story beside the app's screenshot of the same state from its UI tests.

The first port took its look from Sam's canvas and its words and behaviour from the dogfood build at acbc809, which had moved on since the canvas: Settings and the pager number ([DEC-2026-10-08-pager-number-dogfood](DEC-2026-10-08-pager-number-dogfood.md)), the countdown on a row during Undo, and the pairing window counted from the link. It leaves out what the canvas drew and Sam later cut from MAPP ([DEC-2026-10-08-native-ios](DEC-2026-10-08-native-ios.md)): the Lock Screen and its actions, the Live Activity, and the Never lifetime. In dark mode, blue text and white text on blue are a shade off the system blue so they keep 4.5:1 contrast. The parked web design stays under `design/ui/screens/`.
