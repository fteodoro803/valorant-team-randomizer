import { useEffect } from "react";
import { CloseIcon } from "./icons";

export interface ToastMessage {
  /** Counts up with every message, so a new one restarts the fade even if the words are the same. */
  id: number;
  text: string;
  /** An error is announced at once and drawn in the accent colour. */
  tone: "error" | "info";
  /** A sticky message waits to be closed, or for the app to clear it. Others fade by themselves. */
  sticky: boolean;
}

/** How long a message that fades stays on screen. */
const FADE_MS = 6000;

interface Props {
  toast: ToastMessage | null;
  /** True on a page with no Roll bar pinned to the bottom, so the toast can sit lower. */
  low?: boolean;
  onClose: (id: number) => void;
}

/**
 * A short message that floats near the bottom of the screen: above the Roll bar on phones,
 * bottom centre on wide screens.
 *
 * Every party message uses it: a name that is taken, a code with no party, being removed,
 * the party ending. Errors stay until closed so they can't vanish before they are read,
 * and the rest fade after a few seconds. It is a live region, so a screen reader hears it.
 */
export function Toast({ toast, low = false, onClose }: Props) {
  const id = toast?.id;
  const sticky = toast?.sticky ?? true;

  useEffect(() => {
    if (id === undefined || sticky) return;
    const timer = setTimeout(() => onClose(id), FADE_MS);
    return () => clearTimeout(timer);
    // `onClose` is remade every render, and only the message and its stickiness should restart the timer.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sticky]);

  if (!toast) return null;
  return (
    <div className={`toast${low ? " low" : ""}`} data-tone={toast.tone} role={toast.tone === "error" ? "alert" : "status"}>
      <p>{toast.text}</p>
      <button type="button" className="icon-btn toast-close" aria-label="Dismiss message" onClick={() => onClose(toast.id)}>
        <CloseIcon size={18} />
      </button>
    </div>
  );
}
