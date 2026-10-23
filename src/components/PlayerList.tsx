import { PlusIcon, TrashIcon, UserPlusIcon } from "./icons";
import { PlayerRow } from "./PlayerRow";
import { addSavedToTeam, playerKey } from "../lib/roster";
import type { Player, Roster } from "../lib/types";
import { MAX_PLAYERS } from "../lib/types";

interface Props {
  players: Player[];
  roster: Roster;
  onChange: (players: Player[]) => void;
  /** Take a player off the team. With `forget`, also delete their saved details and history. */
  onRemove: (player: Player, forget: boolean) => void;
  /** Forget a saved person and their history, by their roster key. */
  onForget: (key: string) => void;
}

/**
 * The team: a row for each player, an Add button beside the heading, and the saved people.
 *
 * Everything player-specific (bans, remove, forget) sits behind the three-dots menu
 * in each row, so this file only deals with the list as a whole. Saved people are
 * listed at the bottom, where they can be added back to the team or forgotten.
 */
export function PlayerList({ players, roster, onChange, onRemove, onForget }: Props) {
  const update = (id: string, patch: Partial<Player>) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const savedEntries = Object.entries(roster);

  return (
    <section className="panel">
      {/* Heading with Add beside it, which saves a row of height under the list */}
      <div className="panel-head">
        <h2 className="section-label">Players</h2>
        <button
          type="button"
          className="ghost"
          disabled={players.length >= MAX_PLAYERS}
          title={players.length >= MAX_PLAYERS ? `A team can have at most ${MAX_PLAYERS} players.` : undefined}
          onClick={() =>
            onChange([...players, { id: crypto.randomUUID(), name: "", excludedAgents: [], bannedRoles: [] }])
          }
        >
          <PlusIcon size={16} />
          Add player
        </button>
      </div>

      <ul className="players">
        {players.map((player, index) => (
          <PlayerRow
            key={player.id}
            player={player}
            index={index}
            roster={roster}
            players={players}
            canRemove={players.length > 1}
            onUpdate={(patch) => update(player.id, patch)}
            onRemove={(forget) => onRemove(player, forget)}
          />
        ))}
      </ul>

      {/* Saved players */}
      {savedEntries.length > 0 && (
        <details className="saved">
          <summary>Saved players ({savedEntries.length})</summary>
          <ul className="saved-list">
            {savedEntries.map(([key, saved]) => {
              const onTeam = players.some((p) => playerKey(p) === key);
              const hasRoom = addSavedToTeam(players, saved, "check") !== null;
              return (
                <li key={key}>
                  <span>{saved.name}</span>
                  <span className="saved-actions">
                    {onTeam ? (
                      <span className="muted">On the team</span>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={!hasRoom}
                        title={hasRoom ? "Add to the team" : `A team can have at most ${MAX_PLAYERS} players.`}
                        aria-label={`Add ${saved.name} to the team`}
                        onClick={() => {
                          const next = addSavedToTeam(players, saved, crypto.randomUUID());
                          if (next) onChange(next);
                        }}
                      >
                        <UserPlusIcon />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Forget: delete this person's saved bans and history"
                      aria-label={`Forget ${saved.name}`}
                      onClick={() => onForget(key)}
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}
