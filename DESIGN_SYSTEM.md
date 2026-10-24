# DESIGN_SYSTEM.md

The visual rules for the app, and where the build differs from the design. The design was chosen on a canvas in October 2026 (your dark palette with role-tinted agent cards). All styles live in `src/index.css`, and every colour, size and radius comes from the tokens at the top of that file, so a look change is one line there.

## Principles

- **Phone first.** The team uses this before a game, often on a phone. The base CSS is the phone layout, and one `min-width: 721px` block per section widens it.
- **The comp is the star.** The rolled comp comes first on the page, and Roll is always within reach: pinned to the bottom on phones, beside the title on wide screens.
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
| Roll | `App.tsx` | One button. Fixed to the bottom on phones with space left under the last panel, static beside the title on wide screens. Pressing it scrolls the result into view only if it is off screen |
| Comp card | `CompResult.tsx` | Phone: a row with the portrait on a role-colour square on the right. Always a row with the whole portrait beside the text, never cropped. From 721 to 979 px wide the cards are two across at the phone's size, and from 980 px they are five across and about 72 px tall, so the Team panel stays on screen below them. All five appear together with a short fade and rise, switched off for reduced motion |
| Player row | `PlayerRow.tsx` | A name box and a three-dots button. Add player sits beside the "Team" heading. On wide screens with a mouse the rows, buttons and panel padding are tighter; a touch screen keeps 44px targets |
| Bench | `PlayerList.tsx` | Chips under the team for saved people who are off the team: tap a chip to add them, the x forgets them. Hidden when nobody is off the team, so it never repeats the rows above. Replaces the collapsible "Saved players" list |
| Name field | `NameField.tsx` | The name box with a styled list of saved people, replacing the browser's own suggestion. It offers only saved people who are not on the team and whose name starts with what is typed, each with a note on what picking them fills in ("Fills in 2 bans" on wide screens, "2 bans" on phones). Nothing is highlighted until an arrow key or the pointer chooses, so Enter keeps a newly typed name. It opens upward when there is no room below. Arrow keys, Enter, Escape and tapping work |
| Player menu | `PlayerMenu.tsx` | Bans, Remove from team, Forget (named players only). Bottom sheet on phones, popover on wide screens. Escape, arrows and tapping outside work |
| Bans dialog | `BansDialog.tsx` | Role chips, then agent tiles grouped by role. A native modal `<dialog>`: full screen on phones, a centred card on wide screens. The header stays at the top while the tiles scroll |
| Ban tile | `BansDialog.tsx` | A real checkbox inside a label. Banned: greyed with a red slash. Hidden by a banned role: greyed only, with no slash, since role bans stay a separate list (D11) |
| Switch | `SettingsPanel.tsx` | A checkbox drawn as a track and knob |
| History | `HistoryView.tsx` | A strip of agent icons per player, newest on the right and outlined |
| Party panel | `PartyPanel.tsx` | A panel under Team and Rules. While hosting it shows the code in large letterspaced Barlow Condensed with a one-line note that connected people can see each other's network address, and a Stop button. Otherwise it offers Start a party and a Join form (code and name). Messages use the same red-tinted box as roll errors (D20). Both states carry a line advising a computer as host, since a host that closes or sleeps ends the party (D21) |
| Party member row | `PlayerRow.tsx` | A joined member's name is plain text in the name box's frame, with "In party" in teal or "Offline" in grey, and a menu with only Remove from team, since their name and bans come from their own device |
| Member page | `MemberView.tsx` | What a joined friend sees: the shared comp, a panel with their name and a Bans button (the same dialog as the host's), the team list and Leave party. Roll is pinned to the bottom on phones like the host's. While joining, the page says "Connecting to the party…" and then "Asking the host to let you in…", and the Leave button reads Cancel (D21) |

## Where the build differs from the canvas

- **Agent art is 128 px**, so wide-screen cards enlarge it about 1.6 times and look slightly soft. Larger icons were looked into and dropped: the wiki's image host blocks scripted downloads, and the existing icons are the best available (D13).
- **Desktop cards are short rows, not the tall cards the canvas drew**, and the Team panel is tighter, so a comp and the whole Team panel fit a window about 1000 by 610. A tall card with a cropped portrait was tried and dropped because it hid the agent's face. Checked at 1000 by 610, 1440 by 900, 768 by 1024 and 1024 by 768. The longest name (Brimstone) fits at 1000 and 1440 wide. The Rules column never gets narrower than 312 px, so its stepper fits on a tablet in portrait.
- **Rules has a short hint** ("Minimum per role") because the "At least" label was dropped from each row.
- **The menu's Bans entry** shows its "Agents and roles they never want" caption on phones only.
- **Not drawn on the canvas, styled to match:** Add player, the bench of saved people, the screen before the first roll, the error message, and the Bans dialog on wide screens.
- **Unnamed slots** get a menu with Bans and Remove only, since there is nothing saved to forget (D10).

## How to use this file

- Read it before building or restyling UI. Change a token in `index.css` first, then update the table here.
- Add a line under "Where the build differs" whenever the build departs from a design.
- Companion docs: `DECISIONS.md`, `CLAUDE.md`, and the repo's issues.
