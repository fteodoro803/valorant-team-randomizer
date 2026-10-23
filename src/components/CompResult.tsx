import { agentIconUrl } from "../data/agents";
import type { Assignment, Player } from "../lib/types";

interface Props {
  comp: Assignment[];
  players: Player[];
}

/** The rolled comp: one card per player showing their agent and role. */
export function CompResult({ comp, players }: Props) {
  const nameOf = (id: string) => {
    const index = players.findIndex((p) => p.id === id);
    return players[index]?.name || `Player ${index + 1}`;
  };

  return (
    <section className="panel" aria-live="polite">
      <h2>Your comp</h2>
      <ul className="cards">
        {comp.map((pick) => (
          <li key={pick.playerId} className={`card ${pick.role}`}>
            <img className="card-icon" src={agentIconUrl(pick.agent)} alt="" />
            <span className="card-player">{nameOf(pick.playerId)}</span>
            <span className="card-agent">{pick.agent}</span>
            <span className="card-role">{pick.role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
