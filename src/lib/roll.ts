import { AGENTS } from "../data/agents";
import { activeRules } from "./minimums";
import type { Agent, Assignment, History, Player, Role, Settings } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

/** Thrown when the players and toggles can't produce a valid comp. */
export class RollError extends Error {}

/** How many times to re-draw the roles if the agents for a draw don't fit. */
const MAX_ROLE_DRAWS = 50;

const noCompMessage =
  "No valid comp fits these settings. Try loosening a role limit or trimming someone's bans.";

/** A comp that is being partly rerolled: the picks on screen now, and the players whose picks stay. */
export interface Reroll {
  current: Assignment[];
  keptIds: readonly string[];
}

/**
 * Rolls a unique agent for every player, honouring each role's minimum and maximum, excluded
 * agents and (optionally) each player's recent roles.
 *
 * Minimums are not limited by the team size: when they ask for more than the team can hold, every
 * player fills a required role, and role history decides which ones (D-new1). Maximums are strict.
 *
 * With `reroll`, the players in `keptIds` keep their current picks and only the
 * others are rolled. Kept roles count toward the limits, kept agents can't be
 * given again, and a rerolled player never gets the agent they had, since they
 * asked for a change. The result is still in team order.
 *
 * `taken` are the picks of random teammates who are on the team but not rolled for: their agents
 * can't be given, their roles count toward the limits, and they are not in the result. A locked
 * pick that clashes with a taken agent is dropped, so that player is rolled again. A kept or taken
 * pick that is already over a role's maximum stays, and the others just can't be given that role.
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
  // A role that is switched off has no rule, whatever range it keeps.
  const rules = activeRules(settings);
  checkRanges(rules);
  // What the rolled players still owe once the kept and taken picks have taken their share.
  const owed: Settings = {
    ...settings,
    minPerRole: leftOver(rules.minPerRole, fixed),
    maxPerRole: leftOver(rules.maxPerRole, fixed),
  };

  validate(open, owed, pool);

  const weights = open.map((player) =>
    ROLES.map((role) => roleWeight(player, role, owed, history, pool)),
  );
  const minimums = ROLES.map((role) => owed.minPerRole[role]);
  const room = ROLES.map((role) => owed.maxPerRole[role]);
  // Asking for more than the team can hold is allowed, but if the players can't be given the roles
  // that takes, the roll goes ahead without the minimums rather than refusing (#51).
  const overAsked = minimums.reduce((a, b) => a + b, 0) > open.length;

  // 2. Draw the rolled players' roles at once, then find agents to fit. If the agents
  //    don't fit (rare, only with heavy exclusions), draw the roles again.
  for (let attempt = 0; attempt < MAX_ROLE_DRAWS; attempt++) {
    const roles =
      drawRoles(weights, minimums, room, rng) ??
      (overAsked ? drawRoles(weights, minimums.map(() => 0), room, rng) : null);
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

/** What a role's limit still allows once the kept and taken picks have used some of it, never below 0. */
const leftOver = (limit: Settings["minPerRole"], fixed: Assignment[]): Settings["minPerRole"] =>
  Object.fromEntries(
    ROLES.map((role) => [role, Math.max(0, limit[role] - fixed.filter((pick) => pick.role === role).length)]),
  ) as Settings["minPerRole"];

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
 * each player's role weights, among the teams that meet the minimums and stay
 * inside the maximums.
 *
 * Works in two passes over the same small table:
 *  1. `ways(i, need, room)` is the combined weight of every way players i onwards can
 *     finish a team that still owes `need` agents per role and has `room` places left per role.
 *  2. Players are then drawn one at a time, each role chosen in proportion to
 *     its weight times `ways` for the rest of the team.
 *
 * When the minimums ask for more agents than players are left, every one of those players has to
 * fill a required slot, so the team holds as many required roles as it can.
 *
 * So a player who has had a role a lot is less likely to be handed one of the
 * required slots, rather than whoever happens to come last in the order.
 * Returns null when no team can meet the limits.
 */
function drawRoles(weights: number[][], minimums: number[], maximums: number[], rng: () => number): Role[] | null {
  const count = weights.length;
  const memo = new Map<string, number>();
  const total = (values: number[]): number => values.reduce((a, b) => a + b, 0);

  // Whether player `index` may take role `r`, given what the rest of the team still owes and has room for.
  const allowed = (index: number, r: number, need: number[], room: number[]): boolean =>
    weights[index][r] > 0 && room[r] > 0 && !(total(need) >= count - index && need[r] === 0);

  const ways = (index: number, need: number[], room: number[]): number => {
    if (index === count) return 1;
    const key = `${index}:${need.join(",")}:${room.join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let sum = 0;
    for (let r = 0; r < ROLES.length; r++) {
      if (!allowed(index, r, need, room)) continue;
      sum += weights[index][r] * ways(index + 1, takeOne(need, r), takeOne(room, r));
    }
    memo.set(key, sum);
    return sum;
  };

  if (ways(0, minimums, maximums) === 0) return null;

  const roles: Role[] = [];
  let need = minimums;
  let room = maximums;
  for (let i = 0; i < count; i++) {
    const shares = ROLES.map((_, r) =>
      allowed(i, r, need, room) ? weights[i][r] * ways(i + 1, takeOne(need, r), takeOne(room, r)) : 0,
    );
    const chosen = drawIndex(shares, rng);
    roles.push(ROLES[chosen]);
    need = takeOne(need, chosen);
    room = takeOne(room, chosen);
  }
  return roles;
}

/** One fewer agent still owed, or one fewer place left, for role `r`, never below zero. */
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

/** Checks that each role's limits are whole numbers with the minimum no higher than the maximum. */
function checkRanges(settings: Pick<Settings, "minPerRole" | "maxPerRole">): void {
  for (const role of ROLES) {
    const min = settings.minPerRole[role];
    const max = settings.maxPerRole[role];
    if (!Number.isInteger(min) || min < 0) {
      throw new RollError(`The ${role} minimum must be a whole number, 0 or more.`);
    }
    if (!Number.isInteger(max) || max < 0) {
      throw new RollError(`The ${role} maximum must be a whole number, 0 or more.`);
    }
    if (min > max) {
      throw new RollError(`The ${role} minimum (${min}) is above its maximum (${max}).`);
    }
  }
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

  const places = ROLES.reduce((sum, role) => sum + settings.maxPerRole[role], 0);
  if (places < players.length) {
    throw new RollError(
      `The role maximums leave room for ${places} of the ${players.length} players. Raise a maximum.`,
    );
  }

  for (const player of players) {
    if (!ROLES.some((role) => canPlayRole(player, role, agents))) {
      throw new RollError(`${player.name || "A player"} has banned every role or agent they could be given.`);
    }
  }

  for (const role of ROLES) {
    // A minimum above the team size is allowed, so it can only ask for as many as there are players.
    const min = Math.min(settings.minPerRole[role], players.length);
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
