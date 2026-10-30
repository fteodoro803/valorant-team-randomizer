import type { Settings } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

/**
 * The limits a role can be given, kept apart from the roll so the Rules panel and the page share them.
 *
 * Minimums are not limited by the team size: a roll fills as many required roles as the team can
 * hold (D39). Maximums are, because a ceiling can't be stretched. Together they must leave room
 * for everyone, so the maximums have to add up to at least the team.
 *
 * A role with no limit has the full range, 0 to MAX_PLAYERS. There is no switch to pause a range.
 */

type Rules = Pick<Settings, "minPerRole" | "maxPerRole">;

/** How many players the role maximums add up to. */
export const totalMaximums = (maxPerRole: Settings["maxPerRole"]): number =>
  ROLES.reduce((sum, role) => sum + maxPerRole[role], 0);

/**
 * Raises the maximums until they leave room for the whole team, one at a time from the role with the
 * lowest maximum. A tie raises the earlier role in the list first. Returns a new object, unchanged
 * if it already fits.
 */
export function fitMaximums(settings: Rules, playerCount: number): Settings["maxPerRole"] {
  const next = { ...settings.maxPerRole };
  while (totalMaximums(next) < playerCount) {
    const raisable = ROLES.filter((role) => next[role] < MAX_PLAYERS);
    if (raisable.length === 0) break;
    const lowest = raisable.reduce((best, role) => (next[role] < next[best] ? role : best), raisable[0]);
    next[lowest] += 1;
  }
  return next;
}

/**
 * The lowest a role's maximum can go: not below its minimum, and not so low that the maximums
 * stop leaving room for the team.
 */
export function lowestMaximum(settings: Rules, role: (typeof ROLES)[number], playerCount: number): number {
  const spare = Math.max(0, totalMaximums(settings.maxPerRole) - playerCount);
  return Math.max(settings.minPerRole[role], settings.maxPerRole[role] - spare);
}

/** Whether a range is the full one, 0 to the team limit, which asks for nothing. */
export const isFullRange = (min: number, max: number): boolean => min === 0 && max >= MAX_PLAYERS;

/** Roles in a count, "1 duelist" or "3 duelists". */
const count = (n: number, role: string): string => `${n} ${role}${n === 1 ? "" : "s"}`;

/**
 * A role's range in words, for the sentence under the rows.
 *
 * "Any" is the full range. The wording says what the numbers mean for a team: "3 or more" rather
 * than "3–5", since five is only the most a team can hold.
 */
export function describeRange(min: number, max: number): string {
  if (isFullRange(min, max)) return "Any";
  if (max === 0) return "None";
  if (min === max) return `Exactly ${min}`;
  if (min === 0) return `Up to ${max}`;
  if (max >= MAX_PLAYERS) return `${min} or more`;
  return `${min} to ${max}`;
}

/**
 * The rules as a short sentence about the team, one clause per role that has a rule, in role order.
 * A role at the full range has no clause. It says nothing when the minimums ask for more than the
 * team can hold, although a roll then fills as many as it can (D39, D-new2).
 */
export function describeRules(settings: Rules): string {
  const clauses: string[] = [];
  let someFree = false;
  for (const role of ROLES) {
    const min = settings.minPerRole[role];
    const max = settings.maxPerRole[role];
    if (isFullRange(min, max)) {
      someFree = true;
    } else if (max === 0) {
      clauses.push(`No ${role}s.`);
    } else if (min === max) {
      clauses.push(`Exactly ${count(min, role)}.`);
    } else if (min > 0 && max < MAX_PLAYERS) {
      clauses.push(`${min} to ${count(max, role)}.`);
    } else if (min > 0) {
      clauses.push(`At least ${count(min, role)}.`);
    } else {
      clauses.push(`At most ${count(max, role)}.`);
    }
  }
  if (clauses.length === 0) return "No rules. Any mix of roles.";
  if (someFree) clauses.push("Any mix for the rest.");
  return clauses.join(" ");
}
