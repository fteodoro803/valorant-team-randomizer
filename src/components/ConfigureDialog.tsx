import { useRef, useState } from "react";
import { findSaved, isNamedKey, playerKey, suggestSaved } from "../lib/roster";
import type { Player, Roster, SavedPlayer } from "../lib/types";
import { BanPicker } from "./BanPicker";
import { NameField } from "./NameField";
import { SheetDialog } from "./SheetDialog";

interface Props {
  player: Player;
  /** Position in the team, used to name an unnamed player "Player 3". */
  index: number;
  /** The whole team, so people already on it aren't suggested again. */
  players: Player[];
  roster: Roster;
  /** False when they are the last player, who cannot be taken off the team. */
  canRemove: boolean;
  onChange: (patch: Partial<Player>) => void;
  /** Take them off the team. With `forget`, also delete their saved bans and history (D9). */
  onRemove: (forget: boolean) => void;
  onClose: () => void;
}

/**
 * Everything about one player in one window: their name, their bans, and taking them off the team (D33).
 *
 * Drawn by SheetDialog: a centred card on wide screens and a bottom sheet on phones. Changes apply
 * as they are made, so Done only closes it. Remove from team and Forget sit in a bar at the bottom,
 * and Forget asks first because it deletes their saved bans and history for good.
 *
 * Someone who joined the party keeps their name and bans on their own device, so for them the
 * window offers only Remove from team.
 */
export function ConfigureDialog({ player, index, players, roster, canRemove, onChange, onRemove, onClose }: Props) {
  // The name as it was when the box got focus, so autofill only runs after a real edit.
  const nameOnFocus = useRef("");
  const [confirmingForget, setConfirmingForget] = useState(false);

  const managed = player.member !== undefined;
  const label = player.name.trim() || `Player ${index + 1}`;
  const named = isNamedKey(playerKey(player));

  // Picking a saved person, or typing their exact name and leaving the box, fills in their bans.
  // Changing a saved person's name to a new one starts a new person, so the old bans are cleared.
  const autofill = () => {
    if (player.name === nameOnFocus.current) return;
    const saved = findSaved(roster, player.name);
    if (saved) {
      onChange({ name: saved.name, excludedAgents: saved.excludedAgents, bannedRoles: saved.bannedRoles });
    } else if (findSaved(roster, nameOnFocus.current)) {
      onChange({ excludedAgents: [], bannedRoles: [] });
    }
  };

  // Picking fills the name and bans at once. The name is also noted as "on focus" so the blur
  // that follows doesn't mistake the pick for a rename and clear the bans it just filled in.
  const pick = (saved: SavedPlayer) => {
    nameOnFocus.current = saved.name;
    onChange({ name: saved.name, excludedAgents: saved.excludedAgents, bannedRoles: saved.bannedRoles });
  };

  return (
    <SheetDialog
      label={`Configure ${label}`}
      eyebrow={label}
      title="Configure"
      onClose={onClose}
      footer={
        // Remove from team and Forget. Forget asks first.
        confirmingForget ? (
          <>
            <p>Forget {label}? This deletes their saved bans and history.</p>
            <div className="configure-actions">
              <button type="button" className="ghost" onClick={() => setConfirmingForget(false)}>
                Cancel
              </button>
              <button type="button" className="roll small" onClick={() => onRemove(true)}>
                Forget
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="configure-actions">
              <button type="button" className="ghost" disabled={!canRemove} onClick={() => onRemove(false)}>
                Remove from team
              </button>
              {named && !managed && (
                <button type="button" className="ghost danger-text" disabled={!canRemove} onClick={() => setConfirmingForget(true)}>
                  Forget {label}
                </button>
              )}
            </div>
            {named && !managed && <p className="muted">Remove keeps their bans and history. Forget deletes them.</p>}
          </>
        )
      }
    >
      {managed ? (
        <p className="picker-hint">
          {player.name} is in the party, so their name and bans come from their own device. You can take them off the team below.
        </p>
      ) : (
        <>
          <section className="configure-name">
            <h3 className="section-label">Name</h3>
            <NameField
              value={player.name}
              placeholder={`Player ${index + 1}`}
              ariaLabel={`Name for player ${index + 1}`}
              suggestions={suggestSaved(roster, players, player.name)}
              onChange={(name) => onChange({ name })}
              onPick={pick}
              onFocus={() => (nameOnFocus.current = player.name)}
              onBlur={autofill}
            />
          </section>
          <BanPicker player={player} roleHeading="Roles they never want" onChange={onChange} />
        </>
      )}
    </SheetDialog>
  );
}
