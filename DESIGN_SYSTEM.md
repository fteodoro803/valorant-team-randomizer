# DESIGN_SYSTEM.md

The visual rules for the app, and where the build differs from the design. The design was chosen on a canvas in October 2026 (your dark palette with role-tinted agent cards). All styles live in `src/index.css`, and every colour, size and radius comes from the tokens at the top of that file, so a look change is one line there.

## Principles

- **Phone first.** The team uses this before a game, often on a phone. The base CSS is the phone layout, and one `min-width: 721px` block per section widens it.
- **The comp is the star.** The rolled comp comes first on the page, and Roll and Lock in are always within reach: pinned to the bottom on phones, beside the title on wide screens.
- **Role colour carries meaning.** A role's colour, text colour and card tint travel together, set by giving an element the role's class (`.duelist`, `.initiator`, `.controller`, `.sentinel`).
- **Everything player-specific sits behind one three-dots button** per row: Bans, Remove from team and Forget.
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
| Comp card | `CompResult.tsx` | Phone: a strip of five portraits, each a square on the role colour with the agent's name in role colour and the player under it, so the comp is one short band (D23). The role is left to the colour and stays in the text for screen readers. From 721 px the comp is rows again: the portrait on a role-colour square on the right, the whole portrait showing, two across from 721 to 979 px and five across from 980 px at about 72 px tall, so the Team panel stays on screen below them. All five appear together with a short fade and rise, switched off for reduced motion. On a member's page the member's own portrait is outlined on the strip, and on wide rows the whole card gets a 2px ring drawn as an overlay border so the portrait cannot cover its right edge (same as the padlock ring), and a dot sits on each portrait's top right (filled teal online, hollow grey ring offline). On the host's page a card is a button that locks that player's pick through the next Roll (D27): a 3px ring (round the portrait on the strip, round the whole card on wide rows) and a padlock badge on the portrait's top right. Under the comp a line says "N locked. Roll changes the rest." with a Clear link, or "All locked. Tap one to change." when Roll is greyed out. Joiners' cards are plain. On the host's page, random teammates (D28) follow the players as dimmed cards with a dashed outline (round the portrait on the strip, round the whole card on wide rows), with no name under the agent (screen readers still hear "Random teammate"). The role colour stays, dimmed, so the comp's roles still read. They can't be tapped or locked |
| Player row | `PlayerRow.tsx` | A name box and a three-dots button. Add player and Add random teammate are two dashed buttons side by side under the last row, the height of a player row, both greyed out at five people on the team (D24, D28). On wide screens with a mouse the rows, buttons and panel padding are tighter; a touch screen keeps 44px targets |
| Random teammate row | `TeammateRow.tsx` | For someone on the team who isn't using the app (D28). Looks like a player row: a solid box that fills the width, with a small "Random" tag, then the picked agent's portrait and name (or "Pick an agent"), and an x button in the same column as the three dots so they line up. Tapping the box opens the agent picker. Sits under the players, above the Add buttons |
| Agent picker | `AgentPickerDialog.tsx` | The Bans dialog's modal and tiles with one choice: tapping a tile picks it and closes the dialog, with no Done. Not picked yet clears and closes, and Close leaves it as it was. A picked tile is outlined in its role colour, and an agent another random teammate has is greyed out and disabled |
| Bench | `PlayerList.tsx` | Chips under the team for saved people who are off the team: tap a chip to add them, the x forgets them. Hidden when nobody is off the team, so it never repeats the rows above. Replaces the collapsible "Saved players" list |
| Name field | `NameField.tsx` | The name box with a styled list of saved people, replacing the browser's own suggestion. It offers only saved people who are not on the team and whose name starts with what is typed, each with a note on what picking them fills in ("Fills in 2 bans" on wide screens, "2 bans" on phones). Nothing is highlighted until an arrow key or the pointer chooses, so Enter keeps a newly typed name. It opens upward when there is no room below. Arrow keys, Enter, Escape and tapping work |
| Player menu | `PlayerMenu.tsx` | Bans, Remove from team, Forget (named players only). Bottom sheet on phones, popover on wide screens. Escape, arrows and tapping outside work |
| Bans dialog | `BansDialog.tsx` | Role chips, then agent tiles grouped by role. A native modal `<dialog>`: full screen on phones, a centred card on wide screens. The header stays at the top while the tiles scroll. The role chips and agent groups are the shared `BanPicker.tsx`, which a party member's page also uses inline (D23 follow-up) |
| Ban tile | `BansDialog.tsx` | A real checkbox inside a label. Banned: greyed with a red slash. Hidden by a banned role: greyed only, with no slash, since role bans stay a separate list (D11) |
| Switch | `SettingsPanel.tsx` | A checkbox drawn as a track and knob |
| History | `HistoryView.tsx` | A strip of agent icons per player, newest on the right and outlined. Holds locked-in rolls only (D26) |
| Entry page | `EntryPage.tsx` | Always the first page, and the only page with Back to Projects (D14, D29). Two choices, 560px wide, stacked on phones and wide screens alike: Host, a solid red one-line button like Roll, 56px tall, reading "Host a team" with an arrow, with "Build the team and roll. Friends can join from their phones." as a caption under it, and Join, a tile that is always open: Party code as four boxes (typing moves on, Backspace goes back, a pasted code fills all four, and the last letter moves to the name), Your name, and Join party. A "Rejoin UMG7 as Sam" button for the last party (within three hours) sits above the Host button. A typo in the code or an empty name gives a plain line under the code. Reached again from the Home chip on the host's and a friend's pages, and after being removed or the party ending (D22, D23, D29) |
| Home chip | `HomeButton.tsx` | The way back to the entry page, at the top of the host's page ("Home") and a friend's page ("Leave party", or "Cancel" while joining). A filled chip in the raised panel colour with a house icon, 44px tall and fully rounded, so it reads as a button and not a link. On the host's page it ends any party being hosted, since a party only lives on the main page, and asks first ("Stop the party?" with Cancel and Stop and go home) only when a friend is connected, in a small modal `<dialog>` (`StopPartyDialog.tsx`) (D29) |
| Party in the Team panel | `PlayerList.tsx` | One button beside the Team heading: Start a party, which becomes Stop party in the same place once the party is open, so nothing moves (D24, D25). While hosting the code shows in brackets after Team, and on wide screens only a line under the heading advises hosting from a computer. There is no count of friends in: each friend's row has its own status dot. Add player is a dashed row under the last player (D24) |
| Toast | `Toast.tsx` | Every party message: a name taken, a code with no party, being removed, the party ending, and reconnecting. Above the Roll bar on phones, bottom centre 420px wide on wide screens, lower on the entry page and the joiner page, which have no Roll bar. Errors use the red tint and stay until closed. The rest fade after six seconds, and reconnecting stays until it is back in or gives up (D22) |
| Party member row | `PlayerRow.tsx` | A joined member's name is plain text in the name box's frame, with a status dot inside its right end: filled teal when connected, a hollow grey ring when offline, with the name dimmed. The words stay in the label and hover title. The menu offers only Remove from team, since their name and bans come from their own device (D22) |
| Member page | `MemberView.tsx` | What a joined friend sees: a Leave party chip (the Home chip with the same house icon) above the title and party code, with no Back to Projects (D29), then the comp strip (before a roll the same cards as a rolled comp, waiting: a "?" on a neutral portrait, "Waiting" where the role goes and the name where the agent goes (under the portrait on the strip), headed "Waiting for the roll"), then Your bans. There is no Roll button or bar, since only the host rolls (D26), and under the comp a line says "Not locked in yet" or "Locked in". There is no Team panel: the name is under each portrait and the online dot is on it (D23). Bans are inline and are the same picker as the Bans dialog, headed "Roles you never want" instead of "Roles they never want" (D23 follow-up). While joining, the page says "Connecting to the party…" and then "Asking the host to let you in…", and Leave party reads Cancel (D21) |

## Logo

The icon (`public/favicon.svg`) is a die face on the panel colour with an accent-red outline and five pips, one per player: duelist red top left, initiator amber top right, light centre, controller purple bottom left, sentinel teal bottom right. It uses the same hex values as the tokens above, and the favicon link is relative (`./favicon.svg`) to suit the Lab hosting (D14). It is favicon-only, not shown in the app's header.

## Where the build differs from the canvas

- **Agent art is 256 px**, from valorant-api.com, so wide-screen cards enlarge it less than the old 128 px set did and stay sharp (D31).
- **Desktop cards are short rows, not the tall cards the canvas drew**, and the Team panel is tighter, so a comp and the whole Team panel fit a window about 1000 by 610. A tall card with a cropped portrait was tried and dropped because it hid the agent's face. Checked at 1000 by 610, 1440 by 900, 768 by 1024 and 1024 by 768. The longest name (Brimstone) fits at 1000 and 1440 wide. The Rules column never gets narrower than 312 px, so its stepper fits on a tablet in portrait.
- **A waiting joiner's card is the rolled card with a "?" portrait**, not the flat pill with an initial the canvas drew, so the roll fills in cards of the same size instead of swapping them.
- **Rules has a short hint** ("Minimum per role") because the "At least" label was dropped from each row.
- **The menu's Bans entry** shows its "Agents and roles they never want" caption on phones only.
- **Not drawn on the canvas, styled to match:** Add player, the bench of saved people, the screen before the first roll, the error message, and the Bans dialog on wide screens.
- **Unnamed slots** get a menu with Bans and Remove only, since there is nothing saved to forget (D10).

- **Random teammate cards dim their parts, not the card.** The reveal animation owns the card's own opacity, so the portrait and text are dimmed instead (D28).
- **Host strip has no online dots.** The host's Team panel already shows who is in, so the dots are drawn only on a member's page (D23).

## How to use this file

- Read it before building or restyling UI. Change a token in `index.css` first, then update the table here.
- Add a line under "Where the build differs" whenever the build departs from a design.
- Companion docs: `DECISIONS.md`, `CLAUDE.md`, and the repo's issues.
