import { agentIconUrl } from "../data/agents";
import type { History, Player } from "../lib/types";
import { HISTORY_LIMIT } from "../lib/types";

interface Props {
  players: Player[];
  history: History;
  onClear: () => void;
}

/**
 * What each player was recently given, newest on the right.
 *
 * Only shows the picks the roller remembers, so it is also a quick way to see
 * why someone keeps being steered away from a role.
 */
export function HistoryView({ players, history, onClear }: Props) {
  const hasAny = players.some((p) => (history[p.id] ?? []).length > 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>History</h2>
        <button type="button" className="ghost" disabled={!hasAny} onClick={onClear}>
          Clear history
        </button>
      </div>
      {!hasAny ? (
        <p className="muted">Nothing yet. Each roll is remembered, up to {HISTORY_LIMIT} per player.</p>
      ) : (
        <ul className="history">
          {players.map((player, index) => (
            <li key={player.id}>
              <span className="history-name">{player.name || `Player ${index + 1}`}</span>
              <span className="chips">
                {(history[player.id] ?? []).map((pick, i) => (
                  <span key={i} className={`chip ${pick.role}`} title={pick.role}>
                    <img className="chip-icon" src={agentIconUrl(pick.agent)} alt="" />
                    {pick.agent}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
