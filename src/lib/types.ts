export const ROLES = ["duelist", "initiator", "controller", "sentinel"] as const;
export type Role = (typeof ROLES)[number];

export interface Agent {
  name: string;
  role: Role;
}

export interface Player {
  id: string;
  name: string;
  /** Agent names this player never wants to be given. */
  excludedAgents: string[];
}

export interface Settings {
  /** Minimum agents per role in the comp. 0 turns that role's toggle off. */
  minPerRole: Record<Role, number>;
  /** When on, roles a player has had recently are less likely to come up again. */
  historyAware: boolean;
}

/** One agent given to one player. */
export interface Assignment {
  playerId: string;
  agent: string;
  role: Role;
}

/** Each player's recent picks, oldest first, capped at HISTORY_LIMIT. */
export type History = Record<string, Assignment[]>;

/** How many recent rolls are remembered for each player. */
export const HISTORY_LIMIT = 10;
