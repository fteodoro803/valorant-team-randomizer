import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface Props {
  /** What a screen reader calls the window. */
  label: string;
  /** The small line over the title, such as whose window it is. */
  eyebrow: string;
  title: string;
  /** A bar that stays at the bottom while the body scrolls, such as Remove from team. */
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}

/**
 * The window Configure and the Empty-card window share (D33): a header with Done, a body that
 * scrolls, and an optional bar at the bottom.
 *
 * Built on the browser's own modal <dialog>, so Escape, the page behind going inert and focus returning
 * to the opener come for free. It is a centred card on wide screens and a bottom sheet on phones,
 * which CSS decides.
 */
export function SheetDialog({ label, eyebrow, title, footer, children, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open as a modal on mount. The check keeps React's double effect run in development from throwing.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="configure-dialog"
      aria-label={label}
      onClose={onClose}
      // A click on the dim area outside the card lands on the dialog itself, not on something inside it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <header className="configure-head">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="configure-title">
          <div>
            <span className="muted">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="roll small" onClick={onClose}>
            Done
          </button>
        </div>
      </header>

      {/* Body: scrolls between the header and the bottom bar */}
      <div className="configure-body">{children}</div>

      {footer && <footer className="configure-foot">{footer}</footer>}
    </dialog>
  );
}
