---
id: C18::website-points-to-the-app
serves:
  - SC1
  - SP5
statement: agentpager.me tells an agent that arrives without the agentpager command how to install it, says what AgentPager does and how to get the app, and says what the service stores and for how long.
caveats:
  - The page's words are design. Nothing about conversion or comprehension is measured.
---

## Behaviors

1. An agent that reads agentpager.me/start, or the retired agentpager.me/mcp, learns how to install the agentpager command and then how to connect with the number its owner gave it (C25). If it can't install the command where it runs, it is told to stop and tell its owner, not to work around it. An agent that reads agentpager.me itself is pointed to /start.
2. *Not built yet: comes with the marketing page.* The front page says what AgentPager does and how to get the app, and gives the one line that installs the command (C29). Today it still describes the first version, with QR codes, emoji pairing and a planned Pro plan.
3. *Not built yet: comes with the marketing page.* A note on the site lists what the service stores and for how long. For each pager: its public key, its phone key as a digest, whether it is on and when it turns off, and where its phone gets alerts, until the pager is deleted. For each agent: who asked, its project and computer, its key as a digest, and its decisions with their attachments, answers and acknowledgements, until its pager is deleted or it has had no activity for 30 days. The note also says that there is no account, that a pager's name stays on the phone, and that alert text passes through Apple.
