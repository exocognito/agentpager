---
id: DEC-2026-10-30-v2-promises
date: 2026-10-30
decidedBy: Sam
basis:
  - Sam's AgentPager answer, 2026-10-30, on "Which bigger architecture change should start first?": A, contract first
  - Sam in Claude Code, 2026-10-30, on the contract questions: emoji cards go for good, `kind` comes off the wire, and a decision's title is at most 100 characters (exocognito/agentpager PR #33)
  - Sam's AgentPager answer, 2026-10-30, on "How should the new promises treat what isn't built yet?": A, tag the stages, approving the restated strategy
  - docs/v2/01-decisions.md
---

# The Blueprint states v2's promises

v2 is live. The owner makes pagers on the phone and turns them off, agents connect with a pager number through the agentpager command, and every card is a brief. The Blueprint still described v1: emoji pairing, one agent per pager, links, end times and 280-character titles. Sam restated the strategy for v2 and approved it on his pager on 2026-10-30.

He chose to tag the stages. Every promise stays, including those not built yet, and each of those says so in place: "*Not built yet*", with what it comes with. A promise without a tag is true of the code on `main`.

## Strategy

- Rewritten as Sam approved them: SC1, SC2, SI2, SI4, SI5, SI6, SP1, SP2, SP5, SP6 and SP8.
- New: SI10, the service can't read my decisions, tagged not built until the encryption work; and SI11, a decision is reviewed before it's sent.
- Retired, with no successor: SI9 (the research offer) and SG3 (the paid value). There is no paid tier: AgentPager is open source, for Sam and about ten friends (01-decisions, Goal).
- Unchanged: the Vision, SI1, SI3, SI7, SI8, SG1, SG2 and SP7. SP3 and SP4 stay retired.
- SP2 tags Android as not built yet.
- SI6 sets the detail at 280 characters on one line, the limit agents already meet through the binary. The server holds it to 280 too since PR #34, as it does titles since PR #33.
- The Strategic Design Decisions are pinned: numbers only; the agentpager command as the one home for the writing rules; `card.yaml` compiled by the command; encryption before the friends rollout; no Settings screen; notes are answers to one decision.

## The contract

The contract changed first, before the other architecture work. PR #33 made every card a brief: the emoji card, `kind` on a decision and the option emoji are gone from the wire, and a decision stored with them is rewritten once without them. A decision's title is at most 100 characters.

## Design

- Terms: "agent" replaces "session", and a pager is what the owner makes on the phone. Links, the pairing code, the palette, the pairing window, end times, end reasons, the Agents list and the Agent screen are gone.
- Capabilities. Deleted: C1, C2, C3, C4, C8, C9, C20, C21 and C24, the link, QR and emoji pairing, the web app and the hosted ways in. Rewritten: C5, C6, C7, C17, C18 and C19; and with new slugs, C22 (turn a pager off and on), C23 (pagers and the pager screen) and C25 (connect with a pager number). New: C26 (make a pager on the phone), C27 (review a card before sending), C29 (install the command), C30 (end-to-end encryption) and C31 (history on the agent's machine). There is no C28: the owner's notes are answers to one decision, never guidance handed to other agents (01-decisions).
- Invariants. Deleted: I1, I2 and I16. Rewritten with a new slug: I17 (an off pager delivers nothing; a deleted pager is forgotten). New: I19 (the number names the phone's key), I20 (the service holds nothing readable), I21 (every connect is a new agent) and I22 (a broken card is never sent). Reworded for v2: I4, I5 and I6. Kept: I3 (retired, as history) and I18.
- Tagged not built yet: encryption (SI10, C30, I20, the encrypted alert in C17 and the agent's own key check in I19); the one-line install (C29), since today the command is built from the repository; Android (SP2); the demo agent (C19); and the front page's v2 words and its note of what the service stores (C18).
- A deleted id is never reused.
- Journeys J1 to J5, dependencies D2, D3 and D6, the roadmap and `design/ui/` are rewritten in a follow-up. Until then they still name some of the deleted promises.

## Supersedes

- [DEC-2026-10-27-briefs-are-the-card](DEC-2026-10-27-briefs-are-the-card.md), in part: an emoji card asked before 2026-10-27 no longer stays readable and answerable, and pairing no longer keeps its three emoji. Briefs stay the card.
- [DEC-2026-10-08-pager-numbers](DEC-2026-10-08-pager-numbers.md): a phone no longer has one number that the owner replaces. Each pager made on the phone has its own number, and a leaked number means a new pager.
- [DEC-2026-10-08-ended-pagers-readable](DEC-2026-10-08-ended-pagers-readable.md): pagers no longer end. An off pager keeps every decision on the phone, and a deleted one is gone from the phone and the service.
- [DEC-2026-09-26-agent-reach](DEC-2026-09-26-agent-reach.md): agents no longer reach the service over plain HTTPS or a hosted MCP server with nothing to install. They use the agentpager command, and agents with no machine of their own are out.
- [DEC-2026-10-27-pr1-sign-off](DEC-2026-10-27-pr1-sign-off.md), answers 1a and 2b: SG3 is retired, and with no pager ending there is no ended record to keep the last acknowledgement in.
- [DEC-2026-09-26-session-lifecycle](DEC-2026-09-26-session-lifecycle.md): an agent has no lifetime of its own. It lasts until it finishes or its pager is deleted, and one with no activity for 30 days is forgotten.
