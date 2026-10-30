import { useState } from "react";
import { buildCards } from "../lib/cards";
import type { CardView } from "../lib/cards";
import { addSavedToTeam, findSaved, playerKey } from "../lib/roster";
import { addTeammate, slotsForPlayers } from "../lib/teammates";
import type { Assignment, Player, Roster, Teammate } from "../lib/types";
import { MAX_PLAYERS } from "../lib/types";
import { CardDialog } from "./CardDialog";
import type { CardDialogTarget } from "./CardDialog";
import { CardRow } from "./CardRow";
import type { CardZones } from "./CardRow";
import { ConfigureDialog } from "./ConfigureDialog";

interface Props {
  players: Player[];
  /** Random teammates: on the team but not using the app. They share the team's five slots. */
  teammates: Teammate[];
  roster: Roster;
  /** The latest roll, or null before the first one. Players are matched to it by their roll key. */
  comp: Assignment[] | null;
  /** Whether the host has locked the roll in. A locked-in comp can't have picks locked or unlocked. */
  locked: boolean;
  /** The roll keys of picks locked through the next Roll. */
  kept: string[];
  onPlayersChange: (players: Player[]) => void;
  onTeammatesChange: (teammates: Teammate[]) => void;
  /** Take a player off the team. With `forget`, also delete their saved details and history. */
  onRemove: (player: Player, forget: boolean) => void;
  /** Forget a saved person and their history, by their roster key. */
  onForget: (key: string) => void;
  onToggleKept: (rollId: string) => void;
  /** Give a player this agent by hand, and lock it for them. `rollId` is the player's roll key. */
  onAssign: (rollId: string, agent: string) => void;
  /** Whether a party is open, which shows the advice about hosting from a computer. */
  hosting: boolean;
}

/** Which card window is open. It names a random teammate by id, so it can still be found after the lists change. */
type CardWindow = { kind: "add" } | { kind: "teammate"; id: string } | null;

/**
 * The team: five cards that are both the team list and the roll's result (D32).
 *
 * A player's card has three tappable parts (D36, D38):
 * 1. The card itself opens a window that gives them an agent by hand. The pick is locked, so Roll
 *    leaves it alone, and it works before the first roll too.
 * 2. The strip across the top (a cog on a phone) opens Configure: the name, the bans, Remove from team and Forget (D33).
 * 3. The bar along the bottom locks or unlocks the pick (D27), once there is an agent to lock.
 * An Empty card opens the window to add a player or a random teammate. A random teammate's card opens
 * a window to change their agent, and its bar removes them. After Lock in the portrait and the bar are
 * greyed out until New, so the saved history can't be edited. A joined friend's card has its status dot.
 */
export function TeamCards({
  players,
  teammates,
  roster,
  comp,
  locked,
  kept,
  onPlayersChange,
  onTeammatesChange,
  onRemove,
  onForget,
  onToggleKept,
  onAssign,
  hosting,
}: Props) {
  const [cardWindow, setCardWindow] = useState<CardWindow>(null);
  // The player whose Configure window is open, and the player whose Assign window is open, by id so they survive a name edit.
  const [configureFor, setConfigureFor] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const cards = buildCards(players, teammates, comp);
  // Whether every player has an agent, which is when the comp counts as rolled. Until then only the assigned picks are in it.
  const everyoneHasAgent = comp !== null && players.every((p) => comp.some((c) => c.playerId === playerKey(p)));
  const closeCardWindow = () => setCardWindow(null);
  const openCardWindow = (next: CardWindow) => setCardWindow(next);

  // The window's target, found again from the current lists. Someone removed since it opened closes it.
  const target = ((): CardDialogTarget | null => {
    if (cardWindow === null) return null;
    if (cardWindow.kind === "add") return players.length + teammates.length < MAX_PLAYERS ? { kind: "add" } : null;
    const teammate = teammates.find((t) => t.id === cardWindow.id);
    return teammate ? { kind: "teammate", teammate } : null;
  })();

  // The Assign window's target. The agents other people have are greyed out: the random teammates' and the other players' picks.
  const assignIndex = players.findIndex((p) => p.id === assignFor);
  const assignTarget = ((): CardDialogTarget | null => {
    if (assignIndex === -1) return null;
    const player = players[assignIndex];
    const rollId = playerKey(player);
    const mine = comp?.find((c) => c.playerId === rollId)?.agent ?? null;
    const taken = [
      ...teammates.flatMap((t) => (t.agent ? [t.agent] : [])),
      ...(comp ?? []).filter((c) => c.playerId !== rollId).map((c) => c.agent),
    ];
    return { kind: "assign", player, index: assignIndex, pick: mine, taken };
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

  // The tappable parts of a card. The card itself opens the agent window, and Configure and the bar are their own buttons.
  const zones = (card: CardView): CardZones => {
    if (card.state === "empty") {
      return { main: { label: "Add a player or a random teammate", onClick: () => openCardWindow({ kind: "add" }) } };
    }
    if (card.teammateId !== undefined) {
      const id = card.teammateId;
      return {
        main: { label: "Change this random teammate's agent", onClick: () => openCardWindow({ kind: "teammate", id }) },
        bar: { kind: "remove", text: "Remove", label: "Remove this random teammate", onClick: () => removeTeammate(id) },
      };
    }
    const player = players.find((p) => p.id === card.playerId);
    if (!player || card.rollId === undefined) return {};
    const rollId = card.rollId;
    const name = card.name ?? "this player";
    const hasAgent = card.state === "rolled";
    // After Lock in every pick reads as locked, so the bar shows Locked, greyed out until New.
    const on = locked ? hasAgent : kept.includes(rollId);
    return {
      config: { label: `Configure ${name}`, onClick: () => setConfigureFor(player.id) },
      main: {
        label: hasAgent ? `Assign an agent to ${name}, now ${card.agent}` : `Assign an agent to ${name}`,
        onClick: () => setAssignFor(player.id),
        disabled: locked,
      },
      bar: {
        kind: "lock",
        text: on ? "Locked" : "Lock",
        on,
        label: on ? `Unlock ${name}'s pick` : `Lock ${name}'s pick`,
        onClick: () => onToggleKept(rollId),
        disabled: !hasAgent || locked,
      },
    };
  };

  const configureIndex = players.findIndex((p) => p.id === configureFor);
  const configurePlayer = configureIndex === -1 ? null : players[configureIndex];

  return (
    <section aria-label="Team">
      {/* Advice for the host, wide screens only: a phone has no room for it */}
      {hosting && (
        <p className="party-hint">
          Host from a computer if you can: if this page closes or its device sleeps, the party ends for everyone.
        </p>
      )}

      <div aria-live="polite">
        <CardRow cards={cards} kept={kept} zones={zones} />

        {/* Note: whether the comp has reached history. The space is always kept, so the page below never jumps. */}
        <p className="lock-note" data-locked={locked}>
          {everyoneHasAgent ? (locked ? "Locked in. Saved to history." : "Not locked in yet. Not saved to history.") : "\u00a0"}
        </p>
      </div>

      {/* Empty card or random teammate: the same kind of window as Configure */}
      {target && (
        <CardDialog
          key={cardWindow ? `${cardWindow.kind}-${cardWindow.kind === "add" ? "" : cardWindow.id}` : ""}
          target={target}
          players={players}
          teammates={teammates}
          roster={roster}
          onAddPlayer={addPlayer}
          onAddTeammate={addRandomTeammate}
          onSetAgent={setAgent}
          onAssign={() => {}}
          onRemoveTeammate={removeTeammate}
          onForget={onForget}
          onClose={closeCardWindow}
        />
      )}

      {/* Assign an agent to a player: the same kind of window. A player who is removed closes it. */}
      {assignTarget && (
        <CardDialog
          key={`assign-${assignFor}`}
          target={assignTarget}
          players={players}
          teammates={teammates}
          roster={roster}
          onAddPlayer={addPlayer}
          onAddTeammate={addRandomTeammate}
          onSetAgent={setAgent}
          onAssign={(agent) => {
            if (assignTarget.kind === "assign") onAssign(playerKey(assignTarget.player), agent);
            setAssignFor(null);
          }}
          onRemoveTeammate={removeTeammate}
          onForget={onForget}
          onClose={() => setAssignFor(null)}
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
