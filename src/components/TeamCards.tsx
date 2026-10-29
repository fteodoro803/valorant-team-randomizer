import { useState } from "react";
import type { HostStatus } from "../hooks/useParty";
import { buildCards } from "../lib/cards";
import type { CardView } from "../lib/cards";
import { addSavedToTeam, findSaved } from "../lib/roster";
import { addTeammate, slotsForPlayers } from "../lib/teammates";
import type { Assignment, Player, Roster, Teammate } from "../lib/types";
import { MAX_PLAYERS } from "../lib/types";
import { CardDialog } from "./CardDialog";
import type { CardDialogTarget } from "./CardDialog";
import { CardRow } from "./CardRow";
import { ConfigureDialog } from "./ConfigureDialog";
import { KebabIcon } from "./icons";

interface Props {
  players: Player[];
  /** Random teammates: on the team but not using the app. They share the team's five slots. */
  teammates: Teammate[];
  roster: Roster;
  /** The latest roll, or null before the first one. Players are matched to it by their roll key. */
  comp: Assignment[] | null;
  /** Whether the host has locked the roll in. A locked-in comp can't have picks locked or unlocked. */
  locked: boolean;
  /** The roll keys of picks locked through the next Roll, and whether that is everyone. */
  kept: string[];
  allKept: boolean;
  onPlayersChange: (players: Player[]) => void;
  onTeammatesChange: (teammates: Teammate[]) => void;
  /** Take a player off the team. With `forget`, also delete their saved details and history. */
  onRemove: (player: Player, forget: boolean) => void;
  /** Forget a saved person and their history, by their roster key. */
  onForget: (key: string) => void;
  onToggleKept: (rollId: string) => void;
  onClearKept: () => void;
  /** The party this team is hosting, if any: its code once it is open, and how many friends are in. */
  party: { code: string | null; status: HostStatus; onStart: () => void; onStop: () => void };
}

/** Which card window is open. It names a random teammate by id, so it can still be found after the lists change. */
type CardWindow = { kind: "add" } | { kind: "teammate"; id: string } | null;

/**
 * The team: five cards that are both the team list and the roll's result (D-new1), with Start a party
 * beside the heading.
 *
 * Tapping a card does the most useful thing for it:
 * 1. An empty card opens a window to add a player or a random teammate.
 * 2. A random teammate's card opens it to change their agent or remove them.
 * 3. A player's card locks their pick through the next Roll once there is one to lock (D27), and
 *    before that opens Configure.
 * Everything player-specific (name, bans, remove, forget) is in the Configure window, which the
 * three-dots button on a player's card opens at any time (D-new2). While a party is open the heading
 * carries its code, and a joined friend's card has its status dot and no name editor, since their
 * name comes from their own device.
 */
export function TeamCards({
  players,
  teammates,
  roster,
  comp,
  locked,
  kept,
  allKept,
  onPlayersChange,
  onTeammatesChange,
  onRemove,
  onForget,
  onToggleKept,
  onClearKept,
  party,
}: Props) {
  const [cardWindow, setCardWindow] = useState<CardWindow>(null);
  // The player whose Configure window is open, by id so it survives their name being edited.
  const [configureFor, setConfigureFor] = useState<string | null>(null);

  const cards = buildCards(players, teammates, comp);
  // Only a roll that isn't locked in yet can have its picks locked through the next Roll.
  const editable = comp !== null && !locked;
  const closeCardWindow = () => setCardWindow(null);
  const openCardWindow = (next: CardWindow) => setCardWindow(next);

  // The window's target, found again from the current lists. Someone removed since it opened closes it.
  const target = ((): CardDialogTarget | null => {
    if (cardWindow === null) return null;
    if (cardWindow.kind === "add") return players.length + teammates.length < MAX_PLAYERS ? { kind: "add" } : null;
    const teammate = teammates.find((t) => t.id === cardWindow.id);
    return teammate ? { kind: "teammate", teammate } : null;
  })();

  // 1. A named person who is saved brings their bans, and fills the first unnamed slot like a pick from the old Saved list did.
  // 2. A blank name makes an unnamed player, as an old blank row did.
  const addPlayer = (name: string) => {
    const saved = findSaved(roster, name);
    const person = {
      name: saved?.name ?? name.trim(),
      excludedAgents: [...(saved?.excludedAgents ?? [])],
      bannedRoles: [...(saved?.bannedRoles ?? [])],
    };
    if (person.name === "") {
      if (players.length + teammates.length < MAX_PLAYERS) {
        onPlayersChange([...players, { id: crypto.randomUUID(), ...person }]);
      }
    } else {
      const next = addSavedToTeam(players, person, crypto.randomUUID(), slotsForPlayers(teammates));
      if (next) onPlayersChange(next);
    }
    closeCardWindow();
  };

  const addRandomTeammate = (agent: string) => {
    const next = addTeammate(players, teammates, crypto.randomUUID(), agent);
    if (next) onTeammatesChange(next);
    closeCardWindow();
  };

  const updatePlayer = (id: string, patch: Partial<Player>) =>
    onPlayersChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const setAgent = (id: string, agent: string) => {
    onTeammatesChange(teammates.map((t) => (t.id === id ? { ...t, agent } : t)));
    closeCardWindow();
  };

  const removeTeammate = (id: string) => {
    onTeammatesChange(teammates.filter((t) => t.id !== id));
    closeCardWindow();
  };

  // What a tap on this card does, or null for a card that is plain.
  const action = (card: CardView) => {
    if (card.state === "empty") return { label: "Add a player or a random teammate", onClick: () => openCardWindow({ kind: "add" }) };
    if (card.teammateId !== undefined) {
      const id = card.teammateId;
      return { label: "Change this random teammate's agent", onClick: () => openCardWindow({ kind: "teammate", id }) };
    }
    const player = players.find((p) => p.id === card.playerId);
    if (!player || card.rollId === undefined) return null;
    const rollId = card.rollId;
    if (card.state === "rolled") {
      return editable
        ? { label: "Lock this pick through the next Roll", pressed: kept.includes(rollId), onClick: () => onToggleKept(rollId) }
        : null;
    }
    // A friend's name and bans come from their own device, so a waiting friend's card does nothing.
    if (player.member) return null;
    return { label: "Configure this player", onClick: () => setConfigureFor(player.id) };
  };

  // The three-dots button opens Configure at any time, including after a roll when a tap on the card locks.
  const menu = (card: CardView) => {
    const player = players.find((p) => p.id === card.playerId);
    if (!player || card.name === undefined) return null;
    return (
      <button type="button" className="icon-btn" aria-label={`Configure ${card.name}`} onClick={() => setConfigureFor(player.id)}>
        <KebabIcon />
      </button>
    );
  };

  const configureIndex = players.findIndex((p) => p.id === configureFor);
  const configurePlayer = configureIndex === -1 ? null : players[configureIndex];

  return (
    <section aria-label="Team">
      {/* Heading: the code while hosting, and one button that is Start a party until a party is open and Stop party after, so nothing shifts */}
      <div className="panel-head">
        <h2 className="section-label">
          Team
          {/* The brackets sit outside the inner span so a tap selects just the code, ready to copy */}
          {party.code && (
            <span className="party-code-tag">
              (<span className="party-code-text">{party.code}</span>)
            </span>
          )}
        </h2>
        <div className="panel-actions">
          {party.status === "open" ? (
            <button type="button" className="ghost" onClick={party.onStop}>
              Stop party
            </button>
          ) : (
            <button type="button" className="ghost" disabled={party.status === "connecting"} onClick={party.onStart}>
              {party.status === "connecting" ? "Starting…" : "Start a party"}
            </button>
          )}
        </div>
      </div>

      {/* Advice for the host, wide screens only: a phone has no room for it, and the button doesn't move either way */}
      {party.status === "open" && (
        <p className="party-hint">
          Host from a computer if you can: if this page closes or its device sleeps, the party ends for everyone.
        </p>
      )}

      <div aria-live="polite">
        <CardRow cards={cards} kept={kept} action={action} menu={menu} />

        {/* Note: what Roll will do while picks are locked, otherwise whether the comp has reached history */}
        {editable && kept.length > 0 ? (
          <p className="lock-note">
            {allKept ? "All locked. Tap one to change." : `${kept.length} locked. Roll changes the rest.`}{" "}
            <button type="button" className="note-link" onClick={onClearKept}>
              Clear
            </button>
          </p>
        ) : comp ? (
          <p className="lock-note" data-locked={locked}>
            {locked ? "Locked in. Saved to history." : "Not locked in yet. Not saved to history."}
          </p>
        ) : (
          <p className="lock-note">Press Roll to give everyone an agent for the next game.</p>
        )}
      </div>

      {/* Empty card or random teammate: the same kind of window as Configure */}
      {target && (
        <CardDialog
          key={`${target.kind}-${target.kind === "add" ? "" : target.teammate.id}`}
          target={target}
          players={players}
          teammates={teammates}
          roster={roster}
          onAddPlayer={addPlayer}
          onAddTeammate={addRandomTeammate}
          onSetAgent={setAgent}
          onRemoveTeammate={removeTeammate}
          onForget={onForget}
          onClose={closeCardWindow}
        />
      )}

      {/* Configure: a modal on wide screens and a sheet on phones. A player who is removed closes it. */}
      {configurePlayer && (
        <ConfigureDialog
          player={configurePlayer}
          index={configureIndex}
          players={players}
          roster={roster}
          canRemove={players.length > 1}
          onChange={(patch) => updatePlayer(configurePlayer.id, patch)}
          onRemove={(forget) => {
            onRemove(configurePlayer, forget);
            setConfigureFor(null);
          }}
          onClose={() => setConfigureFor(null)}
        />
      )}
    </section>
  );
}
