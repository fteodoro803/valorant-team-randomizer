import { describe, expect, it } from "vitest";
import { addTeammate, slotsForPlayers, takenPicks, teamSize } from "./teammates";
import type { Player, Teammate } from "./types";

const player = (id: string): Player => ({ id, name: id, excludedAgents: [], bannedRoles: [] });
const teammate = (id: string, agent: string | null): Teammate => ({ id, agent });

describe("takenPicks", () => {
  it("turns picked agents into picks with their role, and skips the ones not picked", () => {
    expect(takenPicks([teammate("t1", "Jett"), teammate("t2", null), teammate("t3", "Sage")])).toEqual([
      { playerId: "t1", agent: "Jett", role: "duelist" },
      { playerId: "t3", agent: "Sage", role: "sentinel" },
    ]);
  });

  it("skips an agent that is no longer in the game", () => {
    expect(takenPicks([teammate("t1", "Gone")])).toEqual([]);
  });
});

describe("team slots", () => {
  it("leaves the players the slots the teammates haven't taken", () => {
    expect(slotsForPlayers([teammate("t1", null), teammate("t2", "Jett")])).toBe(3);
  });

  it("counts only teammates with a known agent toward what the minimums can cover", () => {
    expect(teamSize([player("a"), player("b")], [teammate("t1", "Jett"), teammate("t2", null)])).toBe(3);
  });

  it("adds a blank teammate while there is room, and refuses at five", () => {
    const players = [player("a"), player("b"), player("c")];
    expect(addTeammate(players, [], "t1")).toEqual([teammate("t1", null)]);
    expect(addTeammate(players, [teammate("t1", null)], "t2")).toHaveLength(2);
    expect(addTeammate(players, [teammate("t1", null), teammate("t2", null)], "t3")).toBeNull();
  });
});
