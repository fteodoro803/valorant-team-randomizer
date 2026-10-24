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
 * why someone keeps being steered away from a role. The newest pick is outlined
 * because the icons carry no text, so the order needs one cue.
 */
export function HistoryView({ players, history, onClear }: Props) {
  const hasAny = players.some((p) => (history[p.id] ?? []).length > 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-label">History</h2>
        <button type="button" className="ghost" disabled={!hasAny} onClick={onClear}>
          Clear history
        </button>
      </div>
      {!hasAny ? (
        <p className="panel-hint">Nothing yet. Each locked-in roll is remembered, up to {HISTORY_LIMIT} per player.</p>
      ) : (
        <>
          <ul className="history">
            {players.map((player, index) => {
              const picks = history[player.id] ?? [];
              return (
                <li key={player.id}>
                  <span className="history-name">{player.name || `Player ${index + 1}`}</span>
                  <span className="history-strip">
                    {picks.map((pick, i) => (
                      <img
                        key={i}
                        className={`history-icon ${i === picks.length - 1 ? "newest" : ""}`}
                        src={agentIconUrl(pick.agent)}
                        alt={pick.agent}
                        title={`${pick.agent} (${pick.role})`}
                      />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="panel-hint">Newest on the right, outlined. Up to {HISTORY_LIMIT} per player.</p>
        </>
      )}
    </section>
  );
}
