interface Props {
  /** Whether there is a roll yet. Lock in waits for one. */
  rolled: boolean;
  /** Whether the roll is locked in, which is when Lock in becomes New. */
  locked: boolean;
  /** Whether every player has an agent, by roll or by hand. Lock in waits for this. */
  everyoneHasAgent: boolean;
  /** Whether every player's pick is locked, which leaves nothing for Roll to change. */
  allKept: boolean;
  onRoll: () => void;
  onLockIn: () => void;
  onNew: () => void;
  /** Where this copy sits, so CSS can show the one that belongs: beside the title, or beside the rules. */
  className?: string;
}

/**
 * Roll, and the button beside it that is Lock in until the roll is locked in and New after (D26, D35).
 * Once the roll is locked in, Roll is greyed out and reads "Game in progress", so New is the way on (D-new2).
 *
 * The page draws it twice, because a phone pins it to the bottom, a tablet puts it beside the title and a
 * desktop puts it in the Rules panel (D38). CSS shows one copy at a time, so only the visible one is
 * ever read or tapped. Lock in and New are one button of one width, so swapping them never changes its size.
 */
export function RollBar({ rolled, locked, everyoneHasAgent, allKept, onRoll, onLockIn, onNew, className = "" }: Props) {
  return (
    <div className={`roll-bar ${className}`}>
      <button type="button" className={`roll${locked ? " busy" : ""}`} disabled={allKept || locked} onClick={onRoll}>
        {locked ? "Game in progress" : "Roll"}
      </button>
      <button
        type="button"
        className="roll lock"
        disabled={!rolled || (!locked && !everyoneHasAgent)}
        onClick={locked ? onNew : onLockIn}
      >
        {locked ? "New" : "Lock in"}
      </button>
    </div>
  );
}
