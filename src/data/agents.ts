import type { Agent, Role } from "../lib/types";

const byRole = (role: Role, names: string[]): Agent[] =>
  names.map((name) => ({ name, role }));

/** The agents of one role in alphabetical order, as the tiles list them. The role groups keep the game's order in `AGENTS`. */
export const agentsInRole = (role: Role): Agent[] =>
  AGENTS.filter((a) => a.role === role).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

/** An agent's file name without the extension: "KAY/O" becomes "kayo". */
export const agentSlug = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, "");

/** Where an agent's icon is served from (files live in public/agents). */
export const agentIconUrl = (name: string): string =>
  `${import.meta.env.BASE_URL}agents/${agentSlug(name)}.png`;

/**
 * Every playable agent, grouped by role.
 *
 * Plain data so a new agent is one name added to its role. Checked against the
 * game on 28 October 2026 (30 agents). It won't update itself.
 */
export const AGENTS: Agent[] = [
  ...byRole("duelist", ["Jett", "Phoenix", "Raze", "Reyna", "Yoru", "Neon", "Iso", "Waylay", "Hush"]),
  ...byRole("initiator", ["Sova", "Breach", "KAY/O", "Fade", "Skye", "Gekko", "Tejo"]),
  ...byRole("controller", ["Brimstone", "Viper", "Omen", "Astra", "Harbor", "Clove", "Miks"]),
  ...byRole("sentinel", ["Cypher", "Killjoy", "Sage", "Chamber", "Deadlock", "Vyse", "Veto"]),
];
