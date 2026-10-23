# PROJECT_CONTEXT.md

> Background context for this project. Read this before making changes. It explains what the project is, how it evolved, and what's known to be inconsistent or incomplete. Update this file as things get fixed or scope changes.

## What this is

A simple, fun web app for a team of 5 Valorant players. Phase 1 randomises everyone's agent for the next game. Later phases add little fun stats about how the team played.

- **Users:** one team of 5 friends. No accounts, no public audience.
- **Devices:** a web page, used on a laptop or phone before a game.
- **Hosting:** none chosen yet. Phase 1 builds to static files, so any static host works.

**Stack:** TypeScript, React 19, Vite, Vitest. No backend or database in phase 1.

## Origin and current scope

The idea started in the owner's Project Ideas doc (Valorant Team App, 16 October 2026). That doc is the original home of the idea, and it will be retired once this repo's docs hold everything in it.

**Phase 1 (planned, not built):**
1. Comp randomiser with a unique agent per player.
2. Toggles for the minimum number of agents per role (duelist, initiator, controller, sentinel).
3. A history-aware toggle so nobody is stuck on the same role. Keeps the last 10 rolls per player and weights against recent roles (D5).
4. A per-player list of agents they never want (D1).

**Phase 2 (not scoped):** stats of the week and agent and role stats. These need round-by-round data, which depends on where the match data comes from. That question is open.

**Stats wanted:**
- Most body shots
- Most knife kills
- Most last alive (biggest baiter)
- Most damage to teammates
- Most clutched against
- Foot killer (most kills on feet)
- Agent stats
- Role stats

## Known issues

Settled-but-unbuilt work lives on GitHub as issues labelled `known-issue`. Open questions are `decision` issues, bugs are `bug` issues, and changes parked mid-task are `deferred` issues.

## Future directions (deferred — not scoped, not started)

### Match data source for stats

Last alive, damage to teammates, clutches, body shots and kills on feet all need round-level and hit-location data. Options are Riot's official match API (needs an approved production key), an unofficial third-party API such as HenrikDev (round-level data, but a dependency the owner doesn't control), or entering results by hand (only enough for simple stats). It needs a `decision` issue before phase 2 starts.

### A shared database

History is per browser in phase 1. If the team wants shared history, or phase 2 needs stored match records, the likely choice is MongoDB rather than Supabase (D6).

### Economy overlay

An older idea of the owner's: a browser extension that screenshots player economy each round and overlays it. It is separate from this app and not planned.

## Learning mode

Pieces to slow down on, per the owner's familiarity list. Everything else in the stack is at normal speed.

- **Vite**: new, builds on Meteor (sibling move: same npm and ES module world, no built-in server or database).

## How to use this file

- Treat this as background, not a task list. When asked to explore, map, or document the repo, use this file to understand intent. Don't treat it as a prompt to start fixing things.
- When an item above gets resolved, update this file so it stays accurate (strike it through and annotate; don't delete or renumber).
- Companion docs: `DECISIONS.md` (decision log), `CLAUDE.md` (conventions and standing rules), and the repo's GitHub issues (bugs, deferrals, known issues and open decisions).
- Docs page: not published (no architecture map or learnings file yet)
- Plan page: https://claude.ai/artifact/FNB1NvxoTqM3dzzszU6d3R
- Recap page: not published
