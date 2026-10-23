import { describe, expect, it } from "vitest";
import { createLocalHistoryStore, recordRoll } from "./history";
import { HISTORY_LIMIT } from "./types";
import type { Assignment, History } from "./types";

const pick = (playerId: string, agent = "Sage"): Assignment => ({
  playerId,
  agent,
  role: "sentinel",
});

/** A stand-in for localStorage that keeps values in memory. */
const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

describe("recordRoll", () => {
  it("adds each rolled player's pick to their own list", () => {
    const next = recordRoll({}, [pick("a", "Sage"), pick("b", "Jett")]);
    expect(next.a.map((p) => p.agent)).toEqual(["Sage"]);
    expect(next.b.map((p) => p.agent)).toEqual(["Jett"]);
  });

  it("keeps only the newest picks once a player passes the limit", () => {
    let history: History = {};
    for (let i = 1; i <= HISTORY_LIMIT + 1; i++) {
      history = recordRoll(history, [pick("a", `Agent${i}`)]);
    }
    expect(history.a).toHaveLength(HISTORY_LIMIT);
    expect(history.a[0].agent).toBe("Agent2");
    expect(history.a.at(-1)?.agent).toBe(`Agent${HISTORY_LIMIT + 1}`);
  });

  it("leaves a player who sat out untouched, so they keep their last 10", () => {
    let history: History = {};
    for (let i = 0; i < HISTORY_LIMIT; i++) history = recordRoll(history, [pick("a"), pick("b")]);
    const before = history.b;
    for (let i = 0; i < 5; i++) history = recordRoll(history, [pick("a")]);
    expect(history.b).toEqual(before);
    expect(history.a).toHaveLength(HISTORY_LIMIT);
  });

  it("does not change the history it was given", () => {
    const original: History = { a: [pick("a")] };
    recordRoll(original, [pick("a")]);
    expect(original.a).toHaveLength(1);
  });
});

describe("createLocalHistoryStore", () => {
  it("returns empty history when nothing is saved", () => {
    expect(createLocalHistoryStore(fakeStorage()).load()).toEqual({});
  });

  it("loads what it saved", () => {
    const storage = fakeStorage();
    const store = createLocalHistoryStore(storage);
    const history: History = { a: [pick("a")] };
    store.save(history);
    expect(createLocalHistoryStore(storage).load()).toEqual(history);
  });

  it("starts fresh when the saved text is damaged", () => {
    const store = createLocalHistoryStore(fakeStorage({ "valorant-randomizer-history": "{not json" }));
    expect(store.load()).toEqual({});
  });

  it("starts fresh when the saved data has the wrong shape", () => {
    const bad = JSON.stringify({ a: [{ playerId: "a", agent: "Sage", role: "banana" }] });
    const store = createLocalHistoryStore(fakeStorage({ "valorant-randomizer-history": bad }));
    expect(store.load()).toEqual({});
  });

  it("does not throw when storage refuses to save", () => {
    const store = createLocalHistoryStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => store.save({})).not.toThrow();
  });
});
