import { describe, expect, it } from "vitest";
import {
  clearLastParty,
  clearSession,
  hasOpenedCreate,
  loadLastParty,
  loadSession,
  markOpenedCreate,
  saveLastParty,
  saveSession,
  startsOnEntry,
} from "./partySession";
import type { KeyValueStorage } from "./storage";

const memory = (): KeyValueStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("party session", () => {
  it("gives back what was saved", () => {
    const storage = memory();
    saveSession(storage, "K7QD", "Sam", 1000);
    expect(loadSession(storage, 2000)).toEqual({ code: "K7QD", name: "Sam", at: 1000 });
  });

  it("forgets a party after three hours", () => {
    const storage = memory();
    saveSession(storage, "K7QD", "Sam", 0);
    expect(loadSession(storage, 3 * 60 * 60 * 1000)).not.toBeNull();
    expect(loadSession(storage, 3 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("has nothing after it is cleared, or when nothing was saved", () => {
    const storage = memory();
    expect(loadSession(storage)).toBeNull();
    saveSession(storage, "K7QD", "Sam");
    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  it("keeps the last party separate, so leaving doesn't forget it", () => {
    const storage = memory();
    saveSession(storage, "K7QD", "Sam", 0);
    saveLastParty(storage, "K7QD", "Sam", 0);
    clearSession(storage);
    expect(loadSession(storage, 1)).toBeNull();
    expect(loadLastParty(storage, 1)).toEqual({ code: "K7QD", name: "Sam", at: 0 });
  });

  it("forgets the last party three hours after it was last used, or when it is cleared", () => {
    const storage = memory();
    saveLastParty(storage, "K7QD", "Sam", 0);
    expect(loadLastParty(storage, 3 * 60 * 60 * 1000)).not.toBeNull();
    expect(loadLastParty(storage, 3 * 60 * 60 * 1000 + 1)).toBeNull();
    saveLastParty(storage, "K7QD", "Sam", 5000);
    expect(loadLastParty(storage, 5001)).not.toBeNull();
    clearLastParty(storage);
    expect(loadLastParty(storage, 5001)).toBeNull();
  });

  it("treats damaged data as nothing", () => {
    const storage = memory();
    storage.setItem("valorant-randomizer-party-session", "{nope");
    expect(loadSession(storage)).toBeNull();
    storage.setItem("valorant-randomizer-party-session", JSON.stringify({ code: 4 }));
    expect(loadSession(storage)).toBeNull();
  });

  it("survives storage that throws", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveSession(broken, "K7QD", "Sam")).not.toThrow();
    expect(() => clearSession(broken)).not.toThrow();
    expect(loadSession(broken)).toBeNull();
  });
});

describe("first screen", () => {
  it("opens the entry page for a new device, and skips it for a party or earlier use of Create", () => {
    expect(startsOnEntry(false, false)).toBe(true);
    expect(startsOnEntry(true, false)).toBe(false);
    expect(startsOnEntry(false, true)).toBe(false);
    expect(startsOnEntry(true, true)).toBe(false);
  });

  it("remembers that Create was opened", () => {
    const storage = memory();
    expect(hasOpenedCreate(storage)).toBe(false);
    markOpenedCreate(storage);
    expect(hasOpenedCreate(storage)).toBe(true);
  });

  it("survives storage that throws", () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasOpenedCreate(broken)).toBe(false);
    expect(() => markOpenedCreate(broken)).not.toThrow();
  });
});
