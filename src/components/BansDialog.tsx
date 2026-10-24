import { useEffect, useRef } from "react";
import type { Player } from "../lib/types";
import { BanPicker } from "./BanPicker";

interface Props {
  player: Player;
  /** What to call the player: their name, or "Player 3" for an empty slot. */
  label: string;
  onChange: (patch: Partial<Player>) => void;
  onClose: () => void;
}

/**
 * One player's bans in a modal dialog, with the shared BanPicker as its body (D23 follow-up).
 *
 * Built on the browser's own modal <dialog>, so Escape, the page behind going
 * inert and focus returning to the opener all come for free. It is full screen
 * on phones and a centred card on wide screens, which CSS decides.
 */
export function BansDialog({ player, label, onChange, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 1. Open as a modal on mount. The check keeps React's double effect run in development from throwing.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

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

        <BanPicker player={player} roleHeading="Roles they never want" onChange={onChange} />
      </div>
    </dialog>
  );
}
