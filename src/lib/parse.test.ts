import { describe, expect, it } from "vitest";
import { parsePlayers, parseRoster, parseSettings, parseTeammates } from "./parse";

describe("parsePlayers", () => {
  it("fills in an empty role ban list for players saved before role bans existed", () => {
    const saved = [{ id: "a", name: "Alex", excludedAgents: ["Sage"] }];
    expect(parsePlayers(saved)).toEqual([
      { id: "a", name: "Alex", excludedAgents: ["Sage"], bannedRoles: [] },
    ]);
  });

  it("keeps saved role bans", () => {
    const saved = [{ id: "a", name: "Alex", excludedAgents: [], bannedRoles: ["sentinel"] }];
    expect(parsePlayers(saved)?.[0].bannedRoles).toEqual(["sentinel"]);
  });

  it("trims a saved team of more than five to its first five", () => {
    const saved = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, excludedAgents: [] }));
    expect(parsePlayers(saved)?.map((p) => p.id)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
  });

  it("rejects an unknown role, a missing name and an empty team", () => {
    expect(parsePlayers([{ id: "a", name: "A", excludedAgents: [], bannedRoles: ["banana"] }])).toBeNull();
    expect(parsePlayers([{ id: "a", excludedAgents: [] }])).toBeNull();
    expect(parsePlayers([])).toBeNull();
    expect(parsePlayers("nope")).toBeNull();
  });
});

describe("parseRoster", () => {
  it("fills in an empty role ban list for people saved before role bans existed", () => {
    const saved = { "name:alex": { name: "Alex", excludedAgents: [] } };
    expect(parseRoster(saved)).toEqual({
      "name:alex": { name: "Alex", excludedAgents: [], bannedRoles: [] },
    });
  });

  it("rejects the wrong shape", () => {
    expect(parseRoster([])).toBeNull();
    expect(parseRoster({ x: { name: 1, excludedAgents: [] } })).toBeNull();
  });
});

describe("parseSettings", () => {
  const good = {
    historyAware: true,
    minPerRole: { duelist: 1, initiator: 0, controller: 0, sentinel: 0 },
    maxPerRole: { duelist: 3, initiator: 5, controller: 5, sentinel: 1 },
    ruleOn: { duelist: true, initiator: false, controller: false, sentinel: true },
  };

  it("accepts good settings and rejects bad ones", () => {
    expect(parseSettings(good)).toEqual(good);
    expect(parseSettings({ ...good, historyAware: "yes" })).toBeNull();
    expect(parseSettings(null)).toBeNull();
  });

  it("loads settings saved before maximums existed with no ceiling", () => {
    const { maxPerRole: _, ruleOn: __, ...old } = good;
    expect(parseSettings(old)).toEqual({
      ...good,
      maxPerRole: { duelist: 5, initiator: 5, controller: 5, sentinel: 5 },
      ruleOn: { duelist: true, initiator: false, controller: false, sentinel: false },
    });
  });

  it("loads settings saved before the switches came back with a role on when its range is narrower", () => {
    const { ruleOn: _, ...old } = good;
    expect(parseSettings(old)?.ruleOn).toEqual({ duelist: true, initiator: false, controller: false, sentinel: true });
  });

  it("rejects a switch that is not true or false", () => {
    expect(parseSettings({ ...good, ruleOn: { ...good.ruleOn, duelist: "yes" } })).toBeNull();
  });

  it("rejects a minimum above its maximum, or a maximum above the team limit", () => {
    expect(parseSettings({ ...good, maxPerRole: { ...good.maxPerRole, duelist: 0 } })).toBeNull();
    expect(parseSettings({ ...good, maxPerRole: { ...good.maxPerRole, sentinel: 6 } })).toBeNull();
    expect(parseSettings({ ...good, maxPerRole: { ...good.maxPerRole, sentinel: 1.5 } })).toBeNull();
  });
});

describe("parseTeammates", () => {
  it("reads teammates with and without an agent", () => {
    const saved = [{ id: "a", agent: "Jett" }, { id: "b", agent: null }];
    expect(parseTeammates(saved)).toEqual(saved);
  });

  it("accepts an empty list", () => {
    expect(parseTeammates([])).toEqual([]);
  });

  it("keeps at most four, since the team always has a player of its own", () => {
    const saved = Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, agent: null }));
    expect(parseTeammates(saved)?.map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3"]);
  });

  it("rejects something that is not a list, a missing id and an agent that is not a name", () => {
    expect(parseTeammates({})).toBeNull();
    expect(parseTeammates([{ agent: "Jett" }])).toBeNull();
    expect(parseTeammates([{ id: "a", agent: 4 }])).toBeNull();
  });
});
