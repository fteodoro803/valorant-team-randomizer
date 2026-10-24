import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BanIcon, KebabIcon, TrashIcon, UserMinusIcon } from "./icons";

interface Props {
  /** What to call the player: their name, or "Player 3" for an empty slot. */
  label: string;
  /** Whether the player has a name, since only a named person has anything saved to forget (D10). */
  named: boolean;
  /** How many agents and roles they have banned, shown beside Bans. */
  banCount: number;
  /** False when they are the last player, who cannot be taken off the team. */
  canRemove: boolean;
  /** True for someone in the party, whose bans and name live on their own device, so only Remove is offered. */
  managed?: boolean;
  onBans: () => void;
  /** Take them off the team. With `forget`, also delete their saved bans and history (D9). */
  onRemove: (forget: boolean) => void;
}

/**
 * The three-dots button on a player's row, and the menu it opens.
 *
 * Holds everything player-specific: Bans, Remove from team and Forget. CSS draws it as a
 * bottom sheet on phones and a popover under the button on wide screens. Escape,
 * the arrow keys and tapping outside close or move through it, and focus goes to the first
 * item on open and back to the button on close, which a plain list of buttons would not do.
 */
export function PlayerMenu({ label, named, banCount, canRemove, managed = false, onBans, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);

  useEffect(() => {
    if (open) items()[0]?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Tab") {
      // Tabbing out of the menu closes it, rather than leaving it open behind the next field.
      setOpen(false);
    }
  };

  // Bans keeps focus on the button first, so the dialog it opens returns focus there when it closes.
  const chooseBans = () => {
    triggerRef.current?.focus();
    setOpen(false);
    onBans();
  };

  const choose = (forget: boolean) => () => {
    setOpen(false);
    onRemove(forget);
  };

  return (
    <div className="menu-anchor">
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        aria-label={`Options for ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-open={open}
        onClick={() => setOpen((o) => !o)}
      >
        <KebabIcon />
      </button>

      {open && (
        <>
          {/* Catches a tap outside the menu. Dim on phones, invisible on wide screens. */}
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div id={menuId} ref={menuRef} role="menu" aria-label={`Options for ${label}`} className="menu" onKeyDown={onKeyDown}>
            <div className="menu-handle" aria-hidden="true" />
            <div className="menu-head">
              <span className="menu-title">{label}</span>
              <span className="muted">Player options</span>
            </div>

            {!managed && (
              <button type="button" role="menuitem" className="menu-item" onClick={chooseBans}>
                <BanIcon size={22} />
                <span className="menu-text">
                  <span className="menu-label">Bans</span>
                  <span className="menu-hint sheet-only">Agents and roles they never want</span>
                </span>
                {banCount > 0 && <span className="menu-count">{banCount}</span>}
              </button>
            )}

            <button type="button" role="menuitem" className="menu-item" disabled={!canRemove} onClick={choose(false)}>
              <UserMinusIcon size={22} />
              <span className="menu-text">
                <span className="menu-label">Remove from team</span>
                {named && <span className="menu-hint">Keeps their bans and history</span>}
              </span>
            </button>

            {named && !managed && (
              <button type="button" role="menuitem" className="menu-item danger" disabled={!canRemove} onClick={choose(true)}>
                <TrashIcon size={22} />
                <span className="menu-text">
                  <span className="menu-label">Forget {label}</span>
                  <span className="menu-hint">Deletes their saved bans and history</span>
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
