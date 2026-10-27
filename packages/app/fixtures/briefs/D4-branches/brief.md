## Context: old preview branches
14 preview branches are merged into main. None has an open pull request.

## Options

## Tradeoffs
|               | A Delete          | B Keep             |
|---------------|-------------------|--------------------|
| Preview sites | :orange[Go down]  | :green[Stay up]    |
| Branch list   | :green[14 shorter] | :yellow[Cluttered] |

## Recommendation: A
**Why:** Every commit stays on main, and nobody has opened these previews in 30 days.
**Assumes:** No doc or ticket links to these previews. If one does, pick B.

## Next steps: clean up
**After this decision:** I delete them now. It takes a minute.
**If no decision:** They stay. Nothing breaks.
