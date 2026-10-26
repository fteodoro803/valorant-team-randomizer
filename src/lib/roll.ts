import { AGENTS } from "../data/agents";
import type { Agent, Assignment, History, Player, Role, Settings } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

/** Thrown when the players and toggles can't produce a valid comp. */
export class RollError extends Error {}

/** How many times to re-draw the roles if the agents for a draw don't fit. */
const MAX_ROLE_DRAWS = 50;

const noCompMessage =
  "No valid comp fits these settings. Try lowering a role minimum or trimming someone's bans.";

/** A comp that is being partly rerolled: the picks on screen now, and the players whose picks stay. */
export interface Reroll {
  current: Assignment[];
  keptIds: readonly string[];
}

/**
 * Rolls a unique agent for every player, honouring role minimums, excluded
 * agents and (optionally) each player's recent roles.
 *
 * With `reroll`, the players in `keptIds` keep their current picks and only the
 * others are rolled. Kept roles count toward the minimums, kept agents can't be
 * given again, and a rerolled player never gets the agent they had, since they
 * asked for a change. The result is still in team order.
 *
 * `taken` are the picks of random teammates who are on the team but not rolled for: their agents
 * can't be given, their roles count toward the minimums, and they are not in the result. A locked
 * pick that clashes with a taken agent is dropped, so that player is rolled again.
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
  reroll?: Reroll,
  taken: Assignment[] = [],
): Assignment[] {
  // 1. Split the team into the picks that stay and the players who are rolled, and take the
  //    kept and taken agents and roles out of what the rolled players can be given.
  const kept = reroll
    ? reroll.current.filter(
        (pick) => reroll.keptIds.includes(pick.playerId) && !taken.some((t) => t.agent === pick.agent),
      )
    : [];
  const fixed = [...kept, ...taken];
  const keptIds = new Set(kept.map((pick) => pick.playerId));
  const open = players
    .filter((p) => !keptIds.has(p.id))
    .map((p) => withoutCurrentAgent(p, reroll?.current));
  if (open.length === 0) throw new RollError("Everyone is locked. Tap someone to change them.");
  const pool = agents.filter((a) => !fixed.some((pick) => pick.agent === a.name));
  // A full roll checks the minimums as typed, so a bad one is still reported rather than clamped away.
  const owed: Settings =
    fixed.length === 0
      ? settings
      : {
          ...settings,
          minPerRole: Object.fromEntries(
            ROLES.map((role) => [role, Math.max(0, settings.minPerRole[role] - fixed.filter((k) => k.role === role).length)]),
          ) as Settings["minPerRole"],
        };

  validate(open, owed, pool);

  const weights = open.map((player) =>
    ROLES.map((role) => roleWeight(player, role, owed, history, pool)),
  );
  const minimums = ROLES.map((role) => owed.minPerRole[role]);

  // 2. Draw the rolled players' roles at once, then find agents to fit. If the agents
  //    don't fit (rare, only with heavy exclusions), draw the roles again.
  for (let attempt = 0; attempt < MAX_ROLE_DRAWS; attempt++) {
    const roles = drawRoles(weights, minimums, rng);
    if (roles === null) break;
    const rolled = pickAgents(open, roles, pool, rng);
    if (rolled !== null) {
      // 3. Put the kept picks back, so the comp stays in the team's order.
      return players.map(
        (p) => kept.find((k) => k.playerId === p.id) ?? rolled.find((r) => r.playerId === p.id)!,
      );
    }
  }
  throw new RollError(noCompMessage);
}

/** The player with the agent they have now added to their excluded list, so a reroll gives something new. */
function withoutCurrentAgent(player: Player, current: Assignment[] | undefined): Player {
  const now = current?.find((pick) => pick.playerId === player.id)?.agent;
  if (now === undefined || player.excludedAgents.includes(now)) return player;
  return { ...player, excludedAgents: [...player.excludedAgents, now] };
}

/**
 * How likely a player is to be given a role, from 1 (no history) downwards.
 *
 * Each time the player had the role in their remembered picks, the weight
 * shrinks: 1 / (1 + count). It never reaches zero, so a forced role still works.
 * It is 0 only when the player can't be given that role at all (see canPlayRole).
 */
function roleWeight(
  player: Player,
  role: Role,
  settings: Settings,
  history: History,
  agents: Agent[],
): number {
  if (!canPlayRole(player, role, agents)) return 0;
  if (!settings.historyAware) return 1;
  const recent = (history[player.id] ?? []).filter((pick) => pick.role === role).length;
  return 1 / (1 + recent);
}

/**
 * Draws one role for each player so the whole team's chance is the product of
 * each player's role weights, among the teams that meet the minimums.
 *
 * Works in two passes over the same small table:
 *  1. `ways(i, need)` is the combined weight of every way players i onwards can
 *     finish a team that still owes `need` agents per role.
 *  2. Players are then drawn one at a time, each role chosen in proportion to
 *     its weight times `ways` for the rest of the team.
 *
 * So a player who has had a role a lot is less likely to be handed one of the
 * required slots, rather than whoever happens to come last in the order.
 * Returns null when no team can meet the minimums.
 */
function drawRoles(weights: number[][], minimums: number[], rng: () => number): Role[] | null {
  const count = weights.length;
  const memo = new Map<string, number>();

  const ways = (index: number, need: number[]): number => {
    if (need.reduce((a, b) => a + b, 0) > count - index) return 0;
    if (index === count) return 1;
    const key = `${index}:${need.join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let sum = 0;
    for (let r = 0; r < ROLES.length; r++) {
      if (weights[index][r] === 0) continue;
      sum += weights[index][r] * ways(index + 1, takeOne(need, r));
    }
    memo.set(key, sum);
    return sum;
  };

  if (ways(0, minimums) === 0) return null;

  const roles: Role[] = [];
  let need = minimums;
  for (let i = 0; i < count; i++) {
    const shares = ROLES.map((_, r) =>
      weights[i][r] === 0 ? 0 : weights[i][r] * ways(i + 1, takeOne(need, r)),
    );
    const chosen = drawIndex(shares, rng);
    roles.push(ROLES[chosen]);
    need = takeOne(need, chosen);
  }
  return roles;
}

/** One fewer agent still owed for role `r`, never below zero. */
const takeOne = (need: number[], r: number): number[] =>
  need.map((n, i) => (i === r ? Math.max(0, n - 1) : n));

/** Picks an index with chance proportional to its share. */
function drawIndex(shares: number[], rng: () => number): number {
  const sum = shares.reduce((a, b) => a + b, 0);
  let target = rng() * sum;
  for (let i = 0; i < shares.length; i++) {
    if (shares[i] === 0) continue;
    if (target < shares[i]) return i;
    target -= shares[i];
  }
  return shares.findLastIndex((s) => s > 0);
}

/**
 * Gives each player a random agent in their drawn role, none repeated and none
 * from their excluded list. Backtracks if a player runs out of choices.
 * Returns null when the roles can't be filled with distinct agents.
 */
function pickAgents(
  players: Player[],
  roles: Role[],
  agents: Agent[],
  rng: () => number,
): Assignment[] | null {
  const used = new Set<string>();
  const comp: Assignment[] = [];

  const fill = (index: number): boolean => {
    if (index === players.length) return true;
    const player = players[index];
    const role = roles[index];
    const options = shuffle(
      agents.filter((a) => a.role === role && !player.excludedAgents.includes(a.name)),
      rng,
    );
    for (const agent of options) {
      if (used.has(agent.name)) continue;
      used.add(agent.name);
      comp.push({ playerId: player.id, agent: agent.name, role });
      if (fill(index + 1)) return true;
      comp.pop();
      used.delete(agent.name);
    }
    return false;
  };

  return fill(0) ? comp : null;
}

/**
 * Whether a player can be given this role.
 *
 * Not if they banned the role, and not if they banned every agent in it.
 */
function canPlayRole(player: Player, role: Role, agents: Agent[]): boolean {
  if (player.bannedRoles.includes(role)) return false;
  return agents.some((a) => a.role === role && !player.excludedAgents.includes(a.name));
}

/** Checks the inputs that can be ruled out before any drawing starts. */
function validate(players: Player[], settings: Settings, agents: Agent[]): void {
  if (players.length === 0) throw new RollError("Add at least one player.");
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new RollError("Every player needs a different id.");
  }
  if (players.length > MAX_PLAYERS) {
    throw new RollError(`A team can have at most ${MAX_PLAYERS} players.`);
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
  const needed = ROLES.reduce((sum, role) => sum + settings.minPerRole[role], 0);
  if (needed > players.length) {
    throw new RollError(
      `The role minimums need ${needed} players but there are only ${players.length}.`,
    );
  }

  for (const player of players) {
    if (!ROLES.some((role) => canPlayRole(player, role, agents))) {
      throw new RollError(`${player.name || "A player"} has banned every role or agent they could be given.`);
    }
  }

  for (const role of ROLES) {
    const min = settings.minPerRole[role];
    if (min === 0) continue;
    const willing = players.filter((p) => canPlayRole(p, role, agents));
    if (willing.length < min) {
      throw new RollError(
        `The ${role} minimum is ${min}, but only ${willing.length} player(s) are willing to play a ${role}.`,
      );
    }
  }
}

/** Fisher-Yates shuffle of a copy. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
