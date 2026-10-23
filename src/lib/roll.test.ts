import { describe, expect, it } from "vitest";
import { AGENTS } from "../data/agents";
import { RollError, rollComp } from "./roll";
import type { Assignment, History, Player, Role, Settings } from "./types";

/** Seeded random numbers, so a failing roll can be replayed. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const player = (id: string, excludedAgents: string[] = []): Player => ({
  id,
  name: id,
  excludedAgents,
});
const team = ["a", "b", "c", "d", "e"].map((id) => player(id));

const settings = (min: Partial<Record<Role, number>> = {}, historyAware = false): Settings => ({
  minPerRole: { duelist: 0, initiator: 0, controller: 0, sentinel: 0, ...min },
  historyAware,
});

const countRole = (comp: Assignment[], role: Role) => comp.filter((a) => a.role === role).length;

describe("rollComp", () => {
  it("gives every player exactly one agent, and no agent twice", () => {
    for (let seed = 0; seed < 200; seed++) {
      const comp = rollComp(team, settings(), {}, seeded(seed));
      expect(comp.map((a) => a.playerId)).toEqual(["a", "b", "c", "d", "e"]);
      expect(new Set(comp.map((a) => a.agent)).size).toBe(5);
    }
  });

  it("reports the role that belongs to each agent", () => {
    const comp = rollComp(team, settings(), {}, seeded(1));
    for (const a of comp) {
      expect(AGENTS.find((agent) => agent.name === a.agent)?.role).toBe(a.role);
    }
  });

  it("meets every role minimum", () => {
    const min = { duelist: 1, initiator: 1, controller: 1, sentinel: 1 };
    for (let seed = 0; seed < 200; seed++) {
      const comp = rollComp(team, settings(min), {}, seeded(seed));
      for (const role of Object.keys(min) as Role[]) {
        expect(countRole(comp, role)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("allows a minimum above one", () => {
    for (let seed = 0; seed < 100; seed++) {
      const comp = rollComp(team, settings({ controller: 2 }), {}, seeded(seed));
      expect(countRole(comp, "controller")).toBeGreaterThanOrEqual(2);
    }
  });

  it("never gives a player an agent on their excluded list", () => {
    const excluded = AGENTS.slice(0, 20).map((a) => a.name);
    const players = [player("a", excluded), ...team.slice(1)];
    for (let seed = 0; seed < 200; seed++) {
      const comp = rollComp(players, settings(), {}, seeded(seed));
      expect(excluded).not.toContain(comp[0].agent);
    }
  });

  it("makes a role less likely for a player who has had it a lot, when history is on", () => {
    const sentinelHeavy: Assignment[] = Array.from({ length: 10 }, () => ({
      playerId: "a",
      agent: "Sage",
      role: "sentinel",
    }));
    const history: History = { a: sentinelHeavy };
    const rate = (historyAware: boolean) => {
      let hits = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const comp = rollComp(team, settings({}, historyAware), history, seeded(seed));
        if (comp[0].role === "sentinel") hits++;
      }
      return hits / 2000;
    };
    expect(rate(true)).toBeLessThan(rate(false) / 2);
  });

  it("ignores history when the toggle is off", () => {
    const history: History = {
      a: Array.from({ length: 10 }, () => ({ playerId: "a", agent: "Sage", role: "sentinel" as Role })),
    };
    const withHistory = rollComp(team, settings({}, false), history, seeded(7));
    const without = rollComp(team, settings({}, false), {}, seeded(7));
    expect(withHistory).toEqual(without);
  });

  it("still meets a minimum when history says to avoid that role", () => {
    const history: History = Object.fromEntries(
      team.map((p) => [
        p.id,
        Array.from({ length: 10 }, () => ({ playerId: p.id, agent: "Sage", role: "sentinel" as Role })),
      ]),
    );
    for (let seed = 0; seed < 100; seed++) {
      const comp = rollComp(team, settings({ sentinel: 2 }, true), history, seeded(seed));
      expect(countRole(comp, "sentinel")).toBeGreaterThanOrEqual(2);
    }
  });

  describe("impossible settings", () => {
    it("rejects minimums that need more slots than there are players", () => {
      const min = { duelist: 3, initiator: 1, controller: 1, sentinel: 1 };
      expect(() => rollComp(team, settings(min), {}, seeded(1))).toThrow(RollError);
    });

    it("rejects a role no player is willing to play", () => {
      const noControllers = AGENTS.filter((a) => a.role === "controller").map((a) => a.name);
      const players = team.map((p) => player(p.id, noControllers));
      expect(() => rollComp(players, settings({ controller: 1 }), {}, seeded(1))).toThrow(
        /controller/i,
      );
    });

    it("rejects more players than agents", () => {
      const many = Array.from({ length: 30 }, (_, i) => player(`p${i}`));
      expect(() => rollComp(many, settings(), {}, seeded(1))).toThrow(RollError);
    });

    it("rejects a negative or fractional minimum", () => {
      expect(() => rollComp(team, settings({ duelist: -1 }), {}, seeded(1))).toThrow(RollError);
      expect(() => rollComp(team, settings({ duelist: 1.5 }), {}, seeded(1))).toThrow(RollError);
    });

    it("rejects an empty team", () => {
      expect(() => rollComp([], settings(), {}, seeded(1))).toThrow(RollError);
    });
  });
});
