import type { History, Player, Roster, SavedPlayer } from "./types";
import { MAX_PLAYERS } from "./types";

const NAMED = "name:";

/** A name in its comparable form: trimmed, single spaces, no capital letters. */
export const normaliseName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/** The key a named person's saved details and history are filed under. */
export const keyForName = (name: string): string => `${NAMED}${normaliseName(name)}`;

/** True for keys made from a name, false for the throwaway keys of unnamed slots. */
export const isNamedKey = (key: string): boolean => key.startsWith(NAMED);

/** A player's key: their name if they have one, otherwise their slot, which is never saved. */
export const playerKey = (player: Player): string =>
  normaliseName(player.name) ? keyForName(player.name) : `slot:${player.id}`;

/** The players as the roller wants them, with each id swapped for the player's key. */
export const toRollPlayers = (players: Player[]): Player[] =>
  players.map((player) => ({ ...player, id: playerKey(player) }));

/**
 * Puts a saved person on the team, with their bans.
 *
 * They take the first unnamed slot if there is one, otherwise a new slot.
 * Returns null when the team is full. Someone already on the team is left as they are.
 */
export function addSavedToTeam(
  players: Player[],
  saved: SavedPlayer,
  newId: string,
  max: number = MAX_PLAYERS,
): Player[] | null {
  if (players.some((p) => playerKey(p) === keyForName(saved.name))) return players;
  const person = {
    name: saved.name,
    excludedAgents: [...saved.excludedAgents],
    bannedRoles: [...saved.bannedRoles],
  };
  const blank = players.findIndex((p) => normaliseName(p.name) === "");
  if (blank !== -1) return players.map((p, i) => (i === blank ? { ...p, ...person } : p));
  if (players.length >= max) return null;
  return [...players, { id: newId, ...person }];
}

/** The saved person with this name, if there is one. */
export const findSaved = (roster: Roster, name: string) => roster[keyForName(name)];

/** The first name used by two players, as typed, or null if every name is different. */
export function findDuplicateName(players: Player[]): string | null {
  const seen = new Set<string>();
  for (const player of players) {
    const key = playerKey(player);
    if (!isNamedKey(key)) continue;
    if (seen.has(key)) return player.name.trim();
    seen.add(key);
  }
  return null;
}

/** Saves every named player's name and bans, replacing what was saved before. */
export function rememberPlayers(roster: Roster, players: Player[]): Roster {
  const next = { ...roster };
  for (const player of players) {
    const key = playerKey(player);
    if (!isNamedKey(key)) continue;
    next[key] = {
      name: player.name.trim(),
      excludedAgents: [...player.excludedAgents],
      bannedRoles: [...player.bannedRoles],
    };
  }
  return next;
}

/** Removes a saved person and their history. Returns new objects. */
export function forgetPlayer(
  roster: Roster,
  history: History,
  key: string,
): { roster: Roster; history: History } {
  const { [key]: _savedPlayer, ...restRoster } = roster;
  const { [key]: _pastPicks, ...restHistory } = history;
  return { roster: restRoster, history: restHistory };
}

/**
 * Takes a player off the team.
 *
 * Without `forget`, a named person's current exclusions are saved first so
 * nothing typed since the last roll is lost, and their history stays, ready
 * for when they're added back. With `forget`, their saved details and history
 * are deleted too. An unnamed slot has nothing saved, so it is just removed.
 */
export function removeFromTeam(
  players: Player[],
  roster: Roster,
  history: History,
  player: Player,
  forget: boolean,
): { players: Player[]; roster: Roster; history: History } {
  const rest = players.filter((p) => p.id !== player.id);
  const key = playerKey(player);
  if (!isNamedKey(key)) return { players: rest, roster, history };
  if (forget) return { players: rest, ...forgetPlayer(roster, history, key) };
  return { players: rest, roster: rememberPlayers(roster, [player]), history };
}

/** Drops history that isn't filed under a name, such as picks saved against old player slots. */
export function keepNamedHistory(history: History): History {
  return Object.fromEntries(Object.entries(history).filter(([key]) => isNamedKey(key)));
}
