import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SavedPlayer } from "../lib/types";

interface Props {
  value: string;
  placeholder: string;
  ariaLabel: string;
  /** The saved people to offer for what is typed, already filtered by the caller. */
  suggestions: SavedPlayer[];
  onChange: (value: string) => void;
  /** A saved person was chosen from the list. */
  onPick: (saved: SavedPlayer) => void;
  onFocus: () => void;
  onBlur: () => void;
}

/** The most options shown before the list scrolls. */
const MAX_VISIBLE = 5;

/**
 * A player's name box, with a list of saved people to pick from.
 *
 * Replaces the browser's own <datalist>, which can't be styled. It follows the standard
 * combobox pattern, so screen readers announce the list and the highlighted option.
 * Nothing is highlighted until an arrow key or the pointer chooses an option, so pressing
 * Enter after typing a new name keeps that name rather than jumping to a saved one.
 * The list opens upward when there isn't room below it, which matters on a phone with the
 * keyboard up. Picking happens on click, with the pointer press kept from stealing focus,
 * so the box doesn't blur (and close the list) before the click lands.
 */
export function NameField({ value, placeholder, ariaLabel, suggestions, onChange, onPick, onFocus, onBlur }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [upward, setUpward] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const visible = open && suggestions.length > 0;
  const typed = value.trim();

  // 1. Flip upward when the list would run off the bottom of what is visible and there is room above.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const list = listRef.current;
    if (!visible || !wrap || !list) return;
    const box = wrap.getBoundingClientRect();
    const room = (window.visualViewport?.height ?? window.innerHeight) - box.bottom;
    setUpward(room < list.offsetHeight + 8 && box.top > list.offsetHeight + 8);
  }, [visible, suggestions.length]);

  // 2. Keep the highlighted option in view when the list scrolls.
  useEffect(() => {
    if (active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const pick = (saved: SavedPlayer) => {
    close();
    onPick(saved);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = suggestions.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (count === 0) return;
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(active === -1 ? (step === 1 ? 0 : count - 1) : (active + step + count) % count);
    } else if (e.key === "Enter" && visible && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape" && visible) {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className="name-field" ref={wrapRef}>
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          onFocus();
        }}
        onChange={(e) => {
          setOpen(true);
          setActive(-1);
          onChange(e.target.value);
        }}
        onBlur={() => {
          close();
          onBlur();
        }}
        onKeyDown={onKeyDown}
      />

      {visible && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Saved players"
          className={`suggestions ${upward ? "upward" : ""}`}
          style={{ maxHeight: MAX_VISIBLE * 44 + 12 }}
          // Pressing here must not move focus off the name box, or the blur would close the list first.
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((saved, i) => {
            const bans = saved.excludedAgents.length + saved.bannedRoles.length;
            const matched = saved.name.toLowerCase().startsWith(typed.toLowerCase()) ? typed.length : 0;
            return (
              <li
                key={saved.name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="suggestion"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(saved)}
              >
                <span className="suggestion-name">
                  <strong>{saved.name.slice(0, matched)}</strong>
                  {saved.name.slice(matched)}
                </span>
                {bans > 0 && (
                  <span className="suggestion-note">
                    <span className="wide-only">Fills in </span>
                    {bans} {bans === 1 ? "ban" : "bans"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
