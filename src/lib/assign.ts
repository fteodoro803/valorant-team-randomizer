import { AGENTS } from "../data/agents";
import type { Agent, Assignment } from "./types";

/**
 * The comp with one player given an agent by hand (D36), or null if the agent isn't in the game.
 *
 * The player's old pick is replaced, and picks belonging to anyone no longer on the team are dropped,
 * so a comp built before the team changed doesn't carry them along. The comp may hold only some
 * players' picks, which is what it does before the first roll.
 */
export function assignPick(
  comp: Assignment[],
  teamIds: string[],
  rollId: string,
  agent: string,
  agents: Agent[] = AGENTS,
): Assignment[] | null {
  const role = agents.find((a) => a.name === agent)?.role;
  if (!role) return null;
  const others = comp.filter((pick) => pick.playerId !== rollId && teamIds.includes(pick.playerId));
  return [...others, { playerId: rollId, agent, role }];
}
