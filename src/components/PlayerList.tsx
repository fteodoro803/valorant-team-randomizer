import type { HostStatus } from "../hooks/useParty";
import { PlusIcon } from "./icons";
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
  /** The party this team is hosting, if any: its code once it is open, and how many friends are in. */
  party: { code: string | null; status: HostStatus; onStart: () => void; onStop: () => void };
}

/**
 * The team: a row for each player with Add player as a dashed row under the last one, Start a party beside the
 * heading, and a bench of saved people.
 *
 * While a party is open the heading carries its code in brackets and the same button reads Stop party. A joined
 * friend's row is drawn by PlayerRow, with its own status dot, so there is no count of who is in.
 *
 * Everything player-specific (bans, remove, forget) sits behind the three-dots menu
 * in each row, so this file only deals with the list as a whole. The bench lists only
 * saved people who are off the team, as chips: tap one to add them back, or the x to
 * forget them. It disappears when nobody is off the team, so it never repeats the rows above.
 */
export function PlayerList({ players, roster, onChange, onRemove, onForget, party }: Props) {
  const update = (id: string, patch: Partial<Player>) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const bench = Object.entries(roster).filter(([key]) => !players.some((p) => playerKey(p) === key));

  return (
    <section className="panel">
      {/* Heading: the code while hosting, and one button that is Start a party until a party is open and Stop party after, so nothing shifts */}
      <div className="panel-head">
        <h2 className="section-label">
          Team
          {party.code && <span className="party-code-tag">({party.code})</span>}
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
        {/* Add player: a dashed row where the next player would go */}
        <li>
          <button
            type="button"
            className="add-player"
            disabled={players.length >= MAX_PLAYERS}
            title={players.length >= MAX_PLAYERS ? `A team can have at most ${MAX_PLAYERS} players.` : undefined}
            onClick={() =>
              onChange([...players, { id: crypto.randomUUID(), name: "", excludedAgents: [], bannedRoles: [] }])
            }
          >
            <PlusIcon size={16} />
            Add player
          </button>
        </li>
      </ul>

      {/* Bench: saved people who are not on the team */}
      {bench.length > 0 && (
        <div className="bench">
          <p className="bench-label">Saved</p>
          <ul className="bench-chips">
            {bench.map(([key, saved]) => {
              const hasRoom = addSavedToTeam(players, saved, "check") !== null;
              return (
                <li key={key} className="bench-chip">
                  <button
                    type="button"
                    className="bench-add"
                    disabled={!hasRoom}
                    title={hasRoom ? "Add to the team" : `A team can have at most ${MAX_PLAYERS} players.`}
                    aria-label={`Add ${saved.name} to the team`}
                    onClick={() => {
                      const next = addSavedToTeam(players, saved, crypto.randomUUID());
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
