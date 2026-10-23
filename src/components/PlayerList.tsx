import { useRef, useState } from "react";
import { AGENTS, agentIconUrl } from "../data/agents";
import { TrashIcon, UserMinusIcon, UserPlusIcon } from "./icons";
import { addSavedToTeam, findSaved, isNamedKey, playerKey } from "../lib/roster";
import type { Player, Role, Roster } from "../lib/types";
import { MAX_PLAYERS, ROLES } from "../lib/types";

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
 * The team: a name for each player and the agents they never want.
 *
 * The X beside a player offers Remove (keeps their saved details) or Forget
 * (deletes them). Typing a name that matches a saved person fills in their excluded agents
 * once the name box loses focus. Changing a saved person's name to a new one
 * starts a new person, so the old exclusions are cleared. Excluded agents sit in a collapsible list
 * under each player to keep the page short. Saved people are listed at the
 * bottom, where they can be forgotten.
 */
export function PlayerList({ players, roster, onChange, onRemove, onForget }: Props) {
  // The name as it was when the box got focus, so autofill only runs after a real edit.
  const nameOnFocus = useRef("");
  // The player whose X was pressed, while they choose between Remove and Forget.
  const [removing, setRemoving] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Player>) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const toggleExcluded = (player: Player, agent: string) => {
    const excluded = player.excludedAgents.includes(agent)
      ? player.excludedAgents.filter((name) => name !== agent)
      : [...player.excludedAgents, agent];
    update(player.id, { excludedAgents: excluded });
  };

  const toggleBannedRole = (player: Player, role: Role) => {
    const banned = player.bannedRoles.includes(role)
      ? player.bannedRoles.filter((r) => r !== role)
      : [...player.bannedRoles, role];
    update(player.id, { bannedRoles: banned });
  };

  const autofill = (player: Player) => {
    if (player.name === nameOnFocus.current) return;
    const saved = findSaved(roster, player.name);
    if (saved) {
      update(player.id, {
        name: saved.name,
        excludedAgents: saved.excludedAgents,
        bannedRoles: saved.bannedRoles,
      });
    } else if (findSaved(roster, nameOnFocus.current)) {
      // The slot held a saved person and now has a new name, so it is a new person with no bans yet.
      update(player.id, { excludedAgents: [], bannedRoles: [] });
    }
  };

  const savedEntries = Object.entries(roster);

  return (
    <section className="panel">
      <h2>Players</h2>
      <datalist id="saved-players">
        {savedEntries.map(([key, saved]) => (
          <option key={key} value={saved.name} />
        ))}
      </datalist>

      <ul className="players">
        {players.map((player, index) => (
          <li key={player.id} className="player">
            {/* Name row */}
            <div className="player-row">
              <input
                list="saved-players"
                aria-label={`Name for player ${index + 1}`}
                value={player.name}
                placeholder={`Player ${index + 1}`}
                onFocus={() => (nameOnFocus.current = player.name)}
                onChange={(e) => update(player.id, { name: e.target.value })}
                onBlur={() => autofill(player)}
              />
              {removing === player.id ? (
                <div className="remove-choice">
                  {/* Forget comes first, as the more final choice */}
                  {isNamedKey(playerKey(player)) && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Forget: take them off the team and delete their saved bans and history."
                      aria-label={`Forget ${player.name}`}
                      onClick={() => {
                        setRemoving(null);
                        onRemove(player, true);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    title="Remove: take them off the team. Their bans and history are kept."
                    aria-label={`Remove ${player.name || `player ${index + 1}`} from the team`}
                    onClick={() => {
                      setRemoving(null);
                      onRemove(player, false);
                    }}
                  >
                    <UserMinusIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Cancel"
                    title="Cancel"
                    onClick={() => setRemoving(null)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="icon-btn"
                  title="Remove or forget"
                  aria-label={`Remove or forget ${player.name || `player ${index + 1}`}`}
                  disabled={players.length <= 1}
                  onClick={() => setRemoving(player.id)}
                >
                  ×
                </button>
              )}
            </div>

            {/* Bans */}
            <details>
              <summary>
                Bans
                {player.excludedAgents.length + player.bannedRoles.length > 0 &&
                  ` (${player.excludedAgents.length + player.bannedRoles.length})`}
              </summary>

              {/* Banned roles */}
              <fieldset className="agent-group role-bans">
                <legend>Roles</legend>
                {ROLES.map((role) => (
                  <label key={role} className="check">
                    <input
                      type="checkbox"
                      checked={player.bannedRoles.includes(role)}
                      onChange={() => toggleBannedRole(player, role)}
                    />
                    <span className={`role-text ${role}`}>{role}</span>
                  </label>
                ))}
              </fieldset>

              {/* Banned agents */}
              {ROLES.map((role) => (
                <fieldset key={role} className="agent-group">
                  <legend className={`role-text ${role}`}>{role}</legend>
                  {AGENTS.filter((a) => a.role === role).map((agent) => (
                    <label key={agent.name} className="check">
                      <input
                        type="checkbox"
                        checked={player.excludedAgents.includes(agent.name)}
                        onChange={() => toggleExcluded(player, agent.name)}
                      />
                      <img className="chip-icon" src={agentIconUrl(agent.name)} alt="" />
                      {agent.name}
                    </label>
                  ))}
                </fieldset>
              ))}
            </details>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ghost"
        disabled={players.length >= MAX_PLAYERS}
        title={players.length >= MAX_PLAYERS ? `A team can have at most ${MAX_PLAYERS} players.` : undefined}
        onClick={() =>
          onChange([...players, { id: crypto.randomUUID(), name: "", excludedAgents: [], bannedRoles: [] }])
        }
      >
        Add player
      </button>

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
