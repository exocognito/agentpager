---
id: DEC-2026-10-02-generic-cards-first
date: 2026-10-02
decidedBy: Sam
basis:
  - Sam's direction on 2026-10-02 to drop the app-specific cards from M1 and get the generic card right first
  - Sam's preference for the polish of the Agent Pager canvas in Claude Design (https://claude.ai/artifact/KMpJ1ZHUZAdESdYxvVvCix) over the Storybook port
  - Sam's answers to the PR #112 canvas questions on 2026-10-02: 1a, 2b, 3b
---

# Generic cards first, at the Claude Design level of polish

Designing each product card well will take time, so MCARDS ships one card kind, `generic`. The `gmail`, `google_calendar`, `github_pr` and `x_reply` kinds, their embeds and the value types only they used (email address, people, HTTPS URL, time zone) are removed from `design/v1`. The wire keeps `card.type`, so a product kind can return later as its own folder under `ui/components/cards/` without changing the generic shape. Any other `type` is refused whole. `/start` describes and shows only the generic card.

Three slugs lost the word "rich" now that nothing in M1 is: `C8::review-and-answer-cards`, `C11::revisit-decisions` and `I9::independent-decisions`. Ids were not renumbered.

The phone screens take their look from the Claude Design canvas, removing text and marks people do not need:

- The session header is a back chevron, the session name and the status pill; the logo and the "Guest session · answer in any order" line are gone.
- Queue rows show the title and detail, with no card icon and no repeated "Decision" label. History appears only once something is decided, and each row says what you answered, or that you asked for changes, and whether the agent has replied.
- The footer is one line, when the session expires and that its history goes with it, above a red End session.
- A card opens as one sheet with a grabber: the title with ⓘ and close at its right, the options as one grouped list with a radio on each row, then Send and Ask for changes with its icon. A revision sits inside that sheet. Disabled Send is faded blue, not an outline.
- From Send on, the sheet shows the answer under a green check, as Claude Design does: first Undo with its countdown, then Sending…, then Waiting for your agent until the acknowledgement turns it into Your agent confirmed with the next steps. A history card shows the same, with when it was sent; "Sent answers cannot be edited" and the Back button are gone.
- The sheet takes focus itself, so no focus ring is drawn on its close button when it opens.
- End this session uses a red End session.
- Loading, claiming and sending show a spinner. The home screen's empty state, the + button and the Connect sheet follow the canvas, and the Connect link fits on one line.

The ⓘ detail control (SP4) and the option numbers (SP3) stay. The front page's words are Sam's and are unchanged; only its phone mock changed, from a calendar embed to the generic invite question with Accept chosen, and on phones the mock now sits below the terminal instead of covering its QR code.

## Sam's answers

1. Keep the MCARDS id, narrowed to generic cards.
2. Drop the card icon: with one kind it carried nothing. The icon component and the card registry went with it.
3. Bring Claude Design's Undo and "Agent confirmed" into M1. Send now opens an Undo window of `UNDO_MS` (5 seconds) before the answer goes; Undo keeps the choice and sends nothing, and closing the card inside the window sends it at once, as in Claude Design. The card machine gains `undoing` and `sent`; after Send the card stays open on its answer until the owner closes it. "Your agent confirmed" is not a machine state: it shows when the decision's acknowledgement arrives. I13, C8, C11, E33#send and K1 say this.
