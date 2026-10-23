import type { Assignment, History } from "./types";
import { HISTORY_LIMIT, ROLES } from "./types";

/**
 * Where history is kept. Everything else talks to this, never to
 * localStorage directly, so the storage can change later (D3).
 */
export interface HistoryStore {
  load(): History;
  save(history: History): void;
}

const STORAGE_KEY = "valorant-randomizer-history";

/**
 * Adds a roll to history, keeping each player's newest `limit` picks.
 *
 * Players who weren't in the roll are left alone, so someone who sits out a
 * few games still has their own last 10. Returns a new object.
 */
export function recordRoll(
  history: History,
  comp: Assignment[],
  limit: number = HISTORY_LIMIT,
): History {
  const next: History = { ...history };
  for (const pick of comp) {
    next[pick.playerId] = [...(next[pick.playerId] ?? []), pick].slice(-limit);
  }
  return next;
}

/**
 * History stored under one key in a localStorage-style object.
 *
 * Reads and writes never throw: damaged or unexpected data loads as empty
 * history, and a failed save (private window, full storage) is ignored.
 */
export function createLocalHistoryStore(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string = STORAGE_KEY,
): HistoryStore {
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (raw === null) return {};
        const parsed: unknown = JSON.parse(raw);
        return isHistory(parsed) ? parsed : {};
      } catch {
        return {};
      }
    },
    save(history) {
      try {
        storage.setItem(key, JSON.stringify(history));
      } catch {
        // History is a convenience, so losing a save shouldn't break rolling.
      }
    },
  };
}

function isHistory(value: unknown): value is History {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (picks) =>
      Array.isArray(picks) &&
      picks.every(
        (p) =>
          typeof p === "object" &&
          p !== null &&
          typeof p.playerId === "string" &&
          typeof p.agent === "string" &&
          (ROLES as readonly string[]).includes(p.role),
      ),
  );
}
