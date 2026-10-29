import { useState } from "react";
import { keyForName, playerKey, suggestSaved } from "../lib/roster";
import type { Player, Roster, Teammate } from "../lib/types";
import { AgentGrid } from "./AgentGrid";
import { PlusIcon } from "./icons";
import { NameField } from "./NameField";
import { SheetDialog } from "./SheetDialog";

/** What the window is open for: a new person, or a random teammate already on the team. */
export type CardDialogTarget = { kind: "add" } | { kind: "teammate"; teammate: Teammate };

interface Props {
  target: CardDialogTarget;
  players: Player[];
  teammates: Teammate[];
  roster: Roster;
  /** Put a player on the team by name, with the bans saved for that name. A blank name adds an unnamed player. */
  onAddPlayer: (name: string) => void;
  /** Put a random teammate on the team, with the agent they picked. */
  onAddTeammate: (agent: string) => void;
  onSetAgent: (id: string, agent: string) => void;
  onRemoveTeammate: (id: string) => void;
  /** Forget a saved person and their history, by their roster key. */
  onForget: (key: string) => void;
  onClose: () => void;
}

const agentsOf = (teammates: Teammate[]): string[] => teammates.flatMap((t) => (t.agent ? [t.agent] : []));

/**
 * A new person: a name box for a player, and every agent for someone who isn't on the app.
 *
 * Both are here at once, so there is no choice to make first: typing a name and pressing Add makes a
 * player, who gets an agent from the roll, and tapping an agent makes a random teammate who
 * already has it. Saved people who are off the team sit below the name box as chips, to add or forget.
 */
function AddView({ players, teammates, roster, onAddPlayer, onAddTeammate, onForget }: Pick<Props, "players" | "teammates" | "roster" | "onAddPlayer" | "onAddTeammate" | "onForget">) {
  const [name, setName] = useState("");
  const typed = name.trim();
  const onTeam = typed !== "" && players.some((p) => playerKey(p) === keyForName(typed));
  const bench = suggestSaved(roster, players, "");

  return (
    <>
      {/* Player */}
      <div className="picker-side">
        <h3 className="section-label">Player</h3>
        <form
          className="picker-name"
          onSubmit={(e) => {
            e.preventDefault();
            if (!onTeam) onAddPlayer(typed);
          }}
        >
          <NameField
            value={name}
            placeholder="Name"
            ariaLabel="Name for a new player"
            suggestions={suggestSaved(roster, players, name)}
            onChange={setName}
            onPick={(saved) => onAddPlayer(saved.name)}
            onFocus={() => {}}
            onBlur={() => {}}
          />
          <button type="submit" className="roll small" disabled={onTeam}>
            Add
          </button>
        </form>
        {onTeam && <p className="picker-hint">{typed} is already on the team.</p>}

        {bench.length > 0 && (
          <ul className="bench-chips" aria-label="Saved players">
            {bench.map((saved) => (
              <li key={saved.name} className="bench-chip">
                <button type="button" className="bench-add" aria-label={`Add ${saved.name} to the team`} onClick={() => onAddPlayer(saved.name)}>
                  <PlusIcon size={14} />
                  {saved.name}
                </button>
                <button
                  type="button"
                  className="bench-forget"
                  title="Forget: delete this person's saved bans and history"
                  aria-label={`Forget ${saved.name}`}
                  onClick={() => onForget(keyForName(saved.name))}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Agents: someone not on the app, with the agent they picked */}
      <div className="picker-agents">
        <h3 className="section-label">Or pick an agent for someone not on the app</h3>
        <AgentGrid current={null} taken={agentsOf(teammates)} onPick={onAddTeammate} />
      </div>
    </>
  );
}

/** A random teammate: their agent can be changed here, and Remove teammate is in the bar at the bottom. */
function TeammateView({ teammate, teammates, onSetAgent }: { teammate: Teammate; teammates: Teammate[]; onSetAgent: (agent: string) => void }) {
  return (
    <>
      <p className="picker-hint">Not on the app. Roll never gives this agent, and their role counts toward the role minimums.</p>
      <div className="picker-agents">
        <h3 className="section-label">Change their agent</h3>
        <AgentGrid current={teammate.agent} taken={agentsOf(teammates.filter((t) => t.id !== teammate.id))} onPick={onSetAgent} />
      </div>
    </>
  );
}

/**
 * The window for a card that needs something from you: an Empty card to fill, or a random teammate to
 * change (D-new2).
 *
 * It is the same window as Configure (SheetDialog): a modal on wide screens and a bottom sheet on phones.
 * An Empty card shows a name box and every agent at once, so a typed name makes a player and a tapped
 * agent makes a random teammate, with nothing to choose first. A random teammate's card shows the
 * agents with theirs outlined and a bar with Remove teammate. Adding, picking and removing all close it.
 */
export function CardDialog({ target, players, teammates, roster, onAddPlayer, onAddTeammate, onSetAgent, onRemoveTeammate, onForget, onClose }: Props) {
  const adding = target.kind === "add";

  return (
    <SheetDialog
      label={adding ? "Add to the team" : "Edit random teammate"}
      eyebrow={adding ? "Empty card" : "Not on the app"}
      title={adding ? "Add" : "Random teammate"}
      onClose={onClose}
      footer={
        target.kind === "teammate" ? (
          <div className="configure-actions">
            <button type="button" className="ghost danger-text" onClick={() => onRemoveTeammate(target.teammate.id)}>
              Remove teammate
            </button>
          </div>
        ) : undefined
      }
    >
      {target.kind === "add" ? (
        <AddView players={players} teammates={teammates} roster={roster} onAddPlayer={onAddPlayer} onAddTeammate={onAddTeammate} onForget={onForget} />
      ) : (
        <TeammateView teammate={target.teammate} teammates={teammates} onSetAgent={(agent) => onSetAgent(target.teammate.id, agent)} />
      )}
    </SheetDialog>
  );
}
