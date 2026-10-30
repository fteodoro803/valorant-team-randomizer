# PROJECT_CONTEXT.md

> Background context for this project. Read this before making changes. It explains what the project is, how it evolved, and what's known to be inconsistent or incomplete. Update this file as things get fixed or scope changes.

## What this is

A simple, fun web app for a team of 5 Valorant players. Phase 1 randomises everyone's agent for the next game. Later phases add little fun stats about how the team played.

- **Users:** it started as a tool for one team of 5 friends, and is now public but small (D17). No accounts yet. Stats will be opt-in for each player.
- **Devices:** a web page, used on a laptop or phone before a game.
- **Hosting:** the owner's portfolio site, as a Lab tool at `/lab/<id>/` (D14). It builds to static files, so it needs no server. Getting it listed there is #4.

**Stack:** TypeScript, React 19, Vite, Vitest. No backend or database in phase 1.

## Origin and current scope

The idea started in the owner's Project Ideas doc (Valorant Team App, 16 October 2026). That doc is the original home of the idea, and it will be retired once this repo's docs hold everything in it.

**Phase 1 (built, being tried by the team):**
1. Comp randomiser with a unique agent per player.
2. A range for each role (duelist, initiator, controller, sentinel): the fewest and most agents it may have in the comp, read out in words, a switch for each that turns it on or off without losing the range, and a sentence saying what the rules mean for the team (D1, D-new1).
3. A history-aware toggle so nobody is stuck on the same role. Keeps the last 10 rolls per player and weights against recent roles (D5).
4. Per-player bans: agents and whole roles they never want (D1, D11). The code calls the agent list excluded agents.
5. Players are saved by name. Typing a saved name, or pressing Add beside them in the saved list, fills in their bans, and their history follows the name (D8 to D10). A team has at most 5 players (D12).

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

Last alive, damage to teammates, clutches, body shots and kills on feet all need round-level and hit-location data. Options are Riot's official match API (needs an approved production key), an unofficial third-party API such as HenrikDev (round-level data, but a dependency the owner doesn't control), or entering results by hand (only enough for simple stats). It is tracked in #3 and has to be settled before phase 2 starts.

### Registering with Riot

Official match data needs an approved production key, and Riot Sign On (how players opt in) needs one too. A development key (valid for a day) cannot back a public app, and Riot doesn't support personal keys for Valorant. The plan is on the plan page below, in milestones:

1. **Security guidelines** (done): `.env` files are ignored, `npm run lint` fails if a Riot key appears in the source or build, and the footer carries both Riot notices.
2. **Demo flows with dummy data** (D18, D19, #16): linking an account, team stats of the week, a player who hasn't opted in, My data (opt out and delete) and My stats. Built inside this app, so Riot has something to test.
3. **Registration** (#18): the owner files the product on the Riot developer portal, with a link to the demo.
4. **After approval**: a server that holds the key (where it lives is #17), Riot Sign On, real match data, and settling #3.

Riot's rules to keep to:
- Stats are shown only for players who opted in, and only for the team, never opponents (no scouting).
- The key lives only on a server, never in the repo or in a `VITE_` variable.
- On a 429 response, wait for the `Retry-After` time. Don't depend on the body of non-200 responses.
- Data is deleted when a player asks, and when Riot passes on a deletion request.
- The product is registered once, and its portal page is updated whenever a stats feature changes.
- No money, ads or betting.

### A shared database

History is per browser in phase 1. If the team wants shared history, or phase 2 needs stored match records, the likely choice is MongoDB rather than Supabase (D6).

### Economy overlay

An older idea of the owner's: a browser extension that screenshots player economy each round and overlays it. It is separate from this app and not planned.

## Learning mode

Pieces to slow down on, per the owner's familiarity list. Everything else in the stack is at normal speed.

- **Vite**: new, builds on Meteor (sibling move: same npm and ES module world, no built-in server or database).
- **WebRTC (party codes)**: new, builds on Meteor pub/sub (same "changes pushed to everyone" idea, but there is no server in the middle to hold the data).

## How to use this file

- Treat this as background, not a task list. When asked to explore, map, or document the repo, use this file to understand intent. Don't treat it as a prompt to start fixing things.
- When an item above gets resolved, update this file so it stays accurate (strike it through and annotate; don't delete or renumber).
- Companion docs: `DECISIONS.md` (decision log), `LEARNINGS.md` (what was learned building it), `CLAUDE.md` (conventions and standing rules), and the repo's GitHub issues (bugs, deferrals, known issues and open decisions).
- Docs page: https://claude.ai/artifact/6E4tDFwY7mRTdDeFwcg2hS
- Plan page: https://claude.ai/artifact/FNB1NvxoTqM3dzzszU6d3R
- Recap page: not published
