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

/**
 * Reads the saved rules back into Settings, or null if they aren't usable.
 *
 * Rules saved before maximums existed hold only minimums. They load with every maximum at
 * MAX_PLAYERS, which is no ceiling, so nobody loses a setting. Rules saved while roles had switches
 * load a role that was switched off at the full range, so a roll behaves as it did (the range it kept
 * was never applied).
 */
export function parseSettings(value: unknown): Settings | null {
  const s = value as (Partial<Settings> & { minPerRole?: Record<string, unknown>; ruleOn?: unknown }) | null;
  if (typeof s !== "object" || s === null || typeof s.historyAware !== "boolean") return null;
  const mins = s.minPerRole;
  const saved = s.maxPerRole as Record<string, unknown> | undefined;
  if (typeof mins !== "object" || mins === null) return null;
  if (saved !== undefined && (typeof saved !== "object" || saved === null)) return null;

  const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_PLAYERS;
  const savedOn = s.ruleOn as Record<string, unknown> | undefined;
  if (savedOn !== undefined && (typeof savedOn !== "object" || savedOn === null)) return null;
  const minPerRole = {} as Settings["minPerRole"];
  const maxPerRole = {} as Settings["maxPerRole"];
  for (const role of ROLES) {
    const min = mins[role];
    const max = saved === undefined ? MAX_PLAYERS : saved[role];
    if (!isCount(min) || !isCount(max) || min > max) return null;
    // 1. A role saved as off never limited anything, so it loads with no limit.
    // 2. Before the switches existed there were none, so every saved range was applied.
    const off = savedOn !== undefined && savedOn[role] === false;
    minPerRole[role] = off ? 0 : min;
    maxPerRole[role] = off ? MAX_PLAYERS : max;
  }
  // Saved before agents had their own switch: it follows the roles switch, so a roll behaves as it did.
  const agentHistoryAware = s.agentHistoryAware ?? s.historyAware;
  if (typeof agentHistoryAware !== "boolean") return null;
  return { minPerRole, maxPerRole, historyAware: s.historyAware, agentHistoryAware };
}
