## Project docs

Work items live on GitHub Issues, knowledge lives in these docs. Read alongside:
- **GitHub Issues** — labels `bug`, `deferred`, `known-issue`, `decision` and `blocked`. **At the start of a session, load open decisions with `gh issue list --label decision --state open` and treat each as "don't assume an answer here". If the command fails, say so.** Before starting work in an area, check `deferred` issues whose "Pick up when" matches. Don't start an issue labelled `blocked`.
- `DECISIONS.md` — the log of decisions made, and why. **If you hit an unsettled convention or product question, raise it as a `decision` issue rather than picking one silently.**
- `PROJECT_CONTEXT.md` — what the project is, its origin, future directions, and which pieces are in learning mode.

**Reading pages** (steps in the project-docs skill; links in `PROJECT_CONTEXT.md`):
- Before building anything that touches several pieces, publish a **plan page** and wait for the go-ahead.
- When a feature, fix, refactor, milestone or plan pass is done, make the **recap** without asking, then ask the user to test. Run close-out only when they say "close out".

**Where things go:**
- What we want isn't settled → `decision` issue.
- Settled, but not built or incomplete → `known-issue` issue.
- Needed, found while doing something else, parked on purpose → `deferred` issue.
- Supposed to work and doesn't → `bug` issue.
- Can't be done until something else is settled → add `blocked` and "Blocked by #N".
- Found mid-task → mention it in chat, it's created as an issue at close-out after the user approves.

**When something is decided:** add the next `D#` to `DECISIONS.md` with the reasoning and "(from #N)", close the issue with a pointer to it, unblock anything "Blocked by" it, and fold the rule into this file (if it's a convention) or a new issue (if it creates work).

**Habits that keep the docs trustworthy:**
- Close issues with a reason, never delete them. Strike through superseded doc entries rather than deleting them.
- Never renumber `D#`. Reference issues by number (`#32`) in code comments and docs instead of restating them.
- A PR that resolves an issue says `Fixes #N`.
- When behaviour, setup, or commands change, update the affected doc in the same change.

## Conventions

How code is written in this project. A decision in `DECISIONS.md` that creates a convention gets folded in here once it's decided.

**Comments:** use the `outline-style-comments` skill whenever writing or reviewing code comments or docstrings. In short: explain why, not what, the first line is a self-contained summary so folded code still reads clearly, with detail beneath it, number ordered steps, and give distinct JSX/markup blocks banner comments.

**Randomiser logic:** all rules live in a pure `rollComp` function with Vitest tests, and no UI code inside it. History is read and written only through `src/lib/history.ts`, so the storage can change later (D3).

*Add further project conventions here as short sections: naming and file layout, error handling, and a definition of done (the commands that must pass before a task counts as finished).*
