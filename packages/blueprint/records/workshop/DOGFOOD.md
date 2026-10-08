# OwnerPager dogfood on the mini: tests and required outcomes

A brief for an agent that plans and runs a full human-style dogfood of OwnerPager. It says what to test and what counts as a pass. It leaves the plan, the order and the tooling to that agent.

## Goal

An owner with any common agent client can pair a phone, answer questions, come back later, and end the session, without help beyond what ownerpager.com and `/start` say. The dogfood proves this the way an owner would find out: by using real apps on real screens, not by calling the API.

## Ground rules

- **Target:** a developer deploy of OwnerPager, not `ownerpager.com`, because MSTART runs deploy there. Name it in the plan. Sam sets it up. If it is missing, stop and ask.
- **Driver:** computer use on the mini: Chrome, the desktop apps, and the phone through iPhone Mirroring or a simulator. Sam signs in to every app beforehand. The agent never enters passwords, never creates accounts and never clicks through bot or CAPTCHA checks. It reports the blocked step instead.
- **Cold agent:** each client starts in a fresh conversation, in an empty directory where that applies, with no notes about OwnerPager. Its first prompt is exactly: "Read https://<target>/start and show me how to use OwnerPager, then use it to ask me on my phone which of two options to take, and wait for my answer." The tester never tells the agent how OwnerPager works. It acts only as the owner would: tapping, scanning, answering, and doing any owner step the agent asks for.
- **Evidence per test:** a screen recording or screenshots of the agent and the phone at each step, the agent's transcript, times from first prompt to acknowledgement, and the outcome: pass, fail, or not sampled (with the error).
- **Issues:** log each problem once, with the test ID, what the owner saw, what they expected, and screenshots. Keep going after a failure; only a blocked app stops a test.

## Clients to cover

The **Setup** column is what the owner must do before or during the test.

| ID | Client | Surface the agent runs on | Setup |
| --- | --- | --- | --- |
| A1 | pi | terminal on the mini | none |
| A2 | Claude Code | terminal on the mini | none; the MCP route needs `claude mcp add` if the agent asks for it |
| A3 | Codex CLI | terminal on the mini | network enabled in its sandbox |
| A4 | opencode (or zcode) | terminal on the mini | none |
| A5 | Claude desktop app | macOS app | custom connector, added when the agent asks |
| A6 | ChatGPT (developer mode) | web or desktop app | connector, added when the agent asks |
| A7 | Claude web | Chrome on the mini | custom connector |
| A8 | Claude mobile app | the phone | connector added on the web first |
| A9 | ChatGPT mobile app | the phone | report as not sampled if developer mode is not offered |
| A10 | Cursor or VS Code agent mode | desktop IDE | optional; run it if Sam installs one |

## Phone browsers to cover

| ID | Phone surface |
| --- | --- |
| P1 | Safari on iPhone, reached by scanning the QR code from the mini's screen |
| P2 | Chrome on iPhone |
| P3 | The in-app browser a chat app opens when the owner taps the link (A8, A9) |
| P4 | A private tab |
| P5 | Desktop Chrome on the mini, as an owner without a phone at hand |

## Tests and required outcomes

Run T-A for every client in A1–A9; each run uses one phone surface. Across all runs, cover every phone surface at least once. Run T-B through T-L at least once each, on any client, and on more than one where the test note asks.

| ID | Test | Pass when |
| --- | --- | --- |
| T-A | **Cold start to answer.** Give the cold prompt and follow the agent. | Within 10 minutes the agent shows a link or QR code, the phone pairs, the agent asks a two-option question, the owner answers, and the agent reports the exact answer and acknowledges it. The phone shows the acknowledgement. The owner never needs anything beyond what the agent and the pages said. |
| T-B | **MCP setup when asked.** Use a client that can only fetch pages (A5–A9). | The agent says clearly which owner step is needed, and where in the app. The owner can do it by following those words alone. Afterwards the same conversation continues, or the agent tells the owner exactly how to restart. |
| T-C | **Long wait.** Answer the question 5 minutes after it appears, then again after 20 minutes. | The agent is still waiting, or says plainly that it stopped and how to resume. It then picks up the answer without a new pairing. Never: a silent stop, a wait handed to a background job, or a false "no answer". |
| T-D | **Close the tab and come back.** After pairing, close the phone tab. An hour later, reopen the site via the front page, the pairing link and the session link, in turn. | Each route leads back to the same inbox with its history, in the same browser. The front page offers a way back to the live session. |
| T-E | **In-app browser return.** Pair from a link tapped inside a chat app (P3), leave the app, and come back later. | The owner can find the session again: through the chat app's link, the front page in the phone's main browser, or instructions on the page. Record the exact route that works, or that none does. |
| T-F | **Owner ends it.** On the phone, tap End session, go back once, then end it for real. Then ask the agent to ask another question. | Going back keeps the session open. Ending asks for confirmation, then shows that the owner ended it, with no buttons. The agent is told the session ended, by the owner, and offers to start a new one. |
| T-G | **Agent ends it.** Ask the agent to end the session straight after it acknowledges an answer. | Within one poll the phone shows that the agent ended it, and shows the agent's last message. Later calls from either side are refused, naming who ended it. |
| T-H | **New session in the same browser.** After T-F or T-G, have the agent start a new session and open its link in the same phone browser. | The new session's inbox opens, not the old ended screen. The front page points to the new session. |
| T-I | **Second phone refused.** Open a claimed pairing link on a second browser or in a private tab (P4). | The second browser is refused with a clear message; the first keeps working. |
| T-J | **Expired or rotated link.** Wait until the unpaired link rotates (7 minutes), then open the old link. | The old link is refused with a clear message, and the agent can show a fresh one when asked, or does so itself. |
| T-K | **Other reply and limits.** Answer with Other, using Markdown, an emoji and an option number; then try text over 420 characters. | The agent reports the exact text. Over-limit text cannot be sent, and the phone says why. Nothing is cut short. |
| T-L | **Expiry shown.** Check the phone's footer during a session and after an exchange. | The footer shows an expiry time that moves forward after each accepted question, answer or acknowledgement, and not after page reloads. The 25-hour wait itself is not observed. |

## Outcomes the report must give

1. A table of every client and phone surface run, with pass, fail or not sampled, and the time from prompt to acknowledgement.
2. The issue list, grouped by where the owner met it: start page, pairing, answering, waiting, coming back, ending.
3. For each failure, whether a change to `/start` wording would fix it, or it needs a product or Blueprint change. Which to fix is Sam's call.
4. Every owner step the agent asked for that `/start` does not describe.
5. Any app or step that blocked the tester (sign-in, bot check, missing feature), for Sam to set up.

## Out of scope

- Load, abuse and security testing.
- Android, unless Sam provides a device.
- Waiting out real expiry (25 hours).
