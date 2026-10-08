---
id: L8::the-start-lines-cold-agents-missed
learnedIn: MSTART, Sam's chat dogfood and the simple-loop cold dogfoods of 2026-09-26 (DEC-2026-09-26-agent-reach; E5::start-page-suffices)
---

What happened: Sam's own dogfood on 2026-09-26 failed: a chat agent read `/start`, which listed HTTP routes, and could not pair his phone. The cold dogfoods that followed showed agents that had a way in still failing on the exchange itself: they asked the owner to invent the two options, they explained the steps instead of doing them, after showing the pairing link they asked the owner to say they had paired instead of waiting for the pairing answer, and they referred to the link without repeating it, so the owner had nothing to tap.

What a role does now: the requirement lives in the design's start document (its conduct lines in `design/ui/screens/StartScreen.tsx`), and C5::agent-starts-from-one-url's proof checks the served text for each line: choose two plain options yourself, do the steps before explaining them, wait for the pairing answer instead of asking the owner to confirm, and repeat the full link in every message that refers to it. This file keeps the history; `learnedIn` names the proof contract at that historical pin. A reviewer who sees a cold agent fail in a new way asks first whether `/start` is missing a line, and only then blames the client. Guidance, never a requirement: if this turns out to be a requirement it is promoted to design and this file points at it.
