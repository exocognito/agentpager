# Design catalogue: the real app's screens as checked-in images (30 Oct 2026)

Sam approved (30 Oct, in Claude Code): "yes to your generating static design images in the repo and deprecating
storybook". Why: an agent couldn't see the designs without running the Simulator, and the Storybook copies of the
phone screens drifted from the SwiftUI app (they still show v1).

## Goal
Any agent, on any machine, can see the real designs and interactions by reading files in the repo: no Simulator,
no Storybook. The images come from the real code, and a check fails when they go stale.

## Shape
1. **Phone screens.** A UI test (`DesignTests`) launches the app once per `-demo <state>` (verified: 15 offline
   states with sample data in `packages/ios/AgentPager/Preview/`), screenshots it, and saves the accessibility tree
   as text (labels, buttons, ids), so a text-only agent can read the structure.
2. **Interactions.** Journey storyboards: numbered frames with the action between them ("tap B", "Send"), one folder
   per journey, from the existing flow tests' per-step screenshots (verified: `AgentHarness.shot` writes to
   `SCREENSHOT_DIR`) against a local server the script starts.
3. **Front page.** Screenshots of the real front page at 390 and 1280 px, rendered by the local server in Chromium.
4. **Index.** `packages/blueprint/design/screens/README.md` (or similar): every image, what it shows, its text tree,
   and a fingerprint of the sources it came from.
5. **Freshness.** `pnpm check` fails when the fingerprinted sources change without regenerating (no Simulator
   needed to check; regenerating needs a Mac): one command, e.g. `pnpm designs`.
6. **Storybook goes.** Delete `packages/storybook`, every `*.stories.tsx`, the v1 phone screens in
   `packages/blueprint/design/ui/ios/`, Storybook deps and scripts; keep `MarketingScreen.tsx` (the front page) and
   anything else real code imports. A decision record supersedes DEC-2026-10-08-storybook-is-the-design and extends
   DEC-2026-10-27-swift-app-is-the-brief-design to the whole app. README and AGENTS.md updated.

## Claims
- verified: 15 `-demo` states exist (`Sample.demo` in `Previews.swift`; `pagers` is the default, `empty` an empty
  model); `DesignTests` has one test per state, and all 15 pass on the iPhone 17e Simulator, iOS 26.5.
- verified: flow tests save per-step screenshots; `shot(name, after: action)` now also writes the action, one folder
  per test with `frames.tsv`.
- verified: only stories imported `ui/ios` (git grep before deleting; `tsc --noEmit` passes after).
- verified: `packages/app/src/browser.tsx` imports `MarketingScreen.tsx` directly, not through Storybook.
- verified (was assumed): Chromium comes from `playwright` 1.62.1, already a devDependency of `packages/app` (unused
  before this; Storybook had its own copy). Its headless shell, revision 1234, was already installed here.
- verified: dark mode is not trivial. On the iOS 26.5 Simulator, `XCUIDevice.shared.appearance = .dark` (with or
  without relaunching the app) and `simctl ui appearance dark` both left the screenshots light, so the catalogue is
  light only.
- verified: the brief journey needs a real agent between `BriefTests/testPagerNumber` and `testBriefs`, so
  `pnpm designs` runs three `xcodebuild test-without-building` passes and `scripts/briefs.ts` between them.
- verified: the Simulator reaches the local server at `http://127.0.0.1:<port>`; every journey passed against it.
- verified: the front page at 390 px is 9,414 px tall at 2x, too tall to read as one image, so it is saved one
  screen at a time (6 at 390 px, 4 at 1280 px).

## Outcome
- Index at `packages/blueprint/design/screens/README.md`; `pnpm designs` in `packages/app/scripts/designs.mjs`;
  `pnpm check` runs `designs.mjs --check`, which hashes the sources with git and Node only.
- Decision record: `DEC-2026-10-30-screens-from-the-app`.
- verified: `pnpm designs` makes 71 images in about 12 MB: 15 phone states (PNG and tree), 5 journeys with 46 frames
  (pager, briefs, undo-and-changes, off-and-on, delete) and 10 front-page screens. About 12 min with the app built,
  18 min from a clean build.

## After review (PR #38)
- verified: SIGINT and SIGTERM run the same awaited shutdown as a normal end: the server stops (SIGKILL after 5 s),
  the status bar is cleared, the Simulator's appearance is put back, and a Simulator the run booted is shut down.
  Tried by interrupting a run with the Simulator shut down, and with it booted in dark appearance.
- verified: the fingerprint counts tracked files, and untracked files only with a source extension; an untracked
  `notes.txt` leaves it current. 58 files.
- chosen: the fingerprint adds the brief fixtures, `scripts/briefs.ts`, `scripts/build.mjs`, the wire contract
  (`design/schemas`, `app/src/contract.ts`) and all of `ui/components`. The rest of the server (routing, storage,
  alerts) stays out: it changes often and draws nothing itself. Editing a brief fixture now makes it stale.
- verified: three brief frames repeated others byte for byte (D1-options-row, D1-option-B-images and
  D1-answered-options); their steps changed nothing on screen, so they are dropped. `pnpm designs` now fails when two
  frames of a journey are the same image.
