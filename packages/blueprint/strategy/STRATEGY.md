---
items:
  SP3:
    status: deprecated
    successor: SP7
    decision: DEC-2026-10-27-briefs-are-the-card
  SP4:
    status: deprecated
    successor: SP8
    decision: DEC-2026-10-27-briefs-are-the-card
  SI9:
    status: deprecated
    decision: DEC-2026-10-30-v2-promises
  SG3:
    status: deprecated
    decision: DEC-2026-10-30-v2-promises
---

# AgentPager

## Vision

AgentPager makes it easy for me to leave my agents working on my computer or in a cloud VM and send owner decisions to my phone so they can continue to do useful work while I am away. It is an app on my phone that pages me when an agent needs me, the way a pager would.

## Hero Features
_Technically: strategic capabilities_

### SC1 · Unblock my agent from my phone

I make pagers on my phone, as many as I like: one for my AGENTS.md, one for a throwaway VM, one per shared project. Each has a number. An agent I give the number to connects with the agentpager command, and appears on that pager with nothing for me to tap. Every connect is a new agent, shown by who asked (Claude Code, Codex) and grouped by project.

When it needs me, my agent sends a decision: the question first, two to four options, its recommendation, and the detail one tap away. I answer, see that my answer was sent, then get the agent's acknowledgement and next steps. I can look back at an agent's decisions until its pager is deleted, or until it has been idle 30 days.

An option can show exactly what it would send or change, such as a draft email or a diff, so I approve that exact version. The agent carries out the option I chose; AgentPager only carries my answer.

### SC2 · Get paged when my agent needs me

When my agent asks, my phone alerts me with who asked, the project and the question, even when AgentPager is closed and, if I let its alerts through, a Focus mode is on. Opening the alert takes me to that decision. If no agent picks up my answer within 3 minutes, I'm told once, by an alert and on the decision.

## Guarantees
_Technically, SI: a strategic selection of Invariants_

### SI1 · Sending a decision requires confirmation

Following good UX practice, an action that cannot be undone needs a confirming step. So an answer always takes two taps: I choose an option or write a response, then press Send, and I have a few seconds to undo. Choosing alone never sends. The agent receives exactly what I sent.

### SI2 · Only agents I give a number reach my phone

A pager number is an address I give to agents I trust. Whoever has it can send me decisions until I turn that pager off, and can read nothing. I can turn any pager off, and then nothing from it gets through. If a number leaks, I make a new pager rather than turning the old one back on.

### SI3 · Sent decisions cannot be changed

I can reread the question, my answer and the agent's acknowledgement, but not change them.

### SI4 · An acknowledgement always comes from the agent

An acknowledgement is a real message from the agent, never an automatic message from AgentPager. The phone tells apart "your answer was sent", "your agent received it" and "no agent has picked it up".

### SI5 · A pager is on until I turn it off

A pager turns off when I turn it off, or by itself at the time I chose (never, or after 24 hours, 7 days or 30 days). While it's off, nothing gets through and nothing is queued: an agent is told plainly that its message wasn't delivered. My phone keeps every decision while a pager is off, and turning it on makes open decisions answerable again. An agent lasts until it finishes or my pager is deleted; one idle for 30 days is forgotten. Deleting a pager deletes its agents and decisions from the service. None of this stops the agent itself.

### SI6 · UTF-8 with Markdown is allowed; invalid or over-limit text is refused, never truncated

A question's title allows 100 visible characters, and its one-line detail 280. An option's title, what it prioritizes, and an acknowledgement allow 280 each. An option's answer label allows 20; my written feedback allows 1,000. Titles, labels and the detail are one line. Count spaces and Markdown punctuation. Text is valid UTF-8 with Markdown and no HTML. Anything else is refused whole, with an error that tells the agent what to fix; nothing is truncated or silently cleaned. A decision and each Markdown page attached to it hold up to 20,000 characters. A decision carries at most 8 attachments, PNG, JPEG or Markdown, of at most 1 MB per image and 3 MB in all. HTML is allowed only inside code, where it shows as text.

### SI7 · Cards are independent

Several cards can be open at once and answered in any order. Answering one never changes another.

### SI8 · Approval refers to the exact proposal

Before I answer a rich card, I see its complete target and content, and my answer refers to exactly that version. A brief may fold its sections and its options' detail: all of it can be opened before I press Send, and Send never waits for me to open each part.

### SI9 · Research never pretends to be an available paid upgrade

A Pro research offer takes no payment and changes nothing about my pagers. It sends my feedback only with my consent.

### SI10 · The service can't read my decisions

Decisions, attachments, answers and acknowledgements are encrypted on my agent's machine and on my phone. The service carries bytes and the little it needs to route them: which pager, which agent, when. The pager number binds my phone's key, so the service can't swap it. *Not built yet: comes with the encryption work.*

### SI11 · A decision is reviewed before it's sent

The agentpager command gives the agent its decision and a description of a good one to review once before sending. A decision that is broken in structure (no options, a missing attachment, over a limit) is refused with the reason, before it leaves the agent's machine.

## Goals
_Technically SK: A set of strategic metrics and rubrics to achieve long term_

### SG1 · Return to completed work, not an unseen question

I can walk away while my agent works and come back to finished work, not a question I never saw. Later, measure the stops prevented and the time or tokens unblocked.

### SG2 · Agents use a helpline instead of bad decisions

An agent that is blocked or unsure about a risky step asks me for a quick go/no-go instead of stopping or taking the risk. Later, measure fewer bad decisions and unnecessary stops.

### SG3 · Learn which paid value can sustain the product

Test whether owners need longer-running agents, for which work, and whether $2.99 a month fits that value. Clicks and surveys show interest, not revenue.

## Principles
_Technically SK: a set of strategic metrics (rubrics) that apply to all internal decisions_

### SP1 · Make the usual answer easy and clear

Use plain language I can understand without specialist knowledge. Options are different ways to get the job done. Asking for changes is always there when no option fits; it is the fallback, never an option. In the app, I make pagers, agents connect to them, and I turn a pager off. Nothing is called a session.

### SP2 · Keep the first version focused and its foundations explicit

My side is a native iPhone app. No accounts and no paid plans. It runs on a Cloudflare Worker at agentpager.me, with one Durable Object for the pagers and one per agent. Agents reach it only through the agentpager command, as a command line or a local MCP server. The code is open: anyone can read it, fork it and run their own (*not built yet*).

### SP3 · Agents choose the options; AgentPager keeps them easy to answer

For every card, the agent chooses the question, two to five options and their emoji. Each option is its emoji and title; the emoji, never a number, tells options apart, so I can refer to them when I ask for changes, such as "do 🚀 and then 🛠️". I choose one option, never several, and the phone marks my choice the platform's usual way. On a product card the options are the actions the agent offers, such as Send now or Send tomorrow.

### SP4 · Keep the decision short; make detail optional

Aim for about 100 characters for the question and for each option. The agent may mark the option it recommends; the phone tags it, and nothing is chosen for me. Each option may carry about 200 characters of detail, always shown with it. These are writing guides; SI6 sets the hard limits.

### SP5 · Reach the agents owners actually use

Any agent that can run the agentpager command can use AgentPager: terminal agents, and desktop apps like Claude Desktop and Cursor. Cloud sessions with a shell should work too, untested so far. Agents with no machine of their own, like claude.ai in a browser, are out. The command sets itself up in the agent apps it finds. A waiting agent has my answer within a second of the Undo window closing, with nothing for me to nudge.

### SP6 · Feel native

Use the platform's own components and conventions (lists, sheets, menus, alerts and notifications) rather than custom ones, so the app is familiar and the system does the work.

### SP7 · Letters tell options apart; ✶ marks the recommendation

For every card, the agent chooses the question and two to four options. They are lettered A to D in the order the agent gives them, and the letter tells them apart, so I can refer to them when I ask for changes, such as "do A, then B". I choose one option, never several, and the phone marks my choice the platform's usual way. The agent may mark the option it recommends; the phone marks it ✶, and nothing is chosen for me.

### SP8 · Lead with the decision; keep the rest one tap away

A decision opens on what I need to decide: the question, its context, each option's short label and the agent's recommendation. What each option changes, why to choose or pass on it, what it assumes, the tradeoffs and any attachments stay one tap away. These are writing guides; SI6 sets the hard limits.

## Strategic Design Decisions
_Technically, SD: sometimes specific design decisions get made top down and are pinned in design even though they may seem objectively inferior decision to make autonomously given all the other requirements in the blueprint. i.e. this may not be a permanent set of laws like the rest, but a temporarily true design constraint or limitation we choose to apply as we explore the design space. (Lets just see what actually gets written here and review if useful)_

Numbers only: no links, QR codes or emoji pairing. The agentpager command is the one home for the rules agents write by. A decision is written as card.yaml and compiled by the command. Encryption comes before the friends rollout. No Settings screen in the app: notifications and the server address live in iOS Settings. Notes are answers to one decision, never standing guidance for other agents.
