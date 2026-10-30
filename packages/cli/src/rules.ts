// The card contract, the review list and the card.yaml format: their single home (docs/v2/02-writing-rules.md).
// The MCP tool descriptions, `rules`, `review` and the reminder in `ask` all print from here.

export const CONTRACT = `A decision card asks your owner one question and gives them everything they need to answer it on a phone.

1. One question per card. The title is the question, under 100 characters. Two decisions are two cards.
2. Write for someone who wasn't there. Your owner reads this on a phone, hours later, without your context. No ticket numbers, milestone codes, variable names or document labels unless you say what they are. If a term needs the project to understand, explain it or leave it out.
3. Context says three things: what is happening, what breaks or is lost if nobody decides, and how likely or how often. Three short paragraphs at most. History goes in an attached page, not here.
4. Options are different ways to get the job done. Two to four, each something you will carry out as soon as it is chosen. Never offer "revise", "discuss", "give me changes", "partial", "review later" or "other": the phone has an Ask for changes button for that. Deferring, or leaving things as they are, is a real option when you would carry it out. If you have one idea, find the other real one: usually the cheap option with a cost your owner will feel, against the thorough one.
5. Each option tells its story: what it changes, why choose it, why pass on it, what it assumes, and what it looks like (a diff, a mockup, a sample). Its \`prioritizes\` line says what it optimises for, in your owner's terms.
6. Options compares them on what your owner cares about. One row per concern, one column per option, every cell rated green to red. Not a restatement of the option titles.
7. Recommend one, say why in one line, and say what would change your mind.
8. Next steps: what happens after each answer, and what happens if nobody answers.
9. Everything needed to decide is in the card. Attach images and pages; a link is extra reading, never required reading. Never ask your owner to open another tool to decide.
10. Each part has one job. \`detail\` is the one-line preview in the inbox: say what the decision is about, in plain words. No bookkeeping anywhere: not "this replaces card X", not "approval is not implied", not apologies.
11. Short. A card your owner can read in two minutes. Detail belongs in option stories and attachments, not in Context.
12. Before you send, get it reviewed once. Run \`agentpager review card.yaml\` and give its output to a subagent (or do it yourself if you can't start one). It grades each point ok, good to fix or must fix. Fix the must-fixes, use your judgement on the rest, then send. One round; don't review the review.`;

// Reprinted inside an \`ask\` reply when the agent is due a reminder (same numbering as the contract).
export const SHORT = `1. One question per card. 2. Write for someone who wasn't there. 3. Context: what's happening, what breaks if nobody decides, how likely. 4. Options are different ways to get the job done; never "revise" or "discuss". 5–8. Each option's story; a tradeoffs table on what your owner cares about; recommend one; next steps. 9. Everything needed to decide is in the card. 10. Each part has one job. 11. Short. 12. One review by a subagent before you send (\`agentpager review card.yaml\`); fix the must-fixes, judge the rest.`;

// What \`agentpager review\` prints before the card, for a subagent to grade. The binary judges nothing itself.
export const REVIEW = `Review this decision card for the person who will answer it. Read it as they will: on a
phone, hours from now, without the writer's context, in under two minutes.

Below is what a good card looks like. Grade each point for this card:
  ok            it holds
  good to fix   it falls short in a way the owner would notice
  must fix      the owner can't answer well without this fixed
Output twelve lines, one per point in order: its number, its grade and, when it is not
ok, what to change in one line, quoting the text. Do not rewrite the card. Nothing else.

WHAT GOOD LOOKS LIKE
 1  One question. The title is a question the owner can answer with one tap.
 2  Two to four options, each something the writer will do as soon as it is chosen. None
    asks the owner to write instead of choosing ("revise", "discuss", "partial", "review
    later", "other"). Deferring, or leaving things as they are, is a real option. If only
    one option is real, say what the other should be.
 3  The card stands alone. The owner can decide from the card without opening a link or
    another tool. Attachments may add detail; nothing required lives outside.
 4  Context says what is happening, what breaks or is lost if nobody decides, and how
    likely or how often.
 5  One option is recommended, with one line of why and what would change the writer's
    mind.
 6  No unexplained labels: ticket numbers, milestone codes, variable or document names.
 7  \`detail\` is a plain one-line preview of what the decision is about; no bookkeeping
    ("replaces card X", "approval is not implied"), no apologies.
 8  Context is three short paragraphs at most; detail lives in the option stories or the
    background page.
 9  Each option says what it changes, why choose it, why pass on it, what it assumes, and
    shows what it looks like where that helps.
10  Each tradeoffs row separates the options on something the owner cares about; no row
    rates every option the same.
11  Next steps say what happens after each answer and if nobody answers.
12  Readable in two minutes.`;

export const TEMPLATE = `# card.yaml: the whole card. Each key lands in one place on your owner's phone.
# Prose fields take paragraphs, "- " bullets, **bold** and ![alt](file.png) for an attached image;
# no headings, tables or HTML. Small decisions leave out the optional keys.
title:          # required: the question, at most 100 characters
detail:         # required: one plain line for the inbox, at most 280 characters
context:
  heading:      # optional: "Context: <heading>"
  summary: |    # required: what is happening, what breaks if nobody decides, how likely
  more:         # optional: one tappable row under Context that opens a page
    title:
    body: |
options:        # required: 2 to 4, lettered A, B, C, D in this order
  - label:      # required: the answer button, at most 20 characters
    title:      # required
    prioritizes: # required: what it optimises for, in your owner's terms, at most 280 characters
    changes: |  # optional, with why, why_not, assumes: the option's story
    why: |
    why_not: |
    assumes: |
    looks_like: # optional: an attached image, such as mock.png
tradeoffs:      # optional: one row per concern; a "rating: text" cell per option letter
  - concern:
    A: "green: ..."   # rating is green, yellow, orange or red
    B: "red: ..."
recommendation: # required: option and why
  option: A
  why:
  changes_my_mind:
next_steps:     # optional: one line per option letter, and if_no_answer
  heading:
  A:
  B:
  if_no_answer:
attachments: [] # files next to card.yaml that the card names: .md pages, .png or .jpg images`;

// The M11 decision from the canvas (docs/v2/card-example.yaml, with its detail quoted: a plain YAML value can't hold
// ": "). Its images are not shipped: add your own files.
export const EXAMPLE = `title: Which M11 guarantee should we build?
detail: "Two real alternatives: a smaller fix with occasional manual recovery, or precise automatic recovery."

context:
  heading: a lost reply
  summary: |
    The service hands the agent job A, but the reply is lost on the way. When the agent
    asks again it gets job B, and A is stuck. We don't know how often this happens in
    production.
  more:
    title: How the mix-up happens
    body: |
      Every few seconds the agent asks the service "is there work for me?". Usually the
      answer is "no", and that's normal.

      Sometimes the service says "yes, here is job A" but the reply never arrives: the
      connection dropped on the way back. The service has already marked A as running.
      The agent, having heard nothing, asks again, and this time gets job B.

      Now A sits marked as running forever, with nobody working on it. That's the stuck
      job you'd see on the page.

      ![Flowchart](flow.png)

      We don't know how often this happens in production. Option A makes the stuck state
      visible so you can clear it by hand; option B makes the service remember the
      hand-off so a retry gets A back.

options:
  - label: Small + manual
    title: Smaller fix with manual recovery
    prioritizes: less code and state, accepting an occasional Cancel or Run again after a connection failure
    changes: |
      - Stop automatically repeating an unresolved Run.
      - Report an unanswered work-taking call as unknown, not empty.
      - Keep normal idle waits, live-run recovery and Cancel.
    why: |
      - No permanent receipt store and no new endpoint.
      - Fixes the one path that looked empty but wasn't.
    why_not: |
      - After a connection failure you may have to inspect the page, Cancel a stuck job, or press Run again.
    assumes: |
      - Lost replies are rare enough that manual recovery is acceptable.
    looks_like: warning.png
  - label: Precise + automatic
    title: Precise automatic recovery
    prioritizes: never leaving a job stuck, at the cost of durable request identities and more code
    changes: |
      - Every hand-off gets a stored id and result; a retry with the same id gets the same job back.
      - A stuck job is recovered automatically from the stored acceptance.
    why: |
      - Stuck jobs recover on their own; you never touch them.
    why_not: |
      - Stored ids and results for the life of the page, more code, and a second place a bug can hide.
    assumes: |
      - Lost replies are common enough to be worth the machinery.

tradeoffs:
  - concern: Lost connection
    A: "yellow: May need inspection, Cancel or Run again"
    B: "green: Recover original job or stored acceptance automatically"
  - concern: Complexity
    A: "green: No permanent receipts or new endpoint"
    B: "yellow: Durable request identities and more code"
  - concern: Idle waits
    A: "green: Normal idle waits stay"
    B: "green: Normal idle waits stay; no permanent empty history"

recommendation:
  option: A
  why: Fix the misleading timeout and stop risky automatic repeats; accept occasional manual recovery instead of building precise replay.
  changes_my_mind: If stuck jobs turn out to be frequent, pick B.

next_steps:
  heading: build only the chosen one
  A: Ship the warning and Cancel this week.
  B: Design the id and storage first, about a week.
  if_no_answer: Nothing changes; stuck jobs stay invisible.

attachments: [warning.png, flow.png]
`;

export function rulesText() {
  return `${CONTRACT}\n\n--- card.yaml ---\n${TEMPLATE}\n\n--- An example (agentpager example > card.yaml) ---\n${EXAMPLE}`;
}
