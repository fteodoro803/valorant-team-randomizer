import { describe, expect, it } from "vitest";
import {
  admitMember,
  endParty,
  isPartyCode,
  MAX_NAME_LENGTH,
  newPartyCode,
  normaliseCode,
  spreadCode,
  parseToHost,
  parseToMember,
  peerIdForCode,
  setMemberBans,
  setMemberStatus,
  teamForMembers,
} from "./party";
import type { Player } from "./types";

const player = (id: string, name = "", extra: Partial<Player> = {}): Player => ({
  id,
  name,
  excludedAgents: [],
  bannedRoles: [],
  ...extra,
});

const noBans = { excludedAgents: [], bannedRoles: [] };

describe("party codes", () => {
  it("makes four characters that pass the check, whatever the random numbers are", () => {
    for (const n of [0, 0.5, 0.999999]) {
      const code = newPartyCode(() => n);
      expect(code).toHaveLength(4);
      expect(isPartyCode(code)).toBe(true);
    }
  });

  it("reads a typed code ignoring case, spaces and dashes", () => {
    expect(normaliseCode(" k7-qd ")).toBe("K7QD");
    expect(peerIdForCode("k7qd")).toBe("vtr-party-K7QD");
  });

  it("rejects codes that are too short or use look-alike characters", () => {
    expect(isPartyCode("K7Q")).toBe(false);
    expect(isPartyCode("K7QD1")).toBe(false);
    expect(isPartyCode("K7Q0")).toBe(false);
    expect(isPartyCode("K7QI")).toBe(false);
  });
});

describe("parseToHost", () => {
  it("reads a join, tidying the name", () => {
    expect(parseToHost({ type: "join", name: "  Sam   Lee ", excludedAgents: ["Sage"], bannedRoles: ["sentinel"] })).toEqual({
      type: "join",
      name: "Sam Lee",
      excludedAgents: ["Sage"],
      bannedRoles: ["sentinel"],
    });
  });

  it("cuts a long name to the limit", () => {
    const parsed = parseToHost({ type: "join", name: "x".repeat(500), ...noBans });
    expect(parsed?.type === "join" && parsed.name).toHaveLength(MAX_NAME_LENGTH);
  });

  it("drops agents and roles that don't exist, and repeats", () => {
    const parsed = parseToHost({ type: "bans", excludedAgents: ["Sage", "Sage", "Nobody", 4], bannedRoles: ["duelist", "banana"] });
    expect(parsed).toEqual({ type: "bans", excludedAgents: ["Sage"], bannedRoles: ["duelist"] });
  });

  it("reads a leave and a ping", () => {
    expect(parseToHost({ type: "leave" })).toEqual({ type: "leave" });
    expect(parseToHost({ type: "ping" })).toEqual({ type: "ping" });
  });

  it("rejects anything else", () => {
    expect(parseToHost(null)).toBeNull();
    expect(parseToHost("roll")).toBeNull();
    // Only the host rolls, so an old page's Roll press is ignored.
    expect(parseToHost({ type: "roll" })).toBeNull();
    expect(parseToHost({ type: "join", name: "   ", ...noBans })).toBeNull();
    expect(parseToHost({ type: "join", name: 3, ...noBans })).toBeNull();
    expect(parseToHost({ type: "bans", excludedAgents: "Sage", bannedRoles: [] })).toBeNull();
    expect(parseToHost({ type: "explode" })).toBeNull();
  });
});

describe("parseToMember", () => {
  const snapshot = {
    type: "snapshot",
    team: [{ name: "Sam", online: true }],
    teammates: ["Sage"],
    rolled: {
      comp: [{ playerId: "name:sam", agent: "Jett", role: "duelist" }],
      players: [{ id: "name:sam", name: "Sam" }],
      id: 3,
      locked: false,
    },
    error: null,
  };

  it("reads a snapshot with a roll", () => {
    expect(parseToMember(snapshot)).toEqual(snapshot);
  });

  it("reads a snapshot before any roll, and one with an error", () => {
    expect(parseToMember({ ...snapshot, rolled: null, error: "No valid comp" })).toMatchObject({ rolled: null, error: "No valid comp" });
  });

  it("reads a snapshot from a host that sends no random teammates as having none", () => {
    const { teammates: _teammates, ...older } = snapshot;
    expect(parseToMember(older)).toMatchObject({ teammates: [] });
  });

  it("drops a random teammate's agent that doesn't exist, and rejects a teammates list that isn't a list", () => {
    expect(parseToMember({ ...snapshot, teammates: ["Sage", "Nobody", 4] })).toMatchObject({ teammates: ["Sage"] });
    expect(parseToMember({ ...snapshot, teammates: "Sage" })).toBeNull();
  });

  it("reads a pong and a removal", () => {
    expect(parseToMember({ type: "pong" })).toEqual({ type: "pong" });
    expect(parseToMember({ type: "removed" })).toEqual({ type: "removed" });
  });

  it("reads a refusal", () => {
    expect(parseToMember({ type: "refused", reason: "The party is full." })).toEqual({ type: "refused", reason: "The party is full." });
  });

  it("rejects a pick whose agent doesn't exist or has the wrong role", () => {
    const bad = (pick: object) => ({ ...snapshot, rolled: { ...snapshot.rolled, comp: [pick] } });
    expect(parseToMember(bad({ playerId: "a", agent: "Nobody", role: "duelist" }))).toBeNull();
    expect(parseToMember(bad({ playerId: "a", agent: "Jett", role: "sentinel" }))).toBeNull();
  });

  it("rejects a roll without a locked flag", () => {
    const { locked: _locked, ...unflagged } = snapshot.rolled;
    expect(parseToMember({ ...snapshot, rolled: unflagged })).toBeNull();
  });

  it("rejects a team that is too big or badly shaped", () => {
    expect(parseToMember({ ...snapshot, team: Array.from({ length: 9 }, () => ({ name: "x", online: true })) })).toBeNull();
    expect(parseToMember({ ...snapshot, team: [{ name: "Sam" }] })).toBeNull();
    expect(parseToMember({ type: "snapshot" })).toBeNull();
    expect(parseToMember(7)).toBeNull();
  });
});

describe("admitMember", () => {
  const join = { name: "Sam", excludedAgents: ["Sage"], bannedRoles: [] };

  it("takes the first unnamed slot, keeping its id", () => {
    const result = admitMember([player("a", "Host"), player("b"), player("c")], join, "new");
    expect("players" in result && result.playerId).toBe("b");
    expect("players" in result && result.players[1]).toMatchObject({ id: "b", name: "Sam", excludedAgents: ["Sage"], member: "online" });
  });

  it("adds a new slot when none is free and there is room", () => {
    const result = admitMember([player("a", "Host")], join, "new");
    expect("players" in result && result.players.map((p) => p.id)).toEqual(["a", "new"]);
  });

  it("refuses when the team is full", () => {
    const full = ["a", "b", "c", "d", "e"].map((id) => player(id, id));
    expect(admitMember(full, join, "new")).toEqual({ refused: "The party is full." });
  });

  it("refuses a name that is already on the team, however it is capitalised", () => {
    expect(admitMember([player("a", "sam")], { ...join, name: "SAM" }, "new")).toEqual({
      refused: "SAM is already in this party. Pick another name, or wait a moment if that was you.",
    });
    expect(admitMember([player("a", "Sam", { member: "online" })], join, "new")).toMatchObject({ refused: expect.any(String) });
  });

  it("lets a member who left come back to their own slot with their new bans", () => {
    const team = [player("a", "Host"), player("b", "Sam", { member: "offline", excludedAgents: ["Jett"] })];
    const result = admitMember(team, join, "new");
    expect("players" in result && result.playerId).toBe("b");
    expect("players" in result && result.players[1]).toMatchObject({ id: "b", excludedAgents: ["Sage"], member: "online" });
  });

  it("doesn't use a slot that is waiting for a member who left", () => {
    const team = [player("a", "", { member: "offline" })];
    const result = admitMember(team, join, "new");
    expect("players" in result && result.players.map((p) => p.id)).toEqual(["a", "new"]);
  });
});

describe("member updates", () => {
  const team = [player("a", "Host"), player("b", "Sam", { member: "online" })];

  it("changes only a member's bans", () => {
    const next = setMemberBans(team, "b", { excludedAgents: ["Sage"], bannedRoles: ["duelist"] });
    expect(next[1]).toMatchObject({ excludedAgents: ["Sage"], bannedRoles: ["duelist"] });
    expect(setMemberBans(team, "a", { excludedAgents: ["Sage"], bannedRoles: [] })[0].excludedAgents).toEqual([]);
  });

  it("doesn't copy anything but the two ban lists from a whole message", () => {
    const message = { type: "bans", excludedAgents: ["Sage"], bannedRoles: [] };
    expect(Object.keys(setMemberBans(team, "b", message)[1]).sort()).toEqual(
      ["bannedRoles", "excludedAgents", "id", "member", "name"],
    );
  });

  it("marks a member offline and leaves them on the team", () => {
    const next = setMemberStatus(team, "b", "offline");
    expect(next[1].member).toBe("offline");
    expect(teamForMembers(next)).toEqual([{ name: "Host", online: true }, { name: "Sam", online: false }]);
  });

  it("ends the party with members kept as ordinary players", () => {
    expect(endParty(team).every((p) => p.member === undefined)).toBe(true);
    expect(endParty(team)).toHaveLength(2);
  });

  it("leaves unnamed slots out of the team members see", () => {
    expect(teamForMembers([player("a", "Host"), player("b")])).toEqual([{ name: "Host", online: true }]);
  });

  describe("spreadCode", () => {
    const empty = ["", "", "", ""];

    it("puts one character in its box and moves to the next", () => {
      expect(spreadCode(empty, 1, "k")).toEqual({ boxes: ["", "K", "", ""], focus: 2 });
    });

    it("fills every box from a pasted code, whichever box it was pasted into first", () => {
      expect(spreadCode(empty, 0, "k7-qd")).toEqual({ boxes: ["K", "7", "Q", "D"], focus: 3 });
      expect(spreadCode(["A", "B", "", ""], 2, "K7")).toEqual({ boxes: ["A", "B", "K", "7"], focus: 3 });
    });

    it("drops anything past the fourth box and stays on the last one", () => {
      expect(spreadCode(["A", "B", "C", ""], 3, "XYZ")).toEqual({ boxes: ["A", "B", "C", "X"], focus: 3 });
    });

    it("clears a box that was emptied without moving", () => {
      expect(spreadCode(["K", "7", "Q", "D"], 2, "")).toEqual({ boxes: ["K", "7", "", "D"], focus: 2 });
    });
  });
});
