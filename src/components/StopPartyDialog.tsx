import { useEffect, useRef } from "react";

interface Props {
  /** How many friends are connected, so the question can say who it would drop. */
  friends: number;
  onStop: () => void;
  onCancel: () => void;
}

/**
 * Asks before Home ends a party that friends are still in.
 *
 * Built on the browser's own modal <dialog>, like the Bans dialog, so Escape and focus come for free.
 * Escape and a tap outside both count as Cancel.
 */
export function StopPartyDialog({ friends, onStop, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open as a modal on mount. The check keeps React's double effect run in development from throwing.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-label="Stop the party and go home"
      onClose={onCancel}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <h2>Stop the party?</h2>
      <p>
        {friends === 1 ? "1 friend is" : `${friends} friends are`} in this party. Going home ends it for{" "}
        {friends === 1 ? "them" : "everyone"}.
      </p>
      <div className="confirm-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="roll small" onClick={onStop}>
          Stop and go home
        </button>
      </div>
    </dialog>
  );
}
