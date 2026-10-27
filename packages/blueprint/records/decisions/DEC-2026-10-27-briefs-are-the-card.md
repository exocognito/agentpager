---
id: DEC-2026-10-27-briefs-are-the-card
date: 2026-10-27
decidedBy: Sam
basis:
  - Sam in Claude Code, 2026-10-27: "I'm ok with the fact that we need to forgo the one emoji per choice idea, we're now more advanced than that"
  - Sam's AgentPager answers, 2026-10-27, on "What happens to emoji cards once briefs are the main format?": C, refuse emoji cards from now on
  - Same day, on "How should the strategy describe brief options, in place of SP3 and SP4?": A, retire SP3 and SP4 and add two principles
  - Same day, on "Which milestone ships briefs?": A, add briefs to MAPP
  - Same day, on "Take my six smaller Blueprint calls?": A, take all six as written
  - exocognito/agentpager PRs #11, #12 and #14
---

# Briefs are the card format; emoji cards are retired

A brief is the one card an agent asks. Its Markdown sections lead with the decision and keep the detail one tap away, and its two to four options are lettered A to D. The server refuses a new emoji (`generic`) card since PR #14. An emoji card asked before that stays readable, answerable and acknowledged until its pager ends. Pairing keeps its three emoji: they are a code, not a card.

This supersedes [DEC-2026-10-02-generic-cards-first](DEC-2026-10-02-generic-cards-first.md).

## Strategy

- SP3 (emoji tell options apart) and SP4 (about 200 characters of detail per option) described emoji cards. Their meaning changed, so they are deprecated in place.
  - SP7 replaces SP3: letters A to D tell options apart, and ✶ marks the recommendation.
  - SP8 replaces SP4: lead with the decision, and keep the rest one tap away.
- SC1 says the agent sends a decision brief. Its product cards become a preview inside a brief's option, such as a draft email or a diff. Separate product cards were dropped in DEC-2026-10-02.
- SI6 gains the brief's limits, as the schema enforces them:
  - 20,000 characters per brief or page;
  - at most 8 attachments, PNG, JPEG or Markdown;
  - 1 MB per image and 3 MB in all;
  - HTML only inside code.
- SI8 holds with folding. Folded sections and the Options screen can all be opened before Send, and the answer refers to the exact brief. Send does not wait for each part to be opened.
- The strategic capability and invariant sections stay for now, even though the Blueprint's file rules retire them when the strategy is next rewritten. Sam renamed them "Hero Features" and "Guarantees".

## Design and roadmap

- Briefs are in MAPP: they already run in production from the dogfood app, which is MAPP's candidate.
- After a pager ends, the phone's read-only copy keeps each brief's text, but its images and pages show as unavailable. The service deletes attachments with the pager, and the phone does not keep its own copy (C7).
- Briefs supersede answer 9 of [DEC-2026-10-08-native-ios](DEC-2026-10-08-native-ios.md), "No short option labels". The answer bar Sam picked shows each option's label.
- The phone's screen for emoji cards stays while old cards can still be open. An owner can extend a pager, so that screen will not expire by itself; it is removed on purpose later.
