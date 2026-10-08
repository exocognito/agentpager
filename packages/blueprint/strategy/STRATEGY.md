# AgentPager

## Vision

AgentPager makes it easy for me to leave my agents working on my computer or in a cloud VM and send owner decisions to my phone so they can continue to do useful work while I am away.

## Strategic capabilities

### SC1 · Unblock my agent from my phone

Connect my agent to my phone easily: the agent gives me a QR code or a link, or I copy a link from my phone to give the agent. To pair, the agent sends me a decision with five random emoji and tells me which one to choose.

Once paired, my agent sends me a multiple-choice decision when it needs me. I answer, see that my answer was sent, and get the agent's acknowledgement and its next steps. I can look back at past decisions.

Decision cards can show the exact email, pull request, calendar invitation or reply, the way that product would show it, with the agent's options for what to do with it. The agent carries out the option I chose; AgentPager only carries my answer.

Accounts should let me return across devices without making a guest session public.

<!-- Learn whether owners value longer sessions before building subscriptions. -->

## Strategic invariants

### SI1 · Sending a decision requires confirmation

Following good UX practice, an action that cannot be undone needs a confirming step. So an answer always takes two taps: I choose an option or write a response, then press Send. Choosing alone never sends. The agent receives exactly what I sent.

### SI2 · Only the first phone gets in

The first phone to claim a pairing link reserves the session; later devices are refused, and the first keeps it. Choosing the emoji the agent showed and pressing Send pairs it; a wrong choice leaves it unpaired. Pairing links are unguessable and work once. A lost phone means a new session, never a transfer.

### SI3 · Sent decisions cannot be changed

I can reread the question, my answer and the agent's acknowledgement, but not change them.

### SI4 · An acknowledgement always comes from the agent

An acknowledgement is a real message from the agent, never an automatic message from AgentPager. The phone tells apart "your answer was sent" from "your agent received it".

### SI5 · A free session ends when I end it, or 24 hours after pairing

When my agent finishes, I can still read the session until it ends. Once a session ends or expires, its decisions are deleted.

### SI6 · UTF-8 with Markdown is allowed; invalid or over-limit text is refused, never truncated

Card titles, option labels, option detail and agent acknowledgements allow 280 visible characters; question detail and my written feedback allow 1,000. Count spaces and Markdown punctuation. Text is valid UTF-8 with Markdown and no HTML. Anything else is refused whole, with an error that tells the agent what to fix. Nothing is truncated or silently cleaned. On screen, titles, option labels and session names show each run of spaces and line breaks as one space; detail text shows them as sent.

### SI7 · Cards are independent

Several cards can be open at once and answered in any order. Answering one never changes another.

### SI8 · Approval refers to the exact proposal

Before I answer a rich card, I see its complete target and content, and my answer refers to exactly that version.

### SI9 · Research never pretends to be an available paid upgrade

A Pro research offer takes no payment and changes nothing about my sessions. It sends my feedback only with my consent.

## Strategic goals

### SG1 · Return to completed work, not an unseen question

I can walk away while my agent works and come back to finished work, not a question I never saw. Later, measure the stops prevented and the time or tokens unblocked.

### SG2 · Agents use a helpline instead of bad decisions

An agent that is blocked or unsure about a risky step asks me for a quick go/no-go instead of stopping or taking the risk. Later, measure fewer bad decisions and unnecessary stops.

### SG3 · Learn which paid value can sustain the product

Test whether owners need longer-running agents, for which work, and whether $2.99 a month fits that value. Clicks and surveys show interest, not revenue.

## Strategic principles

### SP1 · Make the usual answer easy and clear

Use plain language I can understand without specialist knowledge. Always offer feedback, except on the pairing card, for when the options do not fit; feedback is the fallback, not the usual path.

### SP2 · Keep the first version focused and its foundations explicit

Serve one agent and one phone per session. Accounts, native apps, community cards and paid plans need their own design and user learning. Run on a Cloudflare Worker at agentpager.me, with one SQLite-backed Durable Object per session. Agents reach one service by plain HTTPS or a remote MCP server. Defer Alchemy until a date the owner sets.

### SP3 · Agents choose the options; AgentPager keeps them easy to answer

For every card, the agent chooses the question, two to five options and their emoji. Each option is one target, its emoji and title, with no radio, check or number. The emoji tells options apart, so I can refer to them in feedback, such as "do 🚀 and then 🛠️". I choose one option, never several. On a product card the options are the actions the agent offers, such as Send now or Send tomorrow.

### SP4 · Keep the decision short; make detail optional

Aim for about 100 characters for the question and for each option. The agent may name the option it recommends; it shows under the question, with the question's detail as a short reason, never a second question. Nothing is chosen for me. Each option may carry about 200 characters of detail, shown only while it is chosen. These are writing guides; SI6 sets the hard limits.

### SP5 · Reach the agents owners actually use

Any agent whose client can send HTTPS requests or add an MCP server can use AgentPager from agentpager.me/start alone, with nothing to install. That covers terminal agents, desktop and IDE apps, and chat apps on my phone. /start is written for developers of every level. A waiting agent has my answer within a second of the Undo window closing.
