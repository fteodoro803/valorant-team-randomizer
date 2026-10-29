import { describe, expect, it } from "vitest";
import { assignPick } from "./assign";
import type { Assignment } from "./types";

const pick = (playerId: string, agent: string, role: Assignment["role"]): Assignment => ({ playerId, agent, role });

describe("assignPick", () => {
  it("starts a comp from nothing, with the agent's role", () => {
    expect(assignPick([], ["a", "b"], "a", "Jett")).toEqual([pick("a", "Jett", "duelist")]);
  });

  it("replaces the player's old pick and keeps everyone else's", () => {
    const comp = [pick("a", "Sage", "sentinel"), pick("b", "Sova", "initiator")];
    expect(assignPick(comp, ["a", "b"], "a", "Jett")).toEqual([pick("b", "Sova", "initiator"), pick("a", "Jett", "duelist")]);
  });

  it("drops picks of people who are no longer on the team", () => {
    const comp = [pick("gone", "Sova", "initiator")];
    expect(assignPick(comp, ["a"], "a", "Jett")).toEqual([pick("a", "Jett", "duelist")]);
  });

  it("refuses an agent that isn't in the game", () => {
    expect(assignPick([], ["a"], "a", "Nobody")).toBeNull();
  });
});
