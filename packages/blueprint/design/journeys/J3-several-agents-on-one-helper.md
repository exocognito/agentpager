---
id: J3::several-agents-on-one-helper
status: draft
for:
  - C13::set-up-supported-agents-with-one-helper
  - C14::receive-existing-answers-through-the-helper
  - C15::see-connection-and-activity-without-prompting
  - C1::pair-a-phone-by-qr
  - C6::send-feedback
  - C8::home-lists-this-browsers-sessions
  - I3::independent-decisions
  - I6::send-and-acknowledgement
  - I9::owner-channel-only-answers-existing-decisions
---

## Statement

An owner installs one helper on a spike VM, connects two supported client families, pairs their separate sessions to one phone browser and answers both while observing their native activity.

## Steps

1. Use guided setup once on the Linux VM to connect its real Codex CLI and Pi clients, preserving unrelated configuration; start one session in each and pair both independently to the same phone browser.
2. Observe generation, a tool call and idle for each session through real runtime events. Refresh phone status while idle and verify no model turn or prompt is created.
3. Post one decision from each agent and let both turns become idle. Answer the second with feedback, then the first with an option. Each answer resumes only its originating session and receives that agent's acknowledgement.
4. Rerun setup and disconnect one client. Its helper integration stops, the other session continues, and neither client's unrelated settings or session history changes.
5. Complete a separate fresh no-helper remote-MCP decision flow, including feedback and acknowledgement, without using the installed helper's local tools or credentials.

## Caveats

1. The shortest product journey remains J1 and the longest current session remains J2; this is an additional cross-client setup and isolation walk, not their replacement.
2. The two-family VM target is sampled, not universal agent support or machine-wide pairing. A passing phone-browser walk does not prove native notifications.
