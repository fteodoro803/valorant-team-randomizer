import { AGENTS } from "../data/agents";
import type { Agent, Assignment, Player, Teammate } from "./types";
import { MAX_PLAYERS } from "./types";

/**
 * The picks of the random teammates who have chosen an agent, as the roller wants them.
 *
 * A teammate who hasn't picked yet, or whose agent is no longer in the game, is left out, since
 * there is nothing to work around.
 */
export function takenPicks(teammates: Teammate[], agents: Agent[] = AGENTS): Assignment[] {
  return teammates.flatMap((t) => {
    const agent = agents.find((a) => a.name === t.agent);
    return agent ? [{ playerId: t.id, agent: agent.name, role: agent.role }] : [];
  });
}

/** How many slots players can fill, once random teammates have taken theirs. */
export const slotsForPlayers = (teammates: Teammate[], max: number = MAX_PLAYERS): number => max - teammates.length;

/** How many people the role minimums can cover: our players, plus teammates whose agent is known. */
export const teamSize = (players: Player[], teammates: Teammate[]): number =>
  players.length + takenPicks(teammates).length;

/** The teammates with one more blank one, or null when the team's five slots are full. */
export function addTeammate(
  players: Player[],
  teammates: Teammate[],
  newId: string,
  max: number = MAX_PLAYERS,
): Teammate[] | null {
  if (players.length + teammates.length >= max) return null;
  return [...teammates, { id: newId, agent: null }];
}
