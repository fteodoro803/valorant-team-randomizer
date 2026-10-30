import type { Settings } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

/**
 * The limits a role can be given, kept apart from the roll so the Rules panel and the page share them.
 *
 * Minimums are not limited by the team size: a roll fills as many required roles as the team can
 * hold (D-new1). Maximums are, because a ceiling can't be stretched. Together they must leave room
 * for everyone, so the maximums have to add up to at least the team.
 *
 * A role's switch decides whether its range applies. Everything here that decides what a roll will do
 * reads the ranges through `activeRules`, so a role that is off never limits anything.
 */

type Ranges = Pick<Settings, "minPerRole" | "maxPerRole">;
type Rules = Ranges & Pick<Settings, "ruleOn">;

/** The ranges a roll should use: a role that is switched off has no rule, whatever range it keeps. */
export function activeRules(settings: Rules): Ranges {
  const minPerRole = {} as Settings["minPerRole"];
  const maxPerRole = {} as Settings["maxPerRole"];
  for (const role of ROLES) {
    minPerRole[role] = settings.ruleOn[role] ? settings.minPerRole[role] : 0;
    maxPerRole[role] = settings.ruleOn[role] ? settings.maxPerRole[role] : MAX_PLAYERS;
  }
  return { minPerRole, maxPerRole };
}

/** How many players the role maximums add up to. */
export const totalMaximums = (maxPerRole: Settings["maxPerRole"]): number =>
  ROLES.reduce((sum, role) => sum + maxPerRole[role], 0);

/**
 * Raises the maximums of the roles that are on until they leave room for the whole team, one at a
 * time from the role with the lowest maximum. A tie raises the earlier role in the list first. A role
 * that is off can hold anyone, so it is never raised, and when one is off nothing needs raising.
 * Returns a new object, unchanged if it already fits.
 */
export function fitMaximums(settings: Rules, playerCount: number): Settings["maxPerRole"] {
  const next = { ...settings.maxPerRole };
  const roomFor = () => totalMaximums(activeRules({ ...settings, maxPerRole: next }).maxPerRole);
  while (roomFor() < playerCount) {
    const raisable = ROLES.filter((role) => settings.ruleOn[role] && next[role] < MAX_PLAYERS);
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
  const spare = Math.max(0, totalMaximums(activeRules(settings).maxPerRole) - playerCount);
  return Math.max(settings.minPerRole[role], settings.maxPerRole[role] - spare);
}

/** Whether a range is the full one, 0 to the team limit, which asks for nothing. */
export const isFullRange = (min: number, max: number): boolean => min === 0 && max >= MAX_PLAYERS;

/** Roles in a count, "1 duelist" or "3 duelists". */
const count = (n: number, role: string): string => `${n} ${role}${n === 1 ? "" : "s"}`;

/**
 * A role's range in words, for the readout beside its track.
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
 * A role that is switched off, or on at the full range, has no clause.
 *
 * Says when the minimums ask for more than the team can hold, since the roll then fills as many as it
 * can and the sentence is where that is explained (D-new1).
 */
export function describeRules(settings: Rules, playerCount: number): string {
  const active = activeRules(settings);
  const clauses: string[] = [];
  let someFree = false;
  for (const role of ROLES) {
    const min = active.minPerRole[role];
    const max = active.maxPerRole[role];
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
  const asked = ROLES.reduce((sum, role) => sum + active.minPerRole[role], 0);
  if (asked > playerCount) {
    clauses.push(`The minimums ask for ${asked} and the team holds ${playerCount}, so each roll picks which.`);
  }
  return clauses.join(" ");
}
