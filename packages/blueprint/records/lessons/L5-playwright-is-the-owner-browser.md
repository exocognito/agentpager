---
id: L5::playwright-is-the-owner-browser
learnedIn: MSTART, simple-loop run 03 reviewer turn 1, 2026-09-26 (PR #46)
---

What happened: the reviewer played the owner with agent-browser. Partway through the journey it stopped returning page snapshots, so the reviewer could not see whether the phone showed the acknowledgement and could not record the pass. Run 02 had shown the other half of the problem: the reviewer paired in a throwaway browser context and closed it, so the acknowledgement had no phone to reach (PR #43). On the VM, run 01 found no browser executable or Playwright package at all until PR #74 named where they live.

What a role does now: the owner's side is one Playwright Chromium context at 390 px per client, driven by a Node script that stays running from pairing through the acknowledgement: pair in it, answer there when the question arrives, check the acknowledgement there. The script imports the toy's own playwright, a devDependency of `packages/storybook`, so a script under `packages/app` resolves it from that package (createRequire against `packages/storybook/package.json` by relative path; `packages/app` does not depend on that package) or `packages/app` declares the same version and commits the lockfile. agent-browser serves other browsing, not the owner's journey. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.

Now held by: [D2::agent-clients](../../design/dependencies/D2-agent-clients.md) owns the one Chromium context per client under Cold arrival, and the [recipe](../../../../recipe.json) environment says where Chromium and playwright live; this file is history.
