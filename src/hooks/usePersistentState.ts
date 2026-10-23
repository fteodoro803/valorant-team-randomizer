import { useState } from "react";
import type { KeyValueStorage } from "../lib/storage";

/**
 * useState that remembers its value in storage between visits.
 *
 * `parse` checks what was saved and returns it (filling in anything an older
 * version didn't save), or null if it can't be used, in which case `initial`
 * is used instead. Damaged data and storage errors can't break the page.
 */
export function usePersistentState<T>(
  storage: KeyValueStorage,
  key: string,
  initial: T,
  parse: (value: unknown) => T | null,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return initial;
      return parse(JSON.parse(raw)) ?? initial;
    } catch {
      return initial;
    }
  });

  const update = (next: T) => {
    setValue(next);
    try {
      storage.setItem(key, JSON.stringify(next));
    } catch {
      // Remembering is a convenience, so a failed save shouldn't stop the page.
    }
  };

  return [value, update];
}
