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
| D5 (follow-up) | **History weighs the whole team's roles together, not one player at a time.** A team's chance is the product of each player's role weights among the teams that meet the minimums, so required roles go to whoever has had them least rather than to whoever comes last in a random order. Chosen by the owner after the first version weighed players one at a time. | `src/lib/roll.ts` |
| D6 | **If a database is added later, it will be MongoDB, not Supabase.** Recorded as a direction only, not a commitment. | `PROJECT_CONTEXT.md` |
| D7 | **The project runs on Node 24.** Pinned with `.nvmrc` and `engines`. Node 24 ships npm 11, which also avoids a crash that npm 10.8.2 hit installing this project's dependencies. | `CLAUDE.md` |
| D8 | **A player is identified by their name, not their slot.** Names are compared ignoring capitals and extra spaces. Typing a saved name fills in that person's excluded agents, and their history is filed under the name so it follows them. History saved against the old slots was cleared, since it could not be tied to anyone. Renaming someone starts a new person with empty history. | `src/lib/roster.ts` |
| D9 | **Saved people can be forgotten, separately from removing a player from the team.** The team's remove button is now an X. "Forget" deletes the saved person and their history, and is the way to clean up a typo. | `src/components/PlayerList.tsx` |
| D9 (follow-up) | ~~**Pressing X offers Remove or Forget in the player's row.** Remove saves the person's current exclusions first and keeps their history, so they can be added back by typing their name. Forget also deletes both, the same as the Forget button in the Saved players list. An unnamed slot only gets Remove. They are icons, with Forget first as a trash can and Remove second as a person with a minus, each with a hover label.~~ Replaced by D15: the X is now a three-dots menu. | `src/lib/roster.ts` |
| D10 | **Unnamed slots still roll but aren't remembered.** No history or excluded agents are saved for them. Two players can't share a name. | `src/App.tsx` |
| D11 | **Players can ban whole roles as well as agents.** Role bans are their own list per player, so un-banning a role leaves the agent bans as they were. They are saved with the person and filled in by name like agent bans. A roll that needs a role every player has banned, or a player who has banned everything, is refused with a message, rather than quietly ignoring the minimum. Chosen by the owner. | `src/lib/roll.ts` |
| D12 | **A team has at most 5 players, saved people can be added back with an Add button, and removing a player lowers the role minimums to fit.** The + buttons stop when the minimums equal the team size. When a player is removed and the minimums no longer fit, the largest minimum is lowered first, and on a tie the later role in the list (so sentinel before controller). A saved team of more than 5 is trimmed to its first 5 on load. | `src/lib/minimums.ts`, `src/lib/roster.ts` |
| D13 | **Agent icons come from the VALORANT wiki, resized to 128px, skipping the Early, Shatter and Crusader ones.** They live in `public/agents/`, one file per agent named by the agent (KAY/O is `kayo.png`). A test fails if an agent has no icon, so each new agent needs their icon added with them. The artwork is Riot's, so the page footer carries the notice Riot's "Legal Jibber Jabber" policy requires (#5). | `src/data/agents.ts` |
| D14 | **The app is hosted on the owner's portfolio site, as a Lab tool at `/lab/<id>/`.** The portfolio builds it from this repo with `npm ci && npm run build` and publishes `dist`. So the Vite `base` is `./` (every file is addressed relative to the page), the page has a "Back to Projects" link to `../`, and it does not depend on the portfolio's CSS or scripts. Adding its entry to the portfolio's `lab-tools.json` is tracked in #4. | `vite.config.ts` |
| D15 | **The page uses a dark palette with role-tinted agent cards, and player edits sit behind a three-dots menu.** Barlow Condensed headings, bundled by Vite (D14). Roll is pinned to the bottom on phones. Each player row is a name box and a three-dots button holding Bans, Remove from team and Forget (replacing the X of D9 follow-up). Bans are a tile picker with role chips, and the row shows no ban count. An agent hidden by a banned role is greyed with no tag, since role bans stay separate (D11). Name suggestions are an app-drawn dropdown offering only saved people not on the team, with nothing highlighted until an arrow key or the pointer chooses. Agent icons stay at 128px, because larger ones could not be fetched from the wiki's image host. Chosen by the owner on a design canvas over several rounds (fixes #6). | `DESIGN_SYSTEM.md`, `src/index.css` |
| D16 | **Saved people sit under the team as small chips, and the panel is called Team.** Only saved people who are off the team show, as chips under a "Saved" label: tap one to add them, the x forgets them. The row is hidden when nobody is off the team, so it never repeats the rows above. This replaces the collapsible "Saved players" list behind the Add buttons of D12. A short row of comp cards is centred rather than left-aligned. | `src/components/PlayerList.tsx`, `src/index.css`, `DESIGN_SYSTEM.md` |

---

## How to use this file

- **Record** a decision as the next `D#`: bold the one-line decision, put the reasoning after it, and note "(from #N)" if it came from a `decision` issue. Fill "Documented in" with the file(s) where the rule now lives.
- **Close the issue** it came from with a comment pointing here, and unblock anything that said "Blocked by" it.
- **Never renumber.** Gaps are fine; other docs cross-reference `D#`.
- **Follow-ups** to a decision get their own row, labelled `D# (follow-up)`, rather than an edit that changes what the original said.
- Companion docs: `PROJECT_CONTEXT.md`, `CLAUDE.md`, and the repo's issues.
