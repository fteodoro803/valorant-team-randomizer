import { AGENTS } from "../data/agents";
import type { Agent, Assignment, History, Player, Role, Settings } from "./types";
import { ROLES } from "./types";

/** Thrown when the players and toggles can't produce a valid comp. */
export class RollError extends Error {}

/** Guard against a pathological search, far above anything a real team needs. */
const MAX_STEPS = 100_000;

type RoleCounts = Record<Role, number>;

/**
 * Rolls a unique agent for every player, honouring role minimums, excluded
 * agents and (optionally) each player's recent roles.
 *
 * Pure: all randomness comes from `rng`, so a roll can be replayed in tests.
 * Throws a RollError when the settings can't be met.
 */
export function rollComp(
  players: Player[],
  settings: Settings,
  history: History,
  rng: () => number = Math.random,
  agents: Agent[] = AGENTS,
): Assignment[] {
  validate(players, settings, agents);

  const agentsByRole = Object.fromEntries(
    ROLES.map((role) => [role, agents.filter((a) => a.role === role)]),
  ) as Record<Role, Agent[]>;

  // 1. Players are handled in random order, so nobody is always the one forced into a required role.
  const order = shuffle(players, rng);
  const used = new Set<string>();
  const picks = new Map<string, Assignment>();
  let steps = 0;

  const search = (index: number, need: RoleCounts): boolean => {
    if (index === order.length) return true;
    if (++steps > MAX_STEPS) throw new RollError(noCompMessage);

    const player = order[index];
    const slotsAfter = order.length - index - 1;

    // 2. Roles are tried in weighted-random order, so history shifts the odds without ruling anything out.
    const roleOrder = weightedOrder(ROLES, (role) => roleWeight(player, role, settings, history), rng);

    for (const role of roleOrder) {
      const needAfter = { ...need, [role]: Math.max(0, need[role] - 1) };
      // 3. Skip a role if the players still to come couldn't fill the remaining minimums.
      if (total(needAfter) > slotsAfter) continue;

      for (const agent of shuffle(agentsByRole[role], rng)) {
        if (used.has(agent.name) || player.excludedAgents.includes(agent.name)) continue;
        used.add(agent.name);
        picks.set(player.id, { playerId: player.id, agent: agent.name, role });
        if (search(index + 1, needAfter)) return true;
        used.delete(agent.name);
        picks.delete(player.id);
      }
    }
    return false;
  };

  if (!search(0, { ...settings.minPerRole })) throw new RollError(noCompMessage);

  // 4. Hand the comp back in the players' own order.
  return players.map((p) => picks.get(p.id)!);
}

const noCompMessage =
  "No valid comp fits these settings. Try lowering a role minimum or trimming someone's excluded agents.";

/**
 * How likely a player is to be given a role, from 1 (no history) downwards.
 *
 * Each time the player had the role in their remembered picks, the weight
 * shrinks: 1 / (1 + count). It never reaches zero, so a forced role still works.
 */
function roleWeight(player: Player, role: Role, settings: Settings, history: History): number {
  if (!settings.historyAware) return 1;
  const recent = (history[player.id] ?? []).filter((pick) => pick.role === role).length;
  return 1 / (1 + recent);
}

/** Checks the inputs that can be ruled out before any searching starts. */
function validate(players: Player[], settings: Settings, agents: Agent[]): void {
  if (players.length === 0) throw new RollError("Add at least one player.");
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new RollError("Every player needs a different id.");
  }
  if (players.length > agents.length) {
    throw new RollError(`There are ${players.length} players but only ${agents.length} agents.`);
  }

  for (const role of ROLES) {
    const min = settings.minPerRole[role];
    if (!Number.isInteger(min) || min < 0) {
      throw new RollError(`The ${role} minimum must be a whole number, 0 or more.`);
    }
  }
  if (total(settings.minPerRole) > players.length) {
    throw new RollError(
      `The role minimums need ${total(settings.minPerRole)} players but there are only ${players.length}.`,
    );
  }

  for (const role of ROLES) {
    const min = settings.minPerRole[role];
    if (min === 0) continue;
    const roleAgents = agents.filter((a) => a.role === role);
    const willing = players.filter((p) =>
      roleAgents.some((a) => !p.excludedAgents.includes(a.name)),
    );
    if (willing.length < min) {
      throw new RollError(
        `The ${role} minimum is ${min}, but only ${willing.length} player(s) are willing to play a ${role}.`,
      );
    }
  }
}

const total = (counts: RoleCounts): number => ROLES.reduce((sum, role) => sum + counts[role], 0);

/** Fisher-Yates shuffle of a copy. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Orders items by repeated weighted draws without replacement, heavier items tending to come first. */
function weightedOrder<T>(items: readonly T[], weightOf: (item: T) => number, rng: () => number): T[] {
  const pool = items.map((item) => ({ item, weight: weightOf(item) }));
  const ordered: T[] = [];
  while (pool.length > 0) {
    const sum = pool.reduce((s, entry) => s + entry.weight, 0);
    let target = rng() * sum;
    let i = 0;
    while (i < pool.length - 1 && target >= pool[i].weight) {
      target -= pool[i].weight;
      i++;
    }
    ordered.push(pool.splice(i, 1)[0].item);
  }
  return ordered;
}
