import type { Settings } from "./types";
import { ROLES } from "./types";

/** How many players the role minimums add up to. */
export const totalMinimums = (minPerRole: Settings["minPerRole"]): number =>
  ROLES.reduce((sum, role) => sum + minPerRole[role], 0);

/**
 * Lowers the minimums until they fit the team, one at a time from the role
 * with the largest minimum. A tie drops the later role in the list first.
 * Returns a new object, unchanged if it already fits.
 */
export function fitMinimums(
  minPerRole: Settings["minPerRole"],
  playerCount: number,
): Settings["minPerRole"] {
  const next = { ...minPerRole };
  while (totalMinimums(next) > playerCount) {
    const biggest = ROLES.reduce((best, role) => (next[role] >= next[best] ? role : best), ROLES[0]);
    next[biggest] -= 1;
  }
  return next;
}

/** Whether one more player can be required in some role without outgrowing the team. */
export const canRaiseMinimums = (minPerRole: Settings["minPerRole"], playerCount: number): boolean =>
  totalMinimums(minPerRole) < playerCount;
