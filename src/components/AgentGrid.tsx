import { agentIconUrl, agentsInRole } from "../data/agents";
import { ROLES } from "../lib/types";

interface Props {
  /** The agent picked now, or null while none is. */
  current: string | null;
  /** Agents the other random teammates already have, which can't be picked twice. */
  taken: string[];
  onPick: (agent: string) => void;
}

/**
 * Every agent as a tile, grouped by role, for picking one as a random teammate's agent.
 *
 * The same tiles as the Bans dialog. Tapping a tile picks that agent, so there is no Done to press.
 */
export function AgentGrid({ current, taken, onPick }: Props) {
  return (
    <div className="ban-picker">
      {ROLES.map((role) => (
        <fieldset key={role} className={`ban-group ${role}`}>
          <legend>{role}</legend>
          <div className="tiles">
            {agentsInRole(role).map((agent) => {
              const picked = agent.name === current;
              const isTaken = taken.includes(agent.name);
              return (
                <button
                  key={agent.name}
                  type="button"
                  className="tile"
                  data-picked={picked}
                  data-taken={isTaken}
                  aria-pressed={picked}
                  disabled={isTaken}
                  title={isTaken ? "Another random teammate has this agent" : undefined}
                  onClick={() => onPick(agent.name)}
                >
                  <span className="tile-art">
                    <img src={agentIconUrl(agent.name)} alt="" />
                  </span>
                  <span className="tile-name">{agent.name}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
