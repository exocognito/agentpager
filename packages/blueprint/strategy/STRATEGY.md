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
---

# AgentPager

## Vision

AgentPager makes it easy for me to leave my agents working on my computer or in a cloud VM and send owner decisions to my phone so they can continue to do useful work while I am away. It is an app on my phone that pages me when an agent needs me, the way a pager would.

## Hero Features
_Technically: strategic capabilities_

### SC1 · Unblock my agent from my phone

Connect my agents to my phone easily. I give the agents I trust my pager number, and each opens its own pager on my phone with nothing for me to tap. Any other agent connects with an AgentPager link: my agent shows me one as a link and a QR code, or my phone makes one for me to give my agent, and I confirm the pairing by tapping, on my phone, the three emoji my agent shows me.

Once paired, my agent sends me a decision brief when it needs me: the decision first, with two to four options and the detail one tap away. I answer, see that my answer was sent, and get the agent's acknowledgement and its next steps. I can look back at a pager's decisions while it lasts, and for 24 hours after it ends.

A brief's option can preview exactly what it would send or change, such as a draft email, a pull request's diff or a calendar invitation, so I approve that exact version. The agent carries out the option I chose; AgentPager only carries my answer.

Accounts should let me return across devices without making a pager public.

<!-- Learn whether owners value longer pagers before building subscriptions. -->

### SC2 · Get paged when my agent needs me

When my agent asks, my phone alerts me with the agent's name and its question, even when AgentPager is closed and, if I let its alerts through, a Focus mode is on. Opening the alert takes me to that decision.

## Guarantees
_Technically, SI: a strategic selection of Invariants_

### SI1 · Sending a decision requires confirmation

Following good UX practice, an action that cannot be undone needs a confirming step. So an answer always takes two taps: I choose an option or write a response, then press Send, and I have a few seconds to undo. Choosing alone never sends. The agent receives exactly what I sent.

### SI2 · Only agents I let in reach my phone

A pager is one agent and one phone. An agent gets a pager on my phone only with my pager number, which I give to agents I trust and can change at any time, or through an AgentPager link, where my phone pairs only by entering the three emoji my agent shows, within 15 minutes and three tries; a third wrong try ends the pager. Opening or reading a link never uses it up and never pairs anything. Once a pager is open, no other phone or agent gets in. A lost phone means new pagers, never a transfer.

### SI3 · Sent decisions cannot be changed

I can reread the question, my answer and the agent's acknowledgement, but not change them.

### SI4 · An acknowledgement always comes from the agent

An acknowledgement is a real message from the agent, never an automatic message from AgentPager. The phone tells apart "your answer was sent" from "your agent received it".

### SI5 · A pager ends when I end it, when my agent finishes, or at its end time

Its end time is 24 hours after pairing unless I choose 7 or 30 days, and I can change it later. When a pager ends, its decisions are deleted from the service at once, and my phone keeps a read-only copy for 24 hours. My agent is told why on its next call. Ending a pager never stops the agent itself.

### SI6 · UTF-8 with Markdown is allowed; invalid or over-limit text is refused, never truncated

Card titles, option titles, option detail and agent acknowledgements allow 280 visible characters; question detail and my written feedback allow 1,000. Count spaces and Markdown punctuation. Text is valid UTF-8 with Markdown and no HTML. Anything else is refused whole, with an error that tells the agent what to fix. Nothing is truncated or silently cleaned. On screen, titles, option labels and agent names show each run of spaces and line breaks as one space; detail text shows them as sent. A brief option's short label allows 20. A brief, and each Markdown page attached to it, holds up to 20,000 characters; a brief carries at most 8 attachments, PNG, JPEG or Markdown, of at most 1 MB per image and 3 MB in all. HTML is allowed only inside code, where it shows as text.

### SI7 · Cards are independent

Several cards can be open at once and answered in any order. Answering one never changes another.

### SI8 · Approval refers to the exact proposal

Before I answer a rich card, I see its complete target and content, and my answer refers to exactly that version. A brief may fold its sections and its options' detail: all of it can be opened before I press Send, and Send never waits for me to open each part.

### SI9 · Research never pretends to be an available paid upgrade

A Pro research offer takes no payment and changes nothing about my pagers. It sends my feedback only with my consent.

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

Use plain language I can understand without specialist knowledge. Always offer a way to ask for changes when the options do not fit; it is the fallback, not the usual path. In the app, my agent has a pager, I end a pager, and nothing is called a session.

### SP2 · Keep the first version focused and its foundations explicit

Serve one agent and one phone per pager. My side is a native phone app for iPhone and Android, with the same behaviour, data and words on each, drawn each platform's way. Accounts, community cards and paid plans need their own design and user learning. Run on a Cloudflare Worker at agentpager.me, with one SQLite-backed Durable Object per pager. Agents reach one service by plain HTTPS or a remote MCP server. Defer Alchemy until a date the owner sets.

### SP3 · Agents choose the options; AgentPager keeps them easy to answer

For every card, the agent chooses the question, two to five options and their emoji. Each option is its emoji and title; the emoji, never a number, tells options apart, so I can refer to them when I ask for changes, such as "do 🚀 and then 🛠️". I choose one option, never several, and the phone marks my choice the platform's usual way. On a product card the options are the actions the agent offers, such as Send now or Send tomorrow.

### SP4 · Keep the decision short; make detail optional

Aim for about 100 characters for the question and for each option. The agent may mark the option it recommends; the phone tags it, and nothing is chosen for me. Each option may carry about 200 characters of detail, always shown with it. These are writing guides; SI6 sets the hard limits.

### SP5 · Reach the agents owners actually use

Any agent whose client can send HTTPS requests or add an MCP server can use AgentPager from an AgentPager link or agentpager.me/start alone, with nothing to install. That covers terminal agents, desktop and IDE apps, and chat apps on my phone. The instructions are written for developers of every level. A waiting agent has my answer within a second of the Undo window closing.

### SP6 · Feel native

Use the platform's own components and conventions (lists, sheets, menus, alerts, notifications and the Camera) rather than custom ones, so the app is familiar and the system does the work. Behaviour, data and words are the same on every platform; how they are drawn follows each platform.

### SP7 · Letters tell options apart; ✶ marks the recommendation

For every card, the agent chooses the question and two to four options. They are lettered A to D in the order the agent gives them, and the letter tells them apart, so I can refer to them when I ask for changes, such as "do A, then B". I choose one option, never several, and the phone marks my choice the platform's usual way. The agent may mark the option it recommends; the phone marks it ✶, and nothing is chosen for me.

### SP8 · Lead with the decision; keep the rest one tap away

A brief opens on what I need to decide: the question, its context, each option's short label and the agent's recommendation. What each option changes, why to choose or pass on it, what it assumes, the tradeoffs and any attachments stay one tap away. Aim for about 100 characters for the question. These are writing guides; SI6 sets the hard limits.

## Strategic Design Decisions
_Technically, SD: sometimes specific design decisions get made top down and are pinned in design even though they may seem objectively inferior decision to make autonomously given all the other requirements in the blueprint. i.e. this may not be a permanent set of laws like the rest, but a temporarily true design constraint or limitation we choose to apply as we explore the design space. (Lets just see what actually gets written here and review if useful)_
