import { useRef } from "react";
import { CODE_LENGTH, normaliseCode, spreadCode } from "../lib/party";

interface Props {
  /** One string per box, empty where nothing is typed yet. */
  boxes: string[];
  onChange: (boxes: string[]) => void;
  /** Called when the last box has just been filled, so the page can move on to the name. */
  onFull?: () => void;
}

/**
 * The party code as four single-character boxes.
 *
 * Typing moves on to the next box, Backspace on an empty box goes back, and pasting a whole code
 * fills them all. They are four real text inputs in one labelled group, so a screen reader and
 * the phone's own keyboard treat them like any other field.
 */
export function CodeBoxes({ boxes, onChange, onFull }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const type = (index: number, typed: string) => {
    const next = spreadCode(boxes, index, typed);
    onChange(next.boxes);
    if (!typed) return;
    refs.current[next.focus]?.focus();
    if (next.boxes.every(Boolean) && index + normaliseCode(typed).length >= CODE_LENGTH) onFull?.();
  };

  return (
    <div className="code-boxes" role="group" aria-label="Party code">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          aria-label={`Party code letter ${index + 1}`}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          // Wider than one so a paste or an autofill arrives whole. spreadCode keeps what fits.
          maxLength={CODE_LENGTH}
          value={boxes[index] ?? ""}
          onChange={(e) => type(index, e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !boxes[index] && index > 0) refs.current[index - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
