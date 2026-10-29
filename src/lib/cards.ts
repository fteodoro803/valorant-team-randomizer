import { AGENTS } from "../data/agents";
import type { SharedRoll, TeamMember } from "./party";
import { keyForName, playerKey } from "./roster";
import type { Assignment, Player, Role, Teammate } from "./types";
import { MAX_PLAYERS } from "./types";

/**
 * One of the team's five cards, as the page draws it.
 *
 * A card is a person, or nobody yet: waiting for the roll, rolled, a random teammate who has
 * their agent already, or an empty card. The host's page and a joined friend's page both draw
 * from this shape, so the two stay the same.
 */
export interface CardView {
  /** Stable while the card shows the same thing, and new when it changes, so the reveal replays only for changed cards. */
  key: string;
  state: "empty" | "waiting" | "rolled" | "teammate";
  role?: Role;
  agent?: string;
  /** The player's name, or "Player 3" for an unnamed one. Random teammates and empty cards have none. */
  name?: string;
  /** Set only for someone who joined the party: whether they are in it. Everyone else has no dot. */
  online?: boolean;
  /** The host's page only: which player or random teammate this card is, and the id their pick is filed under. */
  playerId?: string;
  rollId?: string;
  teammateId?: string;
}

const roleOf = (agent: string): Role | undefined => AGENTS.find((a) => a.name === agent)?.role;

/** The empty cards that fill the row up to five, after everyone who is on the team. */
const emptyCards = (taken: number, max: number): CardView[] =>
  Array.from({ length: Math.max(0, max - taken) }, (_, i) => ({ key: `empty-${taken + i}`, state: "empty" as const }));

/**
 * The host's five cards: players first, then random teammates, then empty ones.
 *
 * A player has an agent once the roll has one filed under their key, so a player who is added or
 * renamed after a roll waits for the next one. A random teammate always shows the agent they picked,
 * since their pick is not part of a roll.
 */
export function buildCards(
  players: Player[],
  teammates: Teammate[],
  comp: Assignment[] | null,
  max: number = MAX_PLAYERS,
): CardView[] {
  const playerCards = players.map((player, index): CardView => {
    const rollId = playerKey(player);
    const pick = comp?.find((c) => c.playerId === rollId);
    const name = player.name.trim() || `Player ${index + 1}`;
    const online = player.member === undefined ? undefined : player.member === "online";
    const base = { name, online, playerId: player.id, rollId };
    return pick
      ? { ...base, key: `${player.id}-${pick.agent}`, state: "rolled", role: pick.role, agent: pick.agent }
      : { ...base, key: player.id, state: "waiting" };
  });
  const teammateCards = teammates.map((teammate): CardView => {
    const role = teammate.agent ? roleOf(teammate.agent) : undefined;
    return role && teammate.agent
      ? { key: `${teammate.id}-${teammate.agent}`, state: "teammate", role, agent: teammate.agent, teammateId: teammate.id }
      : { key: teammate.id, state: "teammate", teammateId: teammate.id };
  });
  return [...playerCards, ...teammateCards, ...emptyCards(playerCards.length + teammateCards.length, max)].slice(0, max);
}

/**
 * A joined friend's five cards, from what the host sent.
 *
 * Friends only know names, so each player is matched to the roll by name. The host's random
 * teammates come as bare agent names, and the rest of the row is empty.
 */
export function buildSharedCards(
  team: TeamMember[],
  rolled: SharedRoll | null,
  teammateAgents: string[],
  max: number = MAX_PLAYERS,
): CardView[] {
  const playerCards = team.map((member): CardView => {
    const rolledPlayer = rolled?.players.find((p) => keyForName(p.name) === keyForName(member.name));
    const pick = rolledPlayer && rolled?.comp.find((c) => c.playerId === rolledPlayer.id);
    const base = { name: member.name, online: member.online };
    return pick
      ? { ...base, key: `${member.name}-${pick.agent}`, state: "rolled", role: pick.role, agent: pick.agent }
      : { ...base, key: member.name, state: "waiting" };
  });
  const teammateCards = teammateAgents.flatMap((agent, index): CardView[] => {
    const role = roleOf(agent);
    return role ? [{ key: `teammate-${index}-${agent}`, state: "teammate", role, agent }] : [];
  });
  return [...playerCards, ...teammateCards, ...emptyCards(playerCards.length + teammateCards.length, max)].slice(0, max);
}
