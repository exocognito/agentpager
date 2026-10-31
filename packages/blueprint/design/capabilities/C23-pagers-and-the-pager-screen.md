---
id: C23::pagers-and-the-pager-screen
serves:
  - SC1
  - SI2
  - SP6
statement: Open AgentPager to see your pagers, which are on and how many decisions wait on each; open one to see its decisions grouped by project, with who asked.
caveats:
  - The list belongs to one phone. Nothing joins pagers across phones.
  - Deleting the app, or losing the keys it stores, loses its pagers. There is no recovery.
  - The screens refresh only while the app is open. A closed app learns nothing until it is opened, except through C17::get-paged's alerts.
  - Pagers belong to the server they were made on. With another server set in iOS Settings, the phone shows only the pagers made there.
---

## Behaviors

1. Pagers, the app's first screen, lists this phone's pagers. Each row gives the pager's name, a green dot when it is active or grey when it is off, its status worded as in C22, and, while active, a blue badge with how many decisions are open on it. Rows show no number. With no pagers, the screen says to make one and give its number to agents. The + button makes a pager (C26).
2. Tapping a pager opens its screen, titled with its name. Its gear opens the pager's detail (C22).
3. A pager's decisions are grouped by project. Projects with open decisions come first, the one waiting longest on top. In each project, open decisions come oldest first, each with its question, who asked and how long ago.
4. Each project folds its answered decisions into an "N answered" row that opens them (C7). With nothing open in that project, the row also names who asked, such as "5 answered · Codex, pi".
5. While the app is open, its screens refresh about every 3 seconds, and pulling down on a pager refreshes it.
6. The phone lists the pagers whose keys it holds, as the service reports them; the service knows no pager's name. A pager the service says no longer exists is dropped. While the service can't be reached, the phone shows its last read, and Pagers says "Can't Reach Server" with when it last updated.

## Never

1. A pager made on another phone shows on this one.
