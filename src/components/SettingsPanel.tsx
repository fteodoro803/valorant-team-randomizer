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
 * A role's switch turns its range on or off and never changes the range, so switching a role off and
 * on again gives back what was set. An off role is greyed out and the roll ignores it (D39).
 * Minimums can be any size, since a roll fills as many required roles as the team can hold, but the
 * maximum handle stops where the maximums would stop leaving room for the team.
 *
 * On a desktop the panel is two halves, the rules on the left and `aside` centred in the right half (D38).
 */
export function SettingsPanel({ settings, playerCount, onChange, aside }: Props) {
  const setRuleOn = (role: (typeof ROLES)[number], on: boolean) =>
    onChange({ ...settings, ruleOn: { ...settings.ruleOn, [role]: on } });

  const setRange = (role: (typeof ROLES)[number], min: number, max: number) =>
    onChange({
      ...settings,
      minPerRole: { ...settings.minPerRole, [role]: min },
      maxPerRole: { ...settings.maxPerRole, [role]: max },
    });

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
            <li key={role} className={`rule ${role}${settings.ruleOn[role] ? "" : " is-off"}`}>
              <label className="switch-row">
                <input
                  type="checkbox"
                  className="switch small"
                  checked={settings.ruleOn[role]}
                  onChange={(e) => setRuleOn(role, e.target.checked)}
                />
                <span className="role-name">{role}</span>
              </label>
              <RoleRange
                label={role}
                min={min}
                max={max}
                lowestMax={lowestMaximum(settings, role, playerCount)}
                disabled={!settings.ruleOn[role]}
                onChange={(nextMin, nextMax) => setRange(role, nextMin, nextMax)}
              />
            </li>
          );
        })}
      </ul>

      {/* What the rules mean for the team */}
      <p className="rules-summary">{describeRules(settings, playerCount)}</p>

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
      </div>
      {aside && <div className="rules-aside">{aside}</div>}
    </section>
  );
}
