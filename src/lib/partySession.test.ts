import { describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession } from "./partySession";
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
