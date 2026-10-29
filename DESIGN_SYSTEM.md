# DESIGN_SYSTEM.md

The visual rules for the app, and where the build differs from the design. The design was chosen on a canvas in October 2026 (your dark palette with role-tinted agent cards). All styles live in `src/index.css`, and every colour, size and radius comes from the tokens at the top of that file, so a look change is one line there.

## Principles

- **Phone first.** The team uses this before a game, often on a phone. The base CSS is the phone layout, and one `min-width: 721px` block per section widens it.
- **The comp is the star.** The five team cards, which are the rolled comp, come first on the page, and Roll and Lock in are always within reach: pinned to the bottom on phones, beside the title on wide screens.
- **Role colour carries meaning.** A role's colour, text colour and card tint travel together, set by giving an element the role's class (`.duelist`, `.initiator`, `.controller`, `.sentinel`).
- **Everything player-specific is in one Configure window**, opened by one three-dots button per card: name, bans, Remove from team and Forget.
- **Hosted on the Lab (D14).** Fonts and images go through Vite so every path stays relative to the page.

## Tokens

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0f1923` | Page, inputs, dialog |
| `--panel` / `--panel-raised` | `#1a2733` / `#22313f` | Panels, tiles / the wide-screen menu |
| `--line` / `--line-strong` | `#2c3b49` / `#3a4856` | Borders / switches, chips, sheet handle |
| `--text` / `--text-soft` / `--muted` | `#ece8e1` / `#cfd3d8` / `#9aa6b2` | Main, secondary and label text |
| `--accent` / `--accent-hover` / `--accent-text` | `#ff4655` / `#ff6674` / `#ff6b78` | Roll, switches, banned tiles / the same red as text |
| `--role`, `--role-text`, `--role-tint` | set per role | Card art square, role label, card background |
| `--radius` / `--radius-sm` | `16px` / `10px` | Panels and cards / inputs and buttons |

Role values, from the same four lines in `index.css`:

| Role | Fill | Text | Tint |
|---|---|---|---|
| Duelist | `#ff4655` | `#ff6b78` | `#3a2029` |
| Initiator | `#f2a93b` | `#f2a93b` | `#38301f` |
| Controller | `#9b7bff` | `#b29dff` | `#2a2650` |
| Sentinel | `#3ec9b0` | `#3ec9b0` | `#153a3c` |

Text colours were lightened where the fill failed 4.5:1 contrast on its tint.

## Type

- **Display:** Barlow Condensed 500, 600 and 700 (Latin only), bundled with `@fontsource/barlow-condensed`. Used uppercase for the title, panel labels, agent names, role names and Roll.
- **Body:** the system font. Inputs are 16px or larger so iOS does not zoom on focus.

## Components

| Piece | File | Rule |
|---|---|---|
| Roll and Lock in | `App.tsx` | Host only (D26). Roll is the big red button and Lock in sits beside it as an outlined button about 38% wide, grey until there is an unlocked comp and reading "Locked in" after. Fixed to the bottom on phones with space left under the last panel, static beside the title on wide screens. Pressing Roll scrolls the result into view only if it is off screen. Only Lock in writes to history |
| Cards | `CardRow.tsx`, `TeamCards.tsx` | The team is five cards that are also the roll's result (D-new1), under a Team heading with Start a party beside it. Phone: a strip of five portraits, each a square on the role colour with the agent's name in role colour and the player under it, so the comp is one short band (D23). The role is left to the colour and stays in the text for screen readers. From 721 px the cards are rows: the portrait on a role-colour square on the right, the whole portrait showing, two across from 721 to 979 px and five across from 980 px at about 72 px tall. All five appear together with a short fade and rise, switched off for reduced motion. A card is one of four things, always five in this order: players, then random teammates, then Empty cards. **Waiting** is a "?" on a neutral portrait with "Waiting" where the role goes and the name where the agent goes (an unnamed player is "Player 2"). **Rolled** is the agent, role and player. **Random teammate** (D28) is dimmed with a dashed outline (round the portrait on the strip, round the whole card on wide rows) and no name, and screen readers still hear "Random teammate". **Empty** is a dashed square with a plus, "Empty" as the role and "Add" where the agent goes. A joined friend's card has a dot on the portrait's top right (filled teal online, hollow grey ring offline), and on a member's page their own portrait is outlined (on wide rows a 2px ring drawn as an overlay border so the portrait cannot cover its right edge). On the host's page a tap does the most useful thing: an Empty card opens the Empty-card window, a random teammate's card opens a window to change their agent, a player's card locks that player's pick through the next Roll once there is a roll (D27: a 3px ring and a padlock badge on the portrait's top right), and before that opens Configure. A joined friend's waiting card does nothing when tapped, since the name comes from their device. The tap is an invisible button over the whole card. Under the cards a line says "Press Roll to give everyone an agent for the next game.", "Not locked in yet. Not saved to history." or "Locked in. Saved to history.", or while picks are locked "N locked. Roll changes the rest." with a Clear link, or "All locked. Tap one to change." when Roll is greyed out |
| Empty-card window | `CardDialog.tsx`, `AgentGrid.tsx` | The same window as Configure (`SheetDialog.tsx`: a bottom sheet on phones, a centred card on wide screens), opened by tapping an Empty card or a random teammate's card (D-new3). An Empty card's window, "Add", has a Player side (a name box with Add, and chips for saved people who are off the team: tap one to add them, the x forgets them) and every agent as tiles grouped by role, A to Z inside each, for someone not on the app. Typing a name and pressing Add makes a player and tapping an agent makes a random teammate, so there is nothing to choose first. A typed name that is already on the team disables Add. Adding closes the window. A random teammate's window has a short explanation, the agents with theirs outlined in its role colour (one another teammate has is greyed out and disabled), and a bar at the bottom with Remove teammate. Picking an agent or removing closes it. Escape, Done and tapping outside close it |
| Name field | `NameField.tsx` | The name box with a styled list of saved people, replacing the browser's own suggestion. It offers only saved people who are not on the team and whose name starts with what is typed, each with a note on what picking them fills in ("Fills in 2 bans" on wide screens, "2 bans" on phones). Nothing is highlighted until an arrow key or the pointer chooses, so Enter keeps a newly typed name. It opens upward when there is no room below. Arrow keys, Enter, Escape and tapping work |
| Configure | `ConfigureDialog.tsx` | One window for a player: Name (the name box with saved-people suggestions, which fills in bans for a saved name and clears them for a new one), then the shared `BanPicker` (role chips and agent tiles), then a bar at the bottom with Remove from team and Forget (named players only) (D-new2). Opened by the three-dots button on a player's card at any time, and by tapping a waiting player's card. The button sits on the portrait's bottom corner (28px on a dark wash, outside the card so the wide layout's rounded clipping cannot cut off anything). A native modal `<dialog>`: a bottom sheet on phones, nearly the height of the screen with a handle, and a centred 640px card on wide screens. The header with Done and the bottom bar stay put while the name and bans scroll between them, and changes apply as they are made. Forget asks first ("Forget Agu? This deletes their saved bans and history." with Cancel and Forget), because it deletes for good, and Remove does not, since it keeps their bans and history. A joined friend's window shows a line saying their name and bans come from their own device, and only Remove from team. Escape, Done and tapping outside close it |
| Ban tile | `BanPicker.tsx` | A real checkbox inside a label. Banned: greyed with a red slash. Hidden by a banned role: greyed only, with no slash, since role bans stay a separate list (D11) |
| Switch | `SettingsPanel.tsx` | A checkbox drawn as a track and knob |
| History | `HistoryView.tsx` | A strip of agent icons per player, newest on the right and outlined. Holds locked-in rolls only (D26) |
| Entry page | `EntryPage.tsx` | Always the first page, and the only page with Back to Projects (D14, D29). Two choices, 560px wide, stacked on phones and wide screens alike: Host, a solid red one-line button like Roll, 56px tall, reading "Host a team" with an arrow, with "Build the team and roll. Friends can join from their phones." as a caption under it, and Join, a tile that is always open: Party code as four boxes (typing moves on, Backspace goes back, a pasted code fills all four, and the last letter moves to the name), Your name, and Join party. A "Rejoin UMG7 as Sam" button for the last party (within three hours) sits above the Host button. A typo in the code or an empty name gives a plain line under the code. Reached again from the Home chip on the host's and a friend's pages, and after being removed or the party ending (D22, D23, D29) |
| Home chip | `HomeButton.tsx` | The way back to the entry page, at the top of the host's page ("Home") and a friend's page ("Leave party", or "Cancel" while joining). A filled chip in the raised panel colour with a house icon, 44px tall and fully rounded, so it reads as a button and not a link. On the host's page it ends any party being hosted, since a party only lives on the main page, and asks first ("Stop the party?" with Cancel and Stop and go home) only when a friend is connected, in a small modal `<dialog>` (`StopPartyDialog.tsx`) (D29) |
| Party in the Team heading | `TeamCards.tsx` | One button beside the Team heading: Start a party, which becomes Stop party in the same place once the party is open, so nothing moves (D24, D25). While hosting the code shows in brackets after Team, and on wide screens only a line under the heading advises hosting from a computer. There is no count of friends in: each friend's card has its own status dot |
| Toast | `Toast.tsx` | Every party message: a name taken, a code with no party, being removed, the party ending, and reconnecting. Above the Roll bar on phones, bottom centre 420px wide on wide screens, lower on the entry page and the joiner page, which have no Roll bar. Errors use the red tint and stay until closed. The rest fade after six seconds, and reconnecting stays until it is back in or gives up (D22) |
| Party member card | `CardRow.tsx` | A joined member's card shows their name and a status dot on the portrait: filled teal when connected, a hollow grey ring when offline. The menu on their card offers only Remove from team, since their name and bans come from their own device (D22) |
| Member page | `MemberView.tsx` | What a joined friend sees: a Leave party chip (the Home chip with the same house icon) above the title and party code, with no Back to Projects (D29), then the same five cards as the host's without taps (D-new1): before a roll waiting cards headed "Waiting for the roll", after a roll the agents headed "Your comp", with the host's random teammates and the Empty cards too, then Your bans. There is no Roll button or bar, since only the host rolls (D26), and under the comp a line says "Not locked in yet" or "Locked in". There is no Team panel: the name is under each portrait and the online dot is on it (D23). The host's unnamed players show to friends as Empty cards. Bans are inline and are the same picker as the Bans dialog, headed "Roles you never want" instead of "Roles they never want" (D23 follow-up). While joining, the page says "Connecting to the party…" and then "Asking the host to let you in…", and Leave party reads Cancel (D21) |

## Logo

The icon (`public/favicon.svg`) is a die face on the panel colour with an accent-red outline and five pips, one per player: duelist red top left, initiator amber top right, light centre, controller purple bottom left, sentinel teal bottom right. It uses the same hex values as the tokens above, and the favicon link is relative (`./favicon.svg`) to suit the Lab hosting (D14). It is favicon-only, not shown in the app's header.

## Where the build differs from the canvas

- **Agent art is 256 px**, from valorant-api.com, so wide-screen cards enlarge it less than the old 128 px set did and stay sharp (D31).
- **Desktop cards are short rows, not the tall cards the canvas drew**, and the Team panel is tighter, so the cards and the Rules panel fit a window about 1000 by 610. A tall card with a cropped portrait was tried and dropped because it hid the agent's face. Checked at 1000 by 610, 1440 by 900, 768 by 1024 and 1024 by 768. The longest name (Brimstone) fits at 1000 and 1440 wide. The Rules column never gets narrower than 312 px, so its stepper fits on a tablet in portrait.
- **A waiting joiner's card is the rolled card with a "?" portrait**, not the flat pill with an initial the canvas drew, so the roll fills in cards of the same size instead of swapping them.
- **Rules has a short hint** ("Minimum per role") because the "At least" label was dropped from each row.
- **The menu's Bans entry** shows its "Agents and roles they never want" caption on phones only.
- **Not drawn on the canvas, styled to match:** the Empty-card window's saved-people chips, the error message, and Configure on wide screens.
- **The five-card row follows the Team Cards Designs canvas, option C.** Differences: the three-dots button is 28px rather than the canvas's 20px so it can be tapped, and the Empty-card window lists agents grouped by role, as the Bans tiles do, rather than as one flat grid.
- **Unnamed slots** get a menu with Bans and Remove only, since there is nothing saved to forget (D10).

- **Random teammate cards dim their parts, not the card.** The reveal animation owns the card's own opacity, so the portrait and text are dimmed instead (D28).
- **The host's cards show online dots for joined friends.** The Team panel rows that used to show who is in are gone, so the dots (D23) now draw on the host's page too, only for friends who joined the party.

## How to use this file

- Read it before building or restyling UI. Change a token in `index.css` first, then update the table here.
- Add a line under "Where the build differs" whenever the build departs from a design.
- Companion docs: `DECISIONS.md`, `CLAUDE.md`, and the repo's issues.
