import { MAX_PLAYERS } from "../lib/types";

interface Props {
  /** The role's name, for the screen reader. */
  label: string;
  min: number;
  max: number;
  /** The lowest the maximum may go: its own minimum, or higher if the maximums must still leave room for the team. */
  lowestMax: number;
  onChange: (min: number, max: number) => void;
}

interface StepperProps {
  /** What the number is, for the screen reader, e.g. "Fewest duelists". */
  name: string;
  value: number;
  lowest: number;
  highest: number;
  onStep: (next: number) => void;
}

/** One number with a minus and a plus, which grey out at the ends of what the number may be. */
function Stepper({ name, value, lowest, highest, onStep }: StepperProps) {
  const down = value > lowest;
  const up = value < highest;
  return (
    <div className="stepper" role="group" aria-label={name}>
      <button
        type="button"
        className="step"
        aria-label={`Fewer: ${name}`}
        aria-disabled={!down}
        onClick={() => down && onStep(value - 1)}
      >
        −
      </button>
      <span className="step-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="step"
        aria-label={`More: ${name}`}
        aria-disabled={!up}
        onClick={() => up && onStep(value + 1)}
      >
        +
      </button>
    </div>
  );
}

/**
 * A role's range as two steppers, the least and the most players it may have, with "to" between them.
 * A role with the full range, 0 to 5, has no rule.
 *
 * The fewest can't pass the most, and the most stops at `lowestMax`, so the rules can never ask for
 * an impossible team (3A). The fewest is free to rise above the team size, because a roll fills as
 * many required roles as it can (D39).
 */
export function RoleRange({ label, min, max, lowestMax, onChange }: Props) {
  return (
    <div className="range" role="group" aria-label={`${label} limits`}>
      <Stepper
        name={`Fewest ${label}s`}
        value={min}
        lowest={0}
        highest={max}
        onStep={(next) => onChange(next, max)}
      />
      <span className="range-to" aria-hidden="true">
        to
      </span>
      <Stepper
        name={`Most ${label}s`}
        value={max}
        lowest={Math.max(min, lowestMax)}
        highest={MAX_PLAYERS}
        onStep={(next) => onChange(min, next)}
      />
    </div>
  );
}
