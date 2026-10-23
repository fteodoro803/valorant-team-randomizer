import { agentIconUrl } from "../data/agents";
import type { Assignment, Player } from "../lib/types";

interface Props {
  comp: Assignment[];
  players: Player[];
  /** Changes on every roll, so the cards are drawn fresh and the reveal plays again. */
  rollId: number;
}

/**
 * The rolled comp: one card per player showing their agent and role.
 *
 * A row on phones and a column of five on wide screens, both drawn by CSS.
 * The whole list appears at once (the reveal is a CSS animation on each card),
 * and the section is a live region, so a screen reader hears the new comp.
 */
export function CompResult({ comp, players, rollId }: Props) {
  const nameOf = (id: string) => {
    const index = players.findIndex((p) => p.id === id);
    return players[index]?.name || `Player ${index + 1}`;
  };

  return (
    <section aria-live="polite">
      <h2 className="section-label">Your comp</h2>
      <ul className="cards">
        {comp.map((pick) => (
          <li key={`${rollId}-${pick.playerId}`} className={`card ${pick.role}`}>
            <img className="card-art" src={agentIconUrl(pick.agent)} alt="" />
            <div className="card-body">
              <span className="card-role">{pick.role}</span>
              <span className="card-agent">{pick.agent}</span>
              <span className="card-player">{nameOf(pick.playerId)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
