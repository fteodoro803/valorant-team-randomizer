import { useEffect, useRef } from "react";
import { AGENTS, agentIconUrl } from "../data/agents";
import { ROLES } from "../lib/types";

interface Props {
  /** Whose agent this is, shown over the heading. */
  label: string;
  /** The agent picked now, or null while none is. */
  current: string | null;
  /** Agents the other random teammates already have, which can't be picked twice. */
  takenByOthers: string[];
  onPick: (agent: string | null) => void;
  onClose: () => void;
}

/**
 * Pick one agent for a random teammate, from the same tiles as the Bans dialog.
 *
 * Built the same way as BansDialog: the browser's modal <dialog>, full screen on phones and a
 * centred card on wide screens. Tapping a tile picks that agent and closes the dialog, so there is
 * no Done to press. Not picked yet clears the pick and closes too, and Close leaves it as it was.
 */
export function AgentPickerDialog({ label, current, takenByOthers, onPick, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 1. Open as a modal on mount. The check keeps React's double effect run in development from throwing.
  // A pick is the whole job, so choosing closes the dialog.
  const choose = (agent: string | null) => {
    onPick(agent);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="bans-dialog"
      aria-label={`Agent for ${label}`}
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
            <h2>Agent</h2>
          </div>
          <button type="button" className="roll small" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="ban-picker">
          <button type="button" className="ghost clear-pick" disabled={current === null} onClick={() => choose(null)}>
            Not picked yet
          </button>

          {/* Agents, grouped by role */}
          {ROLES.map((role) => (
            <fieldset key={role} className={`ban-group ${role}`}>
              <legend>{role}</legend>
              <div className="tiles">
                {AGENTS.filter((a) => a.role === role).map((agent) => {
                  const picked = agent.name === current;
                  const taken = takenByOthers.includes(agent.name);
                  return (
                    <button
                      key={agent.name}
                      type="button"
                      className="tile"
                      data-picked={picked}
                      data-taken={taken}
                      aria-pressed={picked}
                      disabled={taken}
                      title={taken ? "Another random teammate has this agent" : undefined}
                      onClick={() => choose(agent.name)}
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
      </div>
    </dialog>
  );
}
