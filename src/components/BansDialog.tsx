import { useEffect, useRef } from "react";
import { AGENTS, agentIconUrl } from "../data/agents";
import type { Player, Role } from "../lib/types";
import { ROLES } from "../lib/types";
import { BanIcon } from "./icons";

interface Props {
  player: Player;
  /** What to call the player: their name, or "Player 3" for an empty slot. */
  label: string;
  onChange: (patch: Partial<Player>) => void;
  onClose: () => void;
}

/**
 * One player's bans: roles at the top, then every agent as a tile to tap.
 *
 * Built on the browser's own modal <dialog>, so Escape, the page behind going
 * inert and focus returning to the opener all come for free. It is full screen
 * on phones and a centred card on wide screens, which CSS decides. Role bans
 * and agent bans stay separate lists (D11): an agent hidden by a banned role
 * is greyed out but is not added to the agent bans.
 */
export function BansDialog({ player, label, onChange, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 1. Open as a modal on mount. The check keeps React's double effect run in development from throwing.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

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
    <dialog
      ref={dialogRef}
      className="bans-dialog"
      aria-label={`Bans for ${label}`}
      onClose={onClose}
      // A click on the dim area outside the card lands on the dialog itself, not on something inside it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bans-body">
        {/* Header */}
        <header className="bans-head">
          <div>
            <span className="muted">{label}</span>
            <h2>Bans</h2>
          </div>
          <button type="button" className="roll small" onClick={onClose}>
            Done
          </button>
        </header>

        {/* Banned roles */}
        <section>
          <h3 className="section-label">Roles they never want</h3>
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
                {AGENTS.filter((a) => a.role === role).map((agent) => {
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
    </dialog>
  );
}
