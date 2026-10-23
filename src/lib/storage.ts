/** The slice of localStorage the app uses. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * The browser's localStorage, or an in-memory stand-in if it can't be used.
 *
 * Some browsers throw just for touching localStorage (private windows, blocked
 * site data). The stand-in keeps the app working, it just forgets on reload.
 */
export function browserStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage;
    storage.getItem("valorant-randomizer-probe");
    return storage;
  } catch {
    const data = new Map<string, string>();
    return {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    };
  }
}
