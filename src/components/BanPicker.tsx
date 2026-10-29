import { agentIconUrl, agentsInRole } from "../data/agents";
import type { Player, Role } from "../lib/types";
import { ROLES } from "../lib/types";
import { BanIcon } from "./icons";

interface Props {
  player: Player;
  /** The heading over the role chips, which says whose bans these are: "Roles they never want" or "Roles you never want". */
  roleHeading: string;
  onChange: (patch: Partial<Player>) => void;
}

/**
 * Someone's bans: role chips at the top, then every agent as a tile to tap, grouped by role.
 *
 * Shared by the Bans dialog (the host editing a player) and a party member's own page, so the two
 * look and behave the same (D23 follow-up). Role bans and agent bans stay separate lists (D11): an agent
 * hidden by a banned role is greyed out but is not added to the agent bans.
 */
export function BanPicker({ player, roleHeading, onChange }: Props) {
  const toggleAgent = (agent: string) =>
    onChange({
      excludedAgents: player.excludedAgents.includes(agent)
        ? player.excludedAgents.filter((name) => name !== agent)
        : [...player.excludedAgents, agent],
    });

  const toggleRole = (role: Role) =>
    onChange({
      bannedRoles: player.bannedRoles.includes(role)
        ? player.bannedRoles.filter((r) => r !== role)
        : [...player.bannedRoles, role],
    });

  return (
    <div className="ban-picker">
      {/* Banned roles */}
      <section>
        <h3 className="section-label">{roleHeading}</h3>
        <div className="role-chips">
          {ROLES.map((role) => {
            const on = player.bannedRoles.includes(role);
            return (
              <button
                key={role}
                type="button"
                className={`chip ${role}`}
                aria-pressed={on}
                onClick={() => toggleRole(role)}
              >
                {on && <BanIcon size={14} />}
                {role}
              </button>
            );
          })}
        </div>
      </section>

      {/* Banned agents, grouped by role */}
      {ROLES.map((role) => {
        const viaRole = player.bannedRoles.includes(role);
        return (
          <fieldset key={role} className={`ban-group ${role}`}>
            <legend>
              {role}
              {viaRole && " · banned as a role"}
            </legend>
            <div className="tiles">
              {agentsInRole(role).map((agent) => {
                const banned = player.excludedAgents.includes(agent.name);
                return (
                  <label key={agent.name} className="tile" data-banned={banned} data-via-role={viaRole}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={banned}
                      onChange={() => toggleAgent(agent.name)}
                    />
                    <span className="tile-art">
                      <img src={agentIconUrl(agent.name)} alt="" />
                    </span>
                    <span className="tile-name">{agent.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
