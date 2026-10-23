import { canRaiseMinimums } from "../lib/minimums";
import type { Settings } from "../lib/types";
import { ROLES } from "../lib/types";
import { MinusIcon, PlusIcon } from "./icons";

interface Props {
  settings: Settings;
  /** How many players are on the team, which caps how many can be required. */
  playerCount: number;
  onChange: (settings: Settings) => void;
}

/**
 * The roll's toggles: a minimum for each role, and whether history counts.
 *
 * A role's switch is on when its minimum is above 0. Switching it on starts
 * at 1, and the − and + buttons change it from there. The minimums can never
 * add up to more than the team has players, so + stops once they do.
 */
export function SettingsPanel({ settings, playerCount, onChange }: Props) {
  const canAdd = canRaiseMinimums(settings.minPerRole, playerCount);
  const fullMessage = `Every player already has a required role (${playerCount} on the team).`;

  const setMin = (role: (typeof ROLES)[number], min: number) =>
    onChange({ ...settings, minPerRole: { ...settings.minPerRole, [role]: min } });

  return (
    <section className="panel">
      <h2 className="section-label">Rules</h2>
      <p className="panel-hint">Minimum per role</p>

      {/* Role minimums */}
      <ul className="rules">
        {ROLES.map((role) => {
          const min = settings.minPerRole[role];
          return (
            <li key={role} className={`rule ${role}`}>
              <label className="switch-row" title={min === 0 && !canAdd ? fullMessage : undefined}>
                <input
                  type="checkbox"
                  className="switch"
                  checked={min > 0}
                  disabled={min === 0 && !canAdd}
                  onChange={(e) => setMin(role, e.target.checked ? 1 : 0)}
                />
                <span className="role-name">{role}</span>
              </label>
              <div className="stepper" role="group" aria-label={`Minimum ${role}s`}>
                <button
                  type="button"
                  className="icon-btn small"
                  aria-label={`Fewer ${role}s`}
                  disabled={min <= 1}
                  onClick={() => setMin(role, min - 1)}
                >
                  <MinusIcon size={16} />
                </button>
                <span className="stepper-value" aria-live="polite">
                  {min > 0 ? min : "–"}
                </span>
                <button
                  type="button"
                  className="icon-btn small"
                  aria-label={`More ${role}s`}
                  title={min > 0 && !canAdd ? fullMessage : undefined}
                  disabled={min === 0 || !canAdd}
                  onClick={() => setMin(role, min + 1)}
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* History */}
      <label className="switch-row history-toggle">
        <input
          type="checkbox"
          className="switch"
          checked={settings.historyAware}
          onChange={(e) => onChange({ ...settings, historyAware: e.target.checked })}
        />
        <span>Avoid recent roles</span>
      </label>
    </section>
  );
}
