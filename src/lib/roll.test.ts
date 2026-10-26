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

const player = (id: string, excludedAgents: string[] = [], bannedRoles: Role[] = []): Player => ({
  id,
  name: id,
  excludedAgents,
  bannedRoles,
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

  it("never gives a player a role they banned", () => {
    const players = [player("a", [], ["sentinel", "duelist"]), ...team.slice(1)];
    for (let seed = 0; seed < 300; seed++) {
      const comp = rollComp(players, settings(), {}, seeded(seed));
      expect(["sentinel", "duelist"]).not.toContain(comp[0].role);
    }
  });

  it("still meets the minimums when some players have banned roles", () => {
    const players = [
      player("a", [], ["controller"]),
      player("b", [], ["controller"]),
      player("c", [], ["controller"]),
      player("d", [], ["controller"]),
      player("e"),
    ];
    for (let seed = 0; seed < 100; seed++) {
      const comp = rollComp(players, settings({ controller: 1 }), {}, seeded(seed));
      expect(comp[4].role).toBe("controller");
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

  it("hands a required role to whoever has had it least, when history is on", () => {
    const controllerHeavy: Assignment[] = Array.from({ length: 10 }, () => ({
      playerId: "a",
      agent: "Omen",
      role: "controller",
    }));
    const history: History = { a: controllerHeavy };
    const rate = (historyAware: boolean) => {
      let hits = 0;
      for (let seed = 0; seed < 2000; seed++) {
        const comp = rollComp(team, settings({ controller: 1 }, historyAware), history, seeded(seed));
        if (comp[0].role === "controller") hits++;
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

    it("rejects a required role that every player has banned, naming the role", () => {
      const players = team.map((p) => player(p.id, [], ["controller"]));
      expect(() => rollComp(players, settings({ controller: 1 }), {}, seeded(1))).toThrow(
        /controller/i,
      );
    });

    it("rejects a player who has banned every role", () => {
      const players = [player("a", [], ["duelist", "initiator", "controller", "sentinel"]), ...team.slice(1)];
      expect(() => rollComp(players, settings(), {}, seeded(1))).toThrow(/a has banned/i);
    });

    it("rejects a team of more than five players", () => {
      const six = Array.from({ length: 6 }, (_, i) => player(`p${i}`));
      expect(() => rollComp(six, settings(), {}, seeded(1))).toThrow(/at most 5/);
    });

    it("rejects more players than agents when a small pool is used", () => {
      const tinyPool = AGENTS.slice(0, 3);
      expect(() => rollComp(team, settings(), {}, seeded(1), tinyPool)).toThrow(RollError);
    });

    it("rejects a negative or fractional minimum", () => {
      expect(() => rollComp(team, settings({ duelist: -1 }), {}, seeded(1))).toThrow(RollError);
      expect(() => rollComp(team, settings({ duelist: 1.5 }), {}, seeded(1))).toThrow(RollError);
    });

    it("rejects an empty team", () => {
      expect(() => rollComp([], settings(), {}, seeded(1))).toThrow(RollError);
    });
  });

  describe("rerolling with some players locked", () => {
    const first = (seed: number, min: Partial<Record<Role, number>> = {}) =>
      rollComp(team, settings(min), {}, seeded(seed));

    it("keeps the locked picks exactly, and still returns the team in order", () => {
      for (let seed = 0; seed < 100; seed++) {
        const current = first(seed);
        const comp = rollComp(team, settings(), {}, seeded(seed + 1000), AGENTS, {
          current,
          keptIds: ["a", "c"],
        });
        expect(comp.map((p) => p.playerId)).toEqual(["a", "b", "c", "d", "e"]);
        expect(comp[0]).toEqual(current[0]);
        expect(comp[2]).toEqual(current[2]);
        expect(new Set(comp.map((p) => p.agent)).size).toBe(5);
      }
    });

    it("gives each rerolled player a different agent from the one they had", () => {
      for (let seed = 0; seed < 100; seed++) {
        const current = first(seed);
        const comp = rollComp(team, settings(), {}, seeded(seed + 1000), AGENTS, {
          current,
          keptIds: ["a"],
        });
        for (const i of [1, 2, 3, 4]) expect(comp[i].agent).not.toBe(current[i].agent);
      }
    });

    it("counts the locked picks toward the role minimums", () => {
      const min = { duelist: 1, initiator: 1, controller: 1, sentinel: 1 };
      for (let seed = 0; seed < 100; seed++) {
        const current = first(seed, min);
        const comp = rollComp(team, settings(min), {}, seeded(seed + 1000), AGENTS, {
          current,
          keptIds: ["a", "b"],
        });
        for (const role of Object.keys(min) as Role[]) expect(countRole(comp, role)).toBeGreaterThanOrEqual(1);
      }
    });

    it("rolls a player who joined after the comp was made", () => {
      const current = first(3).slice(0, 4);
      const comp = rollComp(team, settings(), {}, seeded(9), AGENTS, { current, keptIds: ["a", "b", "c", "d"] });
      expect(comp).toHaveLength(5);
      expect(comp.slice(0, 4)).toEqual(current);
    });

    it("refuses when everyone is locked", () => {
      const current = first(1);
      expect(() =>
        rollComp(team, settings(), {}, seeded(1), AGENTS, { current, keptIds: ["a", "b", "c", "d", "e"] }),
      ).toThrow(RollError);
    });

    it("fails with the usual error when the locked picks leave no valid comp", () => {
      const current: Assignment[] = [
        { playerId: "a", agent: "Jett", role: "duelist" },
        { playerId: "b", agent: "Sage", role: "sentinel" },
      ];
      const two = [player("a"), player("b"), player("c", [], ["controller", "initiator", "sentinel"])];
      const needsController = settings({ controller: 1 });
      expect(() =>
        rollComp(two, needsController, {}, seeded(1), AGENTS, { current, keptIds: ["a", "b"] }),
      ).toThrow(RollError);
    });
  });

  describe("with random teammates who already picked", () => {
    const ours = [player("a"), player("b"), player("c")];
    const taken: Assignment[] = [
      { playerId: "t1", agent: "Jett", role: "duelist" },
      { playerId: "t2", agent: "Sage", role: "sentinel" },
    ];

    it("rolls only our players and never gives a taken agent", () => {
      for (let seed = 0; seed < 200; seed++) {
        const comp = rollComp(ours, settings(), {}, seeded(seed), AGENTS, undefined, taken);
        expect(comp.map((p) => p.playerId)).toEqual(["a", "b", "c"]);
        expect(comp.map((p) => p.agent)).not.toContain("Jett");
        expect(comp.map((p) => p.agent)).not.toContain("Sage");
        expect(new Set(comp.map((p) => p.agent)).size).toBe(3);
      }
    });

    it("counts the taken roles toward the minimums", () => {
      // The teammates already cover a duelist and a sentinel, so our three only owe the other two roles.
      const min = { duelist: 1, initiator: 1, controller: 1, sentinel: 1 };
      for (let seed = 0; seed < 100; seed++) {
        const comp = rollComp(ours, settings(min), {}, seeded(seed), AGENTS, undefined, taken);
        const all = [...comp, ...taken];
        for (const role of Object.keys(min) as Role[]) expect(countRole(all, role)).toBeGreaterThanOrEqual(1);
      }
    });

    it("drops a locked pick that clashes with a taken agent, so that player is rolled again", () => {
      const current: Assignment[] = [
        { playerId: "a", agent: "Jett", role: "duelist" },
        { playerId: "b", agent: "Fade", role: "initiator" },
        { playerId: "c", agent: "Omen", role: "controller" },
      ];
      for (let seed = 0; seed < 100; seed++) {
        const comp = rollComp(ours, settings(), {}, seeded(seed), AGENTS, { current, keptIds: ["a", "b"] }, taken);
        expect(comp[0].agent).not.toBe("Jett");
        expect(comp[1]).toEqual(current[1]);
      }
    });

    it("fails with the usual error when the taken agents leave no valid comp", () => {
      const noDuelists = [player("a", [], ["initiator", "controller", "sentinel"])];
      const everyDuelist = AGENTS.filter((a) => a.role === "duelist").map((a, i) => ({
        playerId: `t${i}`,
        agent: a.name,
        role: a.role,
      }));
      expect(() => rollComp(noDuelists, settings(), {}, seeded(1), AGENTS, undefined, everyDuelist)).toThrow(RollError);
    });
  });
});
