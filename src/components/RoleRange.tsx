import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRef } from "react";
import { describeRange } from "../lib/minimums";
import { MAX_PLAYERS } from "../lib/types";

interface Props {
  /** The role's name, for the screen reader. */
  label: string;
  min: number;
  max: number;
  /** The lowest the maximum may go: its own minimum, or higher if the maximums must still leave room for the team. */
  lowestMax: number;
  /** True while the role's switch is off: the range is kept and drawn grey, and can't be changed. */
  disabled: boolean;
  onChange: (min: number, max: number) => void;
}

type Handle = "min" | "max";

const NOTCHES = Array.from({ length: MAX_PLAYERS + 1 }, (_, n) => n);

/**
 * A role's range as a track with two handles, one for the least and one for the most players it
 * may have, and the range in words beside it. Dragging, tapping the track and the arrow keys all move
 * a handle one notch at a time. A role with both handles at the ends has no rule and reads "Any". When
 * the role's switch is off the range is kept but greyed out, reads "Off" and ignores input.
 *
 * The minimum handle can't pass the maximum, and the maximum handle stops at `lowestMax`, so the
 * rules can never ask for an impossible team (3A). The minimum is free to rise above the team size,
 * because a roll fills as many required roles as it can (D39).
 */
export function RoleRange({ label, min, max, lowestMax, disabled, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null);
  // The handle being dragged. When both sit on one notch it is chosen by the first move (left takes the minimum).
  const dragging = useRef<{ handle: Handle | null; start: number } | null>(null);

  const move = (handle: Handle, notch: number) => {
    if (handle === "min") onChange(Math.min(Math.max(notch, 0), max), max);
    else onChange(min, Math.min(Math.max(notch, Math.max(min, lowestMax)), MAX_PLAYERS));
  };

  const notchAt = (event: PointerEvent): number => {
    const box = track.current!.getBoundingClientRect();
    // Notches sit between the track's end padding, the same 10px the handles are inset by.
    const inner = box.width - 20;
    const along = (event.clientX - box.left - 10) / inner;
    return Math.min(MAX_PLAYERS, Math.max(0, Math.round(along * MAX_PLAYERS)));
  };

  const onPointerDown = (event: PointerEvent) => {
    if (disabled) return;
    const notch = notchAt(event);
    const grabbed = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | undefined;
    let handle: Handle | null = grabbed ?? null;
    if (!handle) {
      if (notch < min) handle = "min";
      else if (notch > max) handle = "max";
      else if (min !== max) handle = notch - min <= max - notch ? "min" : "max";
    }
    dragging.current = { handle, start: handle ? notch : min };
    track.current!.setPointerCapture(event.pointerId);
    if (handle && !grabbed) move(handle, notch);
  };

  const onPointerMove = (event: PointerEvent) => {
    const drag = dragging.current;
    if (!drag) return;
    const notch = notchAt(event);
    if (drag.handle === null) {
      if (notch === drag.start) return;
      drag.handle = notch < drag.start ? "min" : "max";
    }
    move(drag.handle, notch);
  };

  const endDrag = () => {
    dragging.current = null;
  };

  const onKeyDown = (handle: Handle) => (event: KeyboardEvent) => {
    const now = handle === "min" ? min : max;
    const keys: Record<string, number> = {
      ArrowLeft: now - 1,
      ArrowDown: now - 1,
      ArrowRight: now + 1,
      ArrowUp: now + 1,
      Home: 0,
      End: MAX_PLAYERS,
    };
    if (disabled || !(event.key in keys)) return;
    event.preventDefault();
    move(handle, keys[event.key]);
  };

  const at = (n: number) => ({ "--p": n / MAX_PLAYERS }) as CSSProperties;

  return (
    <div className={`range${disabled ? " is-off" : ""}`} role="group" aria-label={`${label} limits`}>
      <div
        ref={track}
        className="range-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="range-rail" />
        {NOTCHES.map((n) => (
          <span key={n} className="range-tick" style={at(n)} />
        ))}
        <span className="range-fill" style={{ "--from": min / MAX_PLAYERS, "--to": max / MAX_PLAYERS } as CSSProperties} />
        <span
          className="range-handle"
          data-handle="min"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Fewest ${label}s`}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={min}
          style={at(min)}
          onKeyDown={onKeyDown("min")}
        />
        <span
          className="range-handle"
          data-handle="max"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Most ${label}s`}
          aria-valuemin={Math.max(min, lowestMax)}
          aria-valuemax={MAX_PLAYERS}
          aria-valuenow={max}
          style={at(max)}
          onKeyDown={onKeyDown("max")}
        />
      </div>
      <span className="range-value" aria-live="polite">
        {disabled ? "Off" : describeRange(min, max)}
      </span>
    </div>
  );
}
