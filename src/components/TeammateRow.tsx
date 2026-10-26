import { useState } from "react";
import { agentIconUrl } from "../data/agents";
import type { Teammate } from "../lib/types";
import { AgentPickerDialog } from "./AgentPickerDialog";
import { CloseIcon } from "./icons";

interface Props {
  teammate: Teammate;
  /** Agents the other random teammates already picked, which can't be picked twice. */
  takenByOthers: string[];
  onPick: (agent: string | null) => void;
  onRemove: () => void;
}

/**
 * A random teammate: someone on the team who isn't using the app, marked with a small "Random" tag so it's plain they aren't one of ours.
 *
 * Laid out like a player row: a box that fills the width and a button in the same column as the three
 * dots, so the two line up. The box shows the Random tag and the agent that person picked, and opens the agent picker; there
 * is no name or bans. The picker dialog is only mounted while it is open.
 */
export function TeammateRow({ teammate, takenByOthers, onPick, onRemove }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <li className="player teammate">
      <button type="button" className="teammate-box" onClick={() => setPickerOpen(true)}>
        <span className="teammate-tag">Random</span>
        <span className="teammate-agent" data-empty={teammate.agent === null}>
          {teammate.agent && <img className="teammate-icon" src={agentIconUrl(teammate.agent)} alt="" />}
          {teammate.agent ?? "Pick an agent"}
        </span>
      </button>
      <button
        type="button"
        className="icon-btn"
        title="Remove this random teammate"
        aria-label="Remove this random teammate"
        onClick={onRemove}
      >
        <CloseIcon size={16} />
      </button>
      {pickerOpen && (
        <AgentPickerDialog
          label="Random teammate"
          current={teammate.agent}
          takenByOthers={takenByOthers}
          onPick={onPick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </li>
  );
}
