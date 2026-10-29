import { describe, expect, it } from "vitest";
import { buildCards, buildSharedCards } from "./cards";
import type { SharedRoll } from "./party";
import { playerKey } from "./roster";
import type { Assignment, Player, Teammate } from "./types";

const player = (id: string, name: string, member?: Player["member"]): Player => ({
  id,
  name,
  excludedAgents: [],
  bannedRoles: [],
  member,
});
const teammate = (id: string, agent: string | null): Teammate => ({ id, agent });

describe("buildCards", () => {
  it("fills the row to five with empty cards after the players and the random teammates", () => {
    const cards = buildCards([player("a", "Agu"), player("b", "dutah")], [teammate("t1", "Sage")], null);
    expect(cards.map((c) => c.state)).toEqual(["waiting", "waiting", "teammate", "empty", "empty"]);
    expect(cards[2]).toMatchObject({ agent: "Sage", role: "sentinel", teammateId: "t1" });
  });

  it("gives a player their agent when the roll has one filed under their key", () => {
    const agu = player("a", "Agu");
    const comp: Assignment[] = [{ playerId: playerKey(agu), agent: "Breach", role: "initiator" }];
    const [card] = buildCards([agu], [], comp);
    expect(card).toMatchObject({ state: "rolled", agent: "Breach", role: "initiator", name: "Agu", rollId: playerKey(agu) });
  });

  it("keeps a player who was added after the roll waiting", () => {
    const comp: Assignment[] = [{ playerId: playerKey(player("a", "Agu")), agent: "Breach", role: "initiator" }];
    const cards = buildCards([player("a", "Agu"), player("b", "dutah")], [], comp);
    expect(cards.map((c) => c.state).slice(0, 2)).toEqual(["rolled", "waiting"]);
  });

  it("names an unnamed player by their place on the team", () => {
    expect(buildCards([player("a", "Agu"), player("b", "")], [], null)[1].name).toBe("Player 2");
  });

  it("shows a dot only for someone who joined the party", () => {
    const cards = buildCards([player("a", "Agu"), player("b", "Sam", "online"), player("c", "Jo", "offline")], [], null);
    expect(cards.map((c) => c.online)).toEqual([undefined, true, false, undefined, undefined]);
  });

  it("shows a random teammate who hasn't picked an agent without one", () => {
    const [card] = buildCards([], [teammate("t1", null)], null);
    expect(card).toMatchObject({ state: "teammate", teammateId: "t1" });
    expect(card.agent).toBeUndefined();
  });

  it("changes a card's key when its agent changes, so only changed cards replay the reveal", () => {
    const agu = player("a", "Agu");
    const before = buildCards([agu], [], [{ playerId: playerKey(agu), agent: "Breach", role: "initiator" }])[0].key;
    const after = buildCards([agu], [], [{ playerId: playerKey(agu), agent: "Jett", role: "duelist" }])[0].key;
    expect(before).not.toBe(after);
  });
});

describe("buildSharedCards", () => {
  const rolled: SharedRoll = {
    comp: [{ playerId: "name:agu", agent: "Breach", role: "initiator" }],
    players: [{ id: "name:agu", name: "Agu" }],
    id: 1,
    locked: false,
  };
  const team = [
    { name: "Agu", online: true },
    { name: "Sam", online: false },
  ];

  it("matches players to the roll by name, capitals aside", () => {
    const cards = buildSharedCards([{ name: "AGU", online: true }], rolled, []);
    expect(cards[0]).toMatchObject({ state: "rolled", agent: "Breach", online: true });
  });

  it("keeps everyone waiting before a roll, adds the random teammates, and pads with empty cards", () => {
    const cards = buildSharedCards(team, null, ["Sage"]);
    expect(cards.map((c) => c.state)).toEqual(["waiting", "waiting", "teammate", "empty", "empty"]);
    expect(cards[1]).toMatchObject({ name: "Sam", online: false });
  });

  it("skips a random teammate whose agent isn't known", () => {
    expect(buildSharedCards([], null, ["Gone"]).every((c) => c.state === "empty")).toBe(true);
  });
});
