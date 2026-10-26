import type { Player, Role, Roster, Settings, Teammate } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** A saved list of roles. A missing list (saved before role bans existed) counts as empty. */
function parseRoles(value: unknown): Role[] | null {
  if (value === undefined) return [];
  const known = ROLES as readonly string[];
  return Array.isArray(value) && value.every((role) => known.includes(role))
    ? (value as Role[])
    : null;
}

/** Reads the saved team back into Players, or null if it isn't usable. */
export function parsePlayers(value: unknown): Player[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const players: Player[] = [];
  // A team saved before the five player limit is trimmed to its first five.
  for (const p of value.slice(0, MAX_PLAYERS)) {
    const bannedRoles = parseRoles(p?.bannedRoles);
    if (
      typeof p?.id !== "string" ||
      typeof p.name !== "string" ||
      !isStringList(p.excludedAgents) ||
      bannedRoles === null
    ) {
      return null;
    }
    players.push({ id: p.id, name: p.name, excludedAgents: p.excludedAgents, bannedRoles });
  }
  return players;
}

/**
 * Reads the saved random teammates back, or null if the list isn't usable.
 *
 * At most four are kept, since the team always has at least one player of its own.
 */
export function parseTeammates(value: unknown): Teammate[] | null {
  if (!Array.isArray(value)) return null;
  const teammates: Teammate[] = [];
  for (const t of value.slice(0, MAX_PLAYERS - 1)) {
    if (typeof t?.id !== "string" || (t.agent !== null && typeof t.agent !== "string")) return null;
    teammates.push({ id: t.id, agent: t.agent });
  }
  return teammates;
}

/** Reads the saved players back into a Roster, or null if it isn't usable. */
export function parseRoster(value: unknown): Roster | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const roster: Roster = {};
  for (const [key, p] of Object.entries(value)) {
    const bannedRoles = parseRoles(p?.bannedRoles);
    if (typeof p?.name !== "string" || !isStringList(p.excludedAgents) || bannedRoles === null) {
      return null;
    }
    roster[key] = { name: p.name, excludedAgents: p.excludedAgents, bannedRoles };
  }
  return roster;
}

/** Reads the saved rules back into Settings, or null if they aren't usable. */
export function parseSettings(value: unknown): Settings | null {
  const s = value as Settings | null;
  const valid =
    typeof s === "object" &&
    s !== null &&
    typeof s.historyAware === "boolean" &&
    typeof s.minPerRole === "object" &&
    s.minPerRole !== null &&
    ROLES.every((role) => Number.isInteger(s.minPerRole[role]) && s.minPerRole[role] >= 0);
  return valid ? s : null;
}
