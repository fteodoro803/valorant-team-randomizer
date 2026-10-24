import { AGENTS } from "../data/agents";
import { keyForName, normaliseName, playerKey } from "./roster";
import type { Assignment, Player, Role } from "./types";
import { MAX_PLAYERS, ROLES } from "./types";

/** The longest name a party member can have, so one message can't fill the host's screen. */
export const MAX_NAME_LENGTH = 20;

/** Letters and digits with nothing that looks like another (no I, L, O, 0 or 1), easy to say aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;

/** Every party is a peer on the shared broker, so the prefix keeps ours apart from other apps' ids. */
const PEER_PREFIX = "vtr-party-";

/** A new party code, such as "K7QD". */
export function newPartyCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

/** A typed code in its comparable form: capitals, with spaces and dashes dropped. */
export const normaliseCode = (typed: string): string => typed.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** True when the text could be a party code, so a typo is caught before anyone is called. */
export const isPartyCode = (typed: string): boolean => {
  const code = normaliseCode(typed);
  return code.length === CODE_LENGTH && [...code].every((char) => CODE_ALPHABET.includes(char));
};

/** The broker id a party with this code is listening on. */
export const peerIdForCode = (code: string): string => `${PEER_PREFIX}${normaliseCode(code)}`;

/** A member's bans, as they are sent and saved. */
export interface MemberBans {
  excludedAgents: string[];
  bannedRoles: Role[];
}

/** What a member's device sends to the host. */
export type ToHost =
  | ({ type: "join"; name: string } & MemberBans)
  | ({ type: "bans" } & MemberBans)
  | { type: "roll" }
  | { type: "leave" }
  | { type: "ping" };

/** The messages that are for the host to act on. A ping is answered by the connection itself. */
export type MemberMessage = Exclude<ToHost, { type: "ping" }>;

/** Shown to a friend whose party has gone while they were in it. */
export const PARTY_ENDED_MESSAGE = "The party has ended.";

/** Shown when no party is listening on the code, so the app can tell that failure from a bad connection. */
export const NO_PARTY_MESSAGE = "No party with that code. Check it with the host.";

/** One person on the team, as members see them. */
export interface TeamMember {
  name: string;
  online: boolean;
}

/** A roll as members see it: the comp, and just enough about the players to put names on the cards. */
export interface SharedRoll {
  comp: Assignment[];
  players: { id: string; name: string }[];
  id: number;
}

/** What the host sends to members. The first snapshot a member gets also means they are in. */
export type ToMember =
  | { type: "pong" }
  | { type: "removed" }
  | { type: "refused"; reason: string }
  | { type: "snapshot"; team: TeamMember[]; rolled: SharedRoll | null; error: string | null };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const agentRoles = new Map(AGENTS.map((agent) => [agent.name, agent.role]));

/** A name in the form the team keeps it: single spaces, cut to the limit. Empty means unusable. */
export const cleanName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH).trim();

/**
 * A member's bans with anything unknown dropped, or null if the lists aren't lists.
 *
 * Unknown names are dropped rather than refused, so a phone running a newer or older
 * agent list can still join.
 */
function cleanBans(value: Record<string, unknown>): MemberBans | null {
  const { excludedAgents, bannedRoles } = value;
  if (!Array.isArray(excludedAgents) || !Array.isArray(bannedRoles)) return null;
  const roles: readonly unknown[] = ROLES;
  return {
    excludedAgents: [...new Set(excludedAgents.filter((a): a is string => typeof a === "string" && agentRoles.has(a)))],
    bannedRoles: [...new Set(bannedRoles.filter((r): r is Role => roles.includes(r)))],
  };
}

/** Reads a message from a member's device, or null if it isn't one we understand. */
export function parseToHost(raw: unknown): ToHost | null {
  if (!isRecord(raw)) return null;
  if (raw.type === "roll") return { type: "roll" };
  if (raw.type === "ping") return { type: "ping" };
  if (raw.type === "leave") return { type: "leave" };
  const bans = cleanBans(raw);
  if (bans === null) return null;
  if (raw.type === "bans") return { type: "bans", ...bans };
  if (raw.type === "join" && typeof raw.name === "string") {
    const name = cleanName(raw.name);
    return name ? { type: "join", name, ...bans } : null;
  }
  return null;
}

/** A comp the host sent, or null if any pick names an agent that doesn't exist or has the wrong role. */
function parseComp(value: unknown): Assignment[] | null {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) return null;
  const comp: Assignment[] = [];
  for (const pick of value) {
    if (!isRecord(pick) || typeof pick.playerId !== "string" || typeof pick.agent !== "string") return null;
    const role = agentRoles.get(pick.agent);
    if (role === undefined || role !== pick.role) return null;
    comp.push({ playerId: pick.playerId, agent: pick.agent, role });
  }
  return comp;
}

function parseSharedRoll(value: unknown): SharedRoll | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !Array.isArray(value.players) || value.players.length > MAX_PLAYERS) return undefined;
  const comp = parseComp(value.comp);
  if (comp === null || !Number.isInteger(value.id)) return undefined;
  const players: SharedRoll["players"] = [];
  for (const p of value.players) {
    if (!isRecord(p) || typeof p.id !== "string" || typeof p.name !== "string") return undefined;
    players.push({ id: p.id, name: cleanName(p.name) });
  }
  return { comp, players, id: value.id as number };
}

/** Reads a message from the host, or null if it isn't one we understand. */
export function parseToMember(raw: unknown): ToMember | null {
  if (!isRecord(raw)) return null;
  if (raw.type === "pong") return { type: "pong" };
  if (raw.type === "removed") return { type: "removed" };
  if (raw.type === "refused" && typeof raw.reason === "string") {
    return { type: "refused", reason: raw.reason.slice(0, 200) };
  }
  if (raw.type !== "snapshot" || !Array.isArray(raw.team) || raw.team.length > MAX_PLAYERS) return null;
  const team: TeamMember[] = [];
  for (const m of raw.team) {
    if (!isRecord(m) || typeof m.name !== "string" || typeof m.online !== "boolean") return null;
    team.push({ name: cleanName(m.name), online: m.online });
  }
  const rolled = parseSharedRoll(raw.rolled);
  if (rolled === undefined) return null;
  if (raw.error !== null && typeof raw.error !== "string") return null;
  return { type: "snapshot", team, rolled, error: raw.error === null ? null : raw.error.slice(0, 300) };
}

/** The result of someone asking to join: the new team and who they are on it, or why not. */
export type Admission = { players: Player[]; playerId: string } | { refused: string };

/**
 * Puts a joining member on the team, with the bans they sent.
 *
 * 1. A member who left the tab (offline) with the same name is the same person coming back,
 *    so they take their own slot again.
 * 2. Any other name already on the team is refused, so nobody can take over a player.
 * 3. Otherwise they take the first unnamed slot, or a new one while there is room.
 */
export function admitMember(
  players: Player[],
  join: { name: string } & MemberBans,
  newId: string,
  max: number = MAX_PLAYERS,
): Admission {
  const person: Player = {
    id: newId,
    name: join.name,
    excludedAgents: [...join.excludedAgents],
    bannedRoles: [...join.bannedRoles],
    member: "online",
  };
  const existing = players.find((p) => playerKey(p) === keyForName(join.name));
  if (existing) {
    if (existing.member !== "offline") return { refused: `${join.name} is already in this party. Pick another name, or wait a moment if that was you.` };
    return {
      players: players.map((p) => (p === existing ? { ...person, id: existing.id } : p)),
      playerId: existing.id,
    };
  }
  const blank = players.findIndex((p) => normaliseName(p.name) === "" && !p.member);
  if (blank !== -1) {
    return { players: players.map((p, i) => (i === blank ? { ...person, id: p.id } : p)), playerId: players[blank].id };
  }
  if (players.length >= max) return { refused: "The party is full." };
  return { players: [...players, person], playerId: newId };
}

/**
 * Replaces a member's bans with the ones they just sent.
 *
 * Takes the two lists by name rather than spreading `bans`, because it is usually the whole
 * message, and its other fields (such as `type`) must not end up on the player.
 */
export const setMemberBans = (players: Player[], playerId: string, bans: MemberBans): Player[] =>
  players.map((p) =>
    p.id === playerId && p.member
      ? { ...p, excludedAgents: [...bans.excludedAgents], bannedRoles: [...bans.bannedRoles] }
      : p,
  );

/** Marks a member as having joined or left the tab. They stay on the team either way. */
export const setMemberStatus = (players: Player[], playerId: string, status: "online" | "offline"): Player[] =>
  players.map((p) => (p.id === playerId && p.member ? { ...p, member: status } : p));

/** Ends the party: members stay on the team as ordinary players, with their bans. */
export const endParty = (players: Player[]): Player[] => players.map(({ member: _member, ...p }) => p);

/** The named players, for members to see who is on the team. */
export const teamForMembers = (players: Player[]): TeamMember[] =>
  players
    .filter((p) => normaliseName(p.name) !== "")
    .map((p) => ({ name: p.name.trim(), online: p.member !== "offline" }));
