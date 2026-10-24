import type { KeyValueStorage } from "./storage";

/** Where the party a device is in is remembered, so it can rejoin after a sleep or a refresh. */
const KEY = "valorant-randomizer-party-session";

/** A remembered party is forgotten after this long, so an old code isn't tried days later. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface PartySession {
  code: string;
  name: string;
  /** When it was saved, in milliseconds. */
  at: number;
}

/** The party this device was last in, or null if there is none or it is too old to trust. */
export function loadSession(storage: KeyValueStorage, now: number = Date.now()): PartySession | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    const valid =
      typeof value?.code === "string" && typeof value.name === "string" && typeof value.at === "number";
    return valid && now - value.at <= MAX_AGE_MS ? value : null;
  } catch {
    return null;
  }
}

/** Remembers the party this device is in. A failed save is ignored, since rejoining is a convenience. */
export function saveSession(storage: KeyValueStorage, code: string, name: string, now: number = Date.now()) {
  try {
    storage.setItem(KEY, JSON.stringify({ code, name, at: now } satisfies PartySession));
  } catch {
    // Not remembering just means a friend types the code again.
  }
}

/** Forgets the party, for when the friend leaves on purpose or the party is gone. */
export function clearSession(storage: KeyValueStorage) {
  try {
    storage.setItem(KEY, "");
  } catch {
    // Nothing to clear if nothing could be saved.
  }
}
