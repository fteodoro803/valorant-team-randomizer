# DECISIONS.md

The log of decisions made about this project, and why. Open questions live on GitHub as issues labelled `decision`, where anyone can weigh in and the owner makes the call. Once a call is made, it's recorded here.

## What belongs here

- **This file**: decisions that were made, with the reasoning, so later work doesn't reopen them by accident.
- **Not here**:
  - An open question → a `decision` issue.
  - Work a decision creates → its own issue (`known-issue`, `deferred` or `bug`).
  - A convention a decision creates → `CLAUDE.md`, linked from the row.

---

## Decided

| # | Decision | Documented in |
|---|---|---|
| D1 | **Phase 1 is the comp randomiser only.** It has role toggles (a minimum number of duelists, controllers, initiators and sentinels, each switchable), history-aware rolls and a per-player list of excluded agents. Stats wait for phase 2, because the stats data source is still undecided. | `PROJECT_CONTEXT.md` |
| D2 | **Stack is Vite + React 19 + TypeScript, with no backend in phase 1.** It is the smallest thing that works, and only Vite is new to the owner. A database arrives with phase 2 (match records). | `PROJECT_CONTEXT.md` |
| D3 | **History is stored in the browser (`localStorage`) behind a small interface in `history.ts`.** The team isn't sharing history in phase 1, and the interface keeps a later switch to a shared database small. | `PROJECT_CONTEXT.md` |
| D4 | **Every roll counts toward history, with no Lock in button.** It saves a tap per game. The cost is that rerolling skews the history, so a lock-in can be added later if that becomes annoying. | `PROJECT_CONTEXT.md` |
| D5 | **History pushes softly and keeps the last 10 rolls per player.** The more often a player had a role recently, the less likely they get it again, but it can still happen when the toggles force a role. A player who sits out keeps their own last 10 rather than losing them. A hard "never the same role twice" rule clashes with the role minimums for only 5 players. | `PROJECT_CONTEXT.md` |
| D6 | **If a database is added later, it will be MongoDB, not Supabase.** Recorded as a direction only, not a commitment. | `PROJECT_CONTEXT.md` |
| D7 | **The project runs on Node 24.** Pinned with `.nvmrc` and `engines`. Node 24 ships npm 11, which also avoids a crash that npm 10.8.2 hit installing this project's dependencies. | `CLAUDE.md` |

---

## How to use this file

- **Record** a decision as the next `D#`: bold the one-line decision, put the reasoning after it, and note "(from #N)" if it came from a `decision` issue. Fill "Documented in" with the file(s) where the rule now lives.
- **Close the issue** it came from with a comment pointing here, and unblock anything that said "Blocked by" it.
- **Never renumber.** Gaps are fine; other docs cross-reference `D#`.
- **Follow-ups** to a decision get their own row, labelled `D# (follow-up)`, rather than an edit that changes what the original said.
- Companion docs: `PROJECT_CONTEXT.md`, `CLAUDE.md`, and the repo's issues.
