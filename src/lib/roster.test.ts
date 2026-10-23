import { describe, expect, it } from "vitest";
import {
  addSavedToTeam,
  findDuplicateName,
  findSaved,
  forgetPlayer,
  isNamedKey,
  keepNamedHistory,
  keyForName,
  playerKey,
  rememberPlayers,
  removeFromTeam,
  toRollPlayers,
} from "./roster";
import type { Assignment, History, Player, Role, Roster } from "./types";

const player = (
  id: string,
  name: string,
  excludedAgents: string[] = [],
  bannedRoles: Role[] = [],
): Player => ({
  id,
  name,
  excludedAgents,
  bannedRoles,
});

const pick = (playerId: string): Assignment => ({ playerId, agent: "Sage", role: "sentinel" });

describe("names as keys", () => {
  it("treats capitals, extra spaces and edge spaces as the same name", () => {
    expect(keyForName("  Alex   Smith ")).toBe(keyForName("alex smith"));
  });

  it("gives an unnamed player a key that is never saved", () => {
    expect(isNamedKey(playerKey(player("p1", "   ")))).toBe(false);
    expect(isNamedKey(playerKey(player("p1", "Alex")))).toBe(true);
  });

  it("swaps each player's id for their key when rolling", () => {
    const rolled = toRollPlayers([player("p1", "Alex"), player("p2", "")]);
    expect(rolled.map((p) => p.id)).toEqual([keyForName("Alex"), "slot:p2"]);
  });

  it("does not mix up a person named like a slot with an unnamed slot", () => {
    const rolled = toRollPlayers([player("p1", "slot:p2"), player("p2", "")]);
    expect(new Set(rolled.map((p) => p.id)).size).toBe(2);
  });
});

describe("findDuplicateName", () => {
  it("finds two players with the same name, ignoring capitals", () => {
    expect(findDuplicateName([player("a", "Alex"), player("b", " alex ")])).toBe("alex");
  });

  it("allows any number of unnamed players", () => {
    expect(findDuplicateName([player("a", ""), player("b", "")])).toBeNull();
  });

  it("returns null when every name is different", () => {
    expect(findDuplicateName([player("a", "Alex"), player("b", "Sam")])).toBeNull();
  });
});

describe("rememberPlayers", () => {
  it("saves named players with their exclusions and skips unnamed ones", () => {
    const roster = rememberPlayers({}, [player("a", " Alex ", ["Sage"], ["duelist"]), player("b", "")]);
    expect(Object.keys(roster)).toEqual([keyForName("Alex")]);
    expect(findSaved(roster, "ALEX")).toEqual({
      name: "Alex",
      excludedAgents: ["Sage"],
      bannedRoles: ["duelist"],
    });
  });

  it("replaces what was saved for the same person", () => {
    const first = rememberPlayers({}, [player("a", "Alex", ["Sage"])]);
    const second = rememberPlayers(first, [player("a", "Alex", [])]);
    expect(findSaved(second, "Alex")?.excludedAgents).toEqual([]);
  });

  it("keeps people who aren't in this roll", () => {
    const first = rememberPlayers({}, [player("a", "Alex")]);
    const second = rememberPlayers(first, [player("b", "Sam")]);
    expect(Object.keys(second)).toHaveLength(2);
  });

  it("does not change the roster it was given", () => {
    const original: Roster = {};
    rememberPlayers(original, [player("a", "Alex")]);
    expect(original).toEqual({});
  });
});

describe("addSavedToTeam", () => {
  const saved = { name: "Alex", excludedAgents: ["Sage"], bannedRoles: ["duelist" as Role] };

  it("fills the first unnamed slot with the saved person and their bans", () => {
    const team = [player("a", "Sam"), player("b", ""), player("c", "")];
    const result = addSavedToTeam(team, saved, "new")!;
    expect(result.map((p) => p.name)).toEqual(["Sam", "Alex", ""]);
    expect(result[1].id).toBe("b");
    expect(result[1].excludedAgents).toEqual(["Sage"]);
    expect(result[1].bannedRoles).toEqual(["duelist"]);
  });

  it("adds a new slot when every slot is named and there is room", () => {
    const team = [player("a", "Sam")];
    const result = addSavedToTeam(team, saved, "new")!;
    expect(result.map((p) => p.id)).toEqual(["a", "new"]);
  });

  it("returns null when the team is full", () => {
    const team = ["a", "b", "c", "d", "e"].map((id) => player(id, id));
    expect(addSavedToTeam(team, saved, "new")).toBeNull();
  });

  it("still fills an unnamed slot in a full team", () => {
    const team = ["a", "b", "c", "d", ""].map((n, i) => player(`p${i}`, n));
    expect(addSavedToTeam(team, saved, "new")?.map((p) => p.name)).toEqual(["a", "b", "c", "d", "Alex"]);
  });

  it("leaves the team alone when the person is already on it", () => {
    const team = [player("a", "alex")];
    expect(addSavedToTeam(team, saved, "new")).toBe(team);
  });
});

describe("forgetPlayer", () => {
  it("removes the person and their history but nobody else's", () => {
    const alex = keyForName("Alex");
    const sam = keyForName("Sam");
    const roster = rememberPlayers({}, [player("a", "Alex"), player("b", "Sam")]);
    const history: History = { [alex]: [pick(alex)], [sam]: [pick(sam)] };
    const result = forgetPlayer(roster, history, alex);
    expect(Object.keys(result.roster)).toEqual([sam]);
    expect(Object.keys(result.history)).toEqual([sam]);
    expect(Object.keys(roster)).toHaveLength(2);
  });
});

describe("removeFromTeam", () => {
  const alex = keyForName("Alex");
  const team = [player("a", "Alex", ["Sage"]), player("b", "Sam")];
  const history: History = { [alex]: [pick(alex)] };

  it("takes the player off the team but keeps their saved exclusions and history", () => {
    const result = removeFromTeam(team, {}, history, team[0], false);
    expect(result.players.map((p) => p.id)).toEqual(["b"]);
    expect(findSaved(result.roster, "Alex")?.excludedAgents).toEqual(["Sage"]);
    expect(result.history).toBe(history);
  });

  it("brings the saved details back when the name is typed again", () => {
    const result = removeFromTeam(team, {}, history, team[0], false);
    expect(findSaved(result.roster, "alex")).toEqual({
      name: "Alex",
      excludedAgents: ["Sage"],
      bannedRoles: [],
    });
    expect(result.history[alex]).toHaveLength(1);
  });

  it("deletes the saved details and history when forgetting", () => {
    const roster = rememberPlayers({}, team);
    const result = removeFromTeam(team, roster, history, team[0], true);
    expect(findSaved(result.roster, "Alex")).toBeUndefined();
    expect(result.history[alex]).toBeUndefined();
    expect(findSaved(result.roster, "Sam")).toBeDefined();
  });

  it("just removes an unnamed slot", () => {
    const withBlank = [...team, player("c", "")];
    const result = removeFromTeam(withBlank, {}, history, withBlank[2], true);
    expect(result.players).toHaveLength(2);
    expect(result.roster).toEqual({});
    expect(result.history).toBe(history);
  });
});

describe("keepNamedHistory", () => {
  it("drops history filed under slots and keeps history filed under names", () => {
    const alex = keyForName("Alex");
    const history: History = { "player-1": [pick("player-1")], [alex]: [pick(alex)] };
    expect(Object.keys(keepNamedHistory(history))).toEqual([alex]);
  });
});
