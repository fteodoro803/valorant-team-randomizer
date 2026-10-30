import type { ReactNode } from "react";
import { describeRules, lowestMaximum } from "../lib/minimums";
import type { Settings } from "../lib/types";
import { ROLES } from "../lib/types";
import { RoleRange } from "./RoleRange";

interface Props {
  settings: Settings;
  /** How many players are on the team, which the maximums have to leave room for. */
  playerCount: number;
  onChange: (settings: Settings) => void;
  /** Shown in the panel's right half on a desktop, centred there. The page puts Roll and Lock in here. */
  aside?: ReactNode;
}

/**
 * The roll's rules: a range for each role (the least and most players it may have), a sentence saying
 * what they mean for the team, and whether history counts.
 *
 * A role at the full range, 0 to 5, has no rule, and setting its most to 0 leaves it out (D39).
 * Minimums can be any size, since a roll fills as many required roles as the team can hold, but the
 * maximum stepper stops where the maximums would stop leaving room for the team.
 *
 * On a desktop the panel is two halves, the rules on the left and `aside` centred in the right half (D38).
 */
export function SettingsPanel({ settings, playerCount, onChange, aside }: Props) {
  const setRange = (role: (typeof ROLES)[number], min: number, max: number) =>
    onChange({
      ...settings,
      minPerRole: { ...settings.minPerRole, [role]: min },
      maxPerRole: { ...settings.maxPerRole, [role]: max },
    });

  const historyToggles = (
    <>
      <label className="switch-row">
        <input
          type="checkbox"
          className="switch"
          checked={settings.historyAware}
          onChange={(e) => onChange({ ...settings, historyAware: e.target.checked })}
        />
        <span>Avoid recent roles</span>
      </label>
      <label className="switch-row">
        <input
          type="checkbox"
          className="switch"
          checked={settings.agentHistoryAware}
          onChange={(e) => onChange({ ...settings, agentHistoryAware: e.target.checked })}
        />
        <span>Avoid recent agents</span>
      </label>
    </>
  );

  return (
    <section className="panel rules-panel">
      <div className="rules-main">
      <h2 className="section-label">Rules</h2>

      {/* Role ranges */}
      <ul className="rules">
        {ROLES.map((role) => {
          const min = settings.minPerRole[role];
          const max = settings.maxPerRole[role];
          return (
            <li key={role} className={`rule ${role}`}>
              <span className="role-name">{role}</span>
              <RoleRange
                label={role}
                min={min}
                max={max}
                lowestMax={lowestMaximum(settings, role, playerCount)}
                onChange={(nextMin, nextMax) => setRange(role, nextMin, nextMax)}
              />
            </li>
          );
        })}
      </ul>

      {/* What the rules mean for the team */}
      <p className="rules-summary">{describeRules(settings)}</p>

      {/* History: here under the rules, and on a desktop above Roll instead */}
      <div className="history-main">{historyToggles}</div>
      </div>
      {/* Desktop only: the history switches stacked above Roll and Lock in (D-new2) */}
      <div className="rules-aside">
        <div className="rules-aside-inner">
          <div className="history-aside">{historyToggles}</div>
          {aside}
        </div>
      </div>
    </section>
  );
}
