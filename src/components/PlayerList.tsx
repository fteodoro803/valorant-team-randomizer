import type { HostStatus } from "../hooks/useParty";
import { PlusIcon } from "./icons";
import { PlayerRow } from "./PlayerRow";
import { TeammateRow } from "./TeammateRow";
import { addSavedToTeam, playerKey } from "../lib/roster";
import { addTeammate, slotsForPlayers } from "../lib/teammates";
import type { Player, Roster, Teammate } from "../lib/types";
import { MAX_PLAYERS } from "../lib/types";

interface Props {
  players: Player[];
  /** Random teammates: on the team but not using the app. They share the team's five slots. */
  teammates: Teammate[];
  roster: Roster;
  onChange: (players: Player[]) => void;
  onTeammatesChange: (teammates: Teammate[]) => void;
  /** Take a player off the team. With `forget`, also delete their saved details and history. */
  onRemove: (player: Player, forget: boolean) => void;
  /** Forget a saved person and their history, by their roster key. */
  onForget: (key: string) => void;
  /** The party this team is hosting, if any: its code once it is open, and how many friends are in. */
  party: { code: string | null; status: HostStatus; onStart: () => void; onStop: () => void };
}

/**
 * The team: a row for each player, then a greyed row for each random teammate, with Add player and Add random
 * teammate as a dashed row under the last one, Start a party beside the heading, and a bench of saved people.
 *
 * While a party is open the heading carries its code in brackets and the same button reads Stop party. A joined
 * friend's row is drawn by PlayerRow, with its own status dot, so there is no count of who is in.
 *
 * Everything player-specific (bans, remove, forget) sits behind the three-dots menu
 * in each row, so this file only deals with the list as a whole. The bench lists only
 * saved people who are off the team, as chips: tap one to add them back, or the x to
 * forget them. It disappears when nobody is off the team, so it never repeats the rows above.
 */
export function PlayerList({ players, teammates, roster, onChange, onTeammatesChange, onRemove, onForget, party }: Props) {
  const update = (id: string, patch: Partial<Player>) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const full = players.length + teammates.length >= MAX_PLAYERS;
  const fullMessage = `A team can have at most ${MAX_PLAYERS} players.`;
  const updateTeammate = (id: string, agent: string | null) =>
    onTeammatesChange(teammates.map((t) => (t.id === id ? { ...t, agent } : t)));

  const bench = Object.entries(roster).filter(([key]) => !players.some((p) => playerKey(p) === key));

  return (
    <section className="panel">
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
        {/* Random teammates: greyed rows for people on the team who aren't using the app */}
        {teammates.map((teammate) => (
          <TeammateRow
            key={teammate.id}
            teammate={teammate}
            takenByOthers={teammates.filter((t) => t.id !== teammate.id && t.agent).map((t) => t.agent!)}
            onPick={(agent) => updateTeammate(teammate.id, agent)}
            onRemove={() => onTeammatesChange(teammates.filter((t) => t.id !== teammate.id))}
          />
        ))}
        {/* Add: dashed buttons where the next player, or a random teammate, would go */}
        <li className="add-row">
          <button
            type="button"
            className="add-player"
            disabled={full}
            title={full ? fullMessage : undefined}
            onClick={() =>
              onChange([...players, { id: crypto.randomUUID(), name: "", excludedAgents: [], bannedRoles: [] }])
            }
          >
            <PlusIcon size={16} />
            Add player
          </button>
          <button
            type="button"
            className="add-player"
            disabled={full}
            title={full ? fullMessage : "Someone on your team who isn't using the app, with the agent they picked"}
            onClick={() => {
              const next = addTeammate(players, teammates, crypto.randomUUID());
              if (next) onTeammatesChange(next);
            }}
          >
            <PlusIcon size={16} />
            Add random teammate
          </button>
        </li>
      </ul>

      {/* Bench: saved people who are not on the team */}
      {bench.length > 0 && (
        <div className="bench">
          <p className="bench-label">Saved</p>
          <ul className="bench-chips">
            {bench.map(([key, saved]) => {
              const hasRoom = addSavedToTeam(players, saved, "check", slotsForPlayers(teammates)) !== null;
              return (
                <li key={key} className="bench-chip">
                  <button
                    type="button"
                    className="bench-add"
                    disabled={!hasRoom}
                    title={hasRoom ? "Add to the team" : `A team can have at most ${MAX_PLAYERS} players.`}
                    aria-label={`Add ${saved.name} to the team`}
                    onClick={() => {
                      const next = addSavedToTeam(players, saved, crypto.randomUUID(), slotsForPlayers(teammates));
                      if (next) onChange(next);
                    }}
                  >
                    <PlusIcon size={14} />
                    {saved.name}
                  </button>
                  <button
                    type="button"
                    className="bench-forget"
                    title="Forget: delete this person's saved bans and history"
                    aria-label={`Forget ${saved.name}`}
                    onClick={() => onForget(key)}
                  >
                    &times;
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
