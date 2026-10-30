export const ROLES = ["duelist", "initiator", "controller", "sentinel"] as const;
export type Role = (typeof ROLES)[number];

export interface Agent {
  name: string;
  role: Role;
}

export interface Player {
  id: string;
  name: string;
  /** Agent names this player never wants to be given. Called bans on screen. */
  excludedAgents: string[];
  /** Roles this player never wants to be given, whatever the agent. */
  bannedRoles: Role[];
  /**
   * Set only while this player is someone who joined the host's party from their own device.
   * Their name and bans come from that device, and "offline" means they have left the tab.
   */
  member?: "online" | "offline";
}

export interface Settings {
  /**
   * Minimum agents per role in the comp. Not limited by the team size: when the minimums ask for
   * more than the team can hold, a roll fills as many of them as it can (D39).
   */
  minPerRole: Record<Role, number>;
  /**
   * Maximum agents per role in the comp, from the role's minimum up to MAX_PLAYERS. The range 0 to
   * MAX_PLAYERS asks for nothing.
   */
  maxPerRole: Record<Role, number>;
  /**
   * Whether each role's range applies. A role that is off keeps its range, so switching it back on
   * restores it, but the roll and the sentence treat it as having no rule (D39).
   */
  ruleOn: Record<Role, boolean>;
  /** When on, roles a player has had recently are less likely to come up again. */
  historyAware: boolean;
}

/**
 * A random teammate: someone on the team who isn't using the app.
 *
 * Only their agent matters, once they have picked it. They are never rolled, never saved to
 * history, and they take one of the team's five slots.
 */
export interface Teammate {
  id: string;
  /** The agent they picked, or null while they haven't picked yet. */
  agent: string | null;
}

/** One agent given to one player. */
export interface Assignment {
  playerId: string;
  agent: string;
  role: Role;
}

/** A person the app remembers between visits, found again by their name. */
export interface SavedPlayer {
  /** The name as it was typed, so it can be shown back with its capital letters. */
  name: string;
  excludedAgents: string[];
  bannedRoles: Role[];
}

/** Saved players, keyed by `keyForName` of their name. */
export type Roster = Record<string, SavedPlayer>;

/** Each player's recent picks, oldest first, capped at HISTORY_LIMIT. */
export type History = Record<string, Assignment[]>;

/** The most players a team can have. */
export const MAX_PLAYERS = 5;

/** How many recent rolls are remembered for each player. */
export const HISTORY_LIMIT = 10;
