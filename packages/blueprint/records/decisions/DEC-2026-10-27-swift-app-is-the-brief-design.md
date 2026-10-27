---
id: DEC-2026-10-27-swift-app-is-the-brief-design
date: 2026-10-27
decidedBy: Sam
basis:
  - Sam's AgentPager answer, 2026-10-27, on "Where should the brief screens' design live?": B, make the Swift app the brief's design, reversing that decision with a rule change
  - exocognito/agentpager PRs #11 and #12 (the brief screen, the Options screen and the answer bar, built and dogfooded in the Swift app)
---

# The Swift app is the brief's design

[DEC-2026-10-08-storybook-is-the-design](DEC-2026-10-08-storybook-is-the-design.md) made Storybook the design, with the app drawing what it shows. For briefs, that is reversed. The brief screen, the Options screen and the answer bar are designed in the Swift app, in `packages/ios`. Its UI tests' screenshots are the record of each state. No Storybook copy is kept in step.

Briefs are designed by trying them on the phone. Each change is easier to judge in the app itself, and a second copy would only drift.

Storybook remains the design for the rest of the iPhone app until Sam decides otherwise. Its stories of ended pagers stay as they are; PR #7, which brought them up to date, was closed unmerged.

The Blueprint law still says a product's app imports its design, which SwiftUI cannot do from TypeScript. The rule change this needs belongs in exocognito/blueprint. Its earlier proposal, blueprint#157, was closed unmerged on 2026-10-15. Until that rule lands, this decision is a recorded exception.
