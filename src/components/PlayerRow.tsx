import { useRef, useState } from "react";
import { findSaved, isNamedKey, playerKey, suggestSaved } from "../lib/roster";
import type { Player, Roster, SavedPlayer } from "../lib/types";
import { BansDialog } from "./BansDialog";
import { NameField } from "./NameField";
import { PlayerMenu } from "./PlayerMenu";

interface Props {
  player: Player;
  /** Position in the team, used to name an empty slot "Player 3". */
  index: number;
  roster: Roster;
  /** The whole team, so people already on it aren't suggested again. */
  players: Player[];
  /** False when they are the last player, who cannot be taken off the team. */
  canRemove: boolean;
  onUpdate: (patch: Partial<Player>) => void;
  onRemove: (forget: boolean) => void;
}

/**
 * One player: a name box and a three-dots menu holding everything else.
 *
 * Picking a saved person from the suggestions, or typing their exact name and leaving the box,
 * fills in their bans. Changing a saved person's name to a new one starts a new person, so the
 * old bans are cleared. The bans dialog is only mounted while it is open.
 */
export function PlayerRow({ player, index, roster, players, canRemove, onUpdate, onRemove }: Props) {
  // The name as it was when the box got focus, so autofill only runs after a real edit.
  const nameOnFocus = useRef("");
  const [bansOpen, setBansOpen] = useState(false);

  const label = player.name || `Player ${index + 1}`;

  const autofill = () => {
    if (player.name === nameOnFocus.current) return;
    const saved = findSaved(roster, player.name);
    if (saved) {
      onUpdate({ name: saved.name, excludedAgents: saved.excludedAgents, bannedRoles: saved.bannedRoles });
    } else if (findSaved(roster, nameOnFocus.current)) {
      // The slot held a saved person and now has a new name, so it is a new person with no bans yet.
      onUpdate({ excludedAgents: [], bannedRoles: [] });
    }
  };

  // Picking fills the name and bans at once. The name is also noted as "on focus" so the blur
  // that follows doesn't mistake the pick for a rename and clear the bans it just filled in.
  const pick = (saved: SavedPlayer) => {
    nameOnFocus.current = saved.name;
    onUpdate({ name: saved.name, excludedAgents: saved.excludedAgents, bannedRoles: saved.bannedRoles });
  };

  // A party member's name and bans come from their own device, so the host sees the name and can only remove them.
  if (player.member) {
    return (
      <li className="player member" data-online={player.member === "online"}>
        <span className="member-name">{player.name}</span>
        <span className="member-tag">{player.member === "online" ? "In party" : "Offline"}</span>
        <PlayerMenu
          label={label}
          named
          managed
          banCount={0}
          canRemove={canRemove}
          onBans={() => {}}
          onRemove={onRemove}
        />
      </li>
    );
  }

  return (
    <li className="player">
      <NameField
        value={player.name}
        placeholder={`Player ${index + 1}`}
        ariaLabel={`Name for player ${index + 1}`}
        suggestions={suggestSaved(roster, players, player.name)}
        onChange={(name) => onUpdate({ name })}
        onPick={pick}
        onFocus={() => (nameOnFocus.current = player.name)}
        onBlur={autofill}
      />
      <PlayerMenu
        label={label}
        named={isNamedKey(playerKey(player))}
        banCount={player.excludedAgents.length + player.bannedRoles.length}
        canRemove={canRemove}
        onBans={() => setBansOpen(true)}
        onRemove={onRemove}
      />
      {bansOpen && <BansDialog player={player} label={label} onChange={onUpdate} onClose={() => setBansOpen(false)} />}
    </li>
  );
}
