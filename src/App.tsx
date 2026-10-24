import { useEffect, useRef, useState } from "react";
import { CompResult } from "./components/CompResult";
import { HistoryView } from "./components/HistoryView";
import { Disclaimer } from "./components/Disclaimer";
import { EntryPage } from "./components/EntryPage";
import { MemberView } from "./components/MemberView";
import { PlayerList } from "./components/PlayerList";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toast } from "./components/Toast";
import type { ToastMessage } from "./components/Toast";
import { usePersistentState } from "./hooks/usePersistentState";
import { useHostParty, useMemberParty } from "./hooks/useParty";
import { useWakeLock } from "./hooks/useWakeLock";
import { createLocalHistoryStore, recordRoll } from "./lib/history";
import { fitMinimums, totalMinimums } from "./lib/minimums";
import { parsePlayers, parseRoster, parseSettings } from "./lib/parse";
import {
  admitMember,
  cleanName,
  endParty,
  NO_PARTY_MESSAGE,
  normaliseCode,
  PARTY_ENDED_MESSAGE,
  setMemberBans,
  setMemberStatus,
  teamForMembers,
} from "./lib/party";
import type { MemberMessage, SharedRoll, TeamMember } from "./lib/party";
import {
  clearLastParty,
  clearSession,
  hasOpenedCreate,
  loadLastParty,
  loadSession,
  markOpenedCreate,
  saveLastParty,
  saveSession,
  startsOnEntry,
} from "./lib/partySession";
import { RollError, rollComp } from "./lib/roll";
import {
  findDuplicateName,
  findSaved,
  forgetPlayer,
  isNamedKey,
  keepNamedHistory,
  keyForName,
  playerKey,
  rememberPlayers,
  removeFromTeam,
  toRollPlayers,
} from "./lib/roster";
import { browserStorage } from "./lib/storage";
import type { Assignment, Player, Roster, Settings } from "./lib/types";

/** How many times a device that lost its party tries to get back in, and how long it waits between tries. */
const MAX_REJOIN_TRIES = 3;
const REJOIN_DELAY_MS = 4000;

const storage = browserStorage();
const historyStore = createLocalHistoryStore(storage);

const defaultPlayers: Player[] = [1].map((n) => ({
  id: `player-${n}`,
  name: "",
  excludedAgents: [],
  bannedRoles: [],
}));

const defaultSettings: Settings = {
  minPerRole: { duelist: 0, initiator: 0, controller: 0, sentinel: 0 },
  historyAware: true,
};

/** A finished roll and the players it was rolled for, so names on the cards don't change if the form is edited. */
interface RolledComp {
  comp: Assignment[];
  players: Player[];
  /** Counts up with every roll, so the cards are drawn fresh and the reveal plays again. */
  id: number;
  /** True once Lock in has saved this comp to history. A new roll starts unlocked. */
  locked: boolean;
}

export default function App() {
  const [players, setPlayers] = usePersistentState(storage, "valorant-randomizer-players", defaultPlayers, parsePlayers);
  const [settings, setSettings] = usePersistentState(storage, "valorant-randomizer-settings", defaultSettings, parseSettings);
  const [roster, setRoster] = usePersistentState<Roster>(storage, "valorant-randomizer-saved-players", {}, parseRoster);
  // History filed under old player slots can't be tied to anyone, so it is dropped on load (D8).
  const [history, setHistory] = useState(() => keepNamedHistory(historyStore.load()));
  const [rolled, setRolled] = useState<RolledComp | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Counts every press of Roll, successful or not, so the page can scroll to what it produced.
  const [rollPresses, setRollPresses] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Party state. A member's page shows what the host last sent (`shared`) and their own details (`me`).
  // The entry page opens first, unless this device is in a party or has opened Create before.
  const [screen, setScreen] = useState<"entry" | "main">(() =>
    startsOnEntry(loadSession(storage) !== null, hasOpenedCreate(storage)) ? "entry" : "main",
  );
  // What was typed into the join form, kept while the join is tried, so a mistyped code doesn't cost the name.
  const [attempt, setAttempt] = useState<{ name: string; code: string } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastCount = useRef(0);
  // Errors wait to be closed so they can't vanish before they are read. Other messages fade by themselves.
  const notify = (text: string, tone: "error" | "info" = "info", sticky: boolean = tone === "error") => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, text, tone, sticky });
  };
  const closeToast = (id: number) => setToast((current) => (current?.id === id ? null : current));
  const [me, setMe] = useState<Player | null>(null);
  // How many times this device has tried to get back into its party, and whether it wants to try now.
  const [rejoinTries, setRejoinTries] = useState(0);
  const [wantRejoin, setWantRejoin] = useState(false);
  // The last party joined, kept after leaving so the join form can start filled in.
  const [lastParty, setLastParty] = useState(() => loadLastParty(storage));
  const [shared, setShared] = useState<{ team: TeamMember[]; rolled: SharedRoll | null; error: string | null } | null>(
    null,
  );

  // The newest team, roster, history, settings and roll, kept current as soon as a handler changes them.
  // Messages from party members arrive outside React's renders, so reading state from the render
  // that created the handler could miss the message just before it.
  const live = useRef({ players, roster, history, settings, rolled });
  useEffect(() => {
    live.current = { players, roster, history, settings, rolled };
  });
  const commitPlayers = (next: Player[]) => {
    live.current.players = next;
    setPlayers(next);
  };
  const commitRoster = (next: Roster) => {
    live.current.roster = next;
    setRoster(next);
  };

  // The host's end of a party. Members' bans are saved to this device's roster by name, so a member
  // who leaves the tab keeps their last bans and still gets an agent.
  const host = useHostParty({
    onMessage: (peerId, message) => handleMemberMessage(peerId, message),
    onLeave: (playerId) => commitPlayers(setMemberStatus(live.current.players, playerId, "offline")),
  });

  // The member's end of a party.
  const member = useMemberParty({
    onMessage: (snapshot) => setShared({ team: snapshot.team, rolled: snapshot.rolled, error: snapshot.error }),
    // The host took this member off the team, so the device must not rejoin by itself.
    onRemoved: () => {
      clearSession(storage);
      setRejoinTries(0);
      setWantRejoin(false);
      setShared(null);
      setMe(null);
      setScreen("entry");
      notify("The host removed you from the party.");
    },
    // The connection went quiet or the host left. The device tries to get back in (see below).
    onEnded: () => {
      setShared(null);
      setScreen("entry");
      notify("Connection lost. Reconnecting to the party…", "info", true);
      setWantRejoin(true);
    },
  });
  useWakeLock(host.status === "open");
  const memberActive = member.status === "connecting" || member.status === "joined";

  // Problems starting a party (the service that sets them up can't be reached) show as a toast.
  useEffect(() => {
    if (host.error) notify(host.error, "error");
    // `notify` is remade every render, and only a new error should show a message.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [host.error]);

  // The Roll button is pinned to the bottom on phones, so a roll can happen while the comp is
  // scrolled out of view. Bring the result (or the error) back so the press is never silent,
  // but leave the page alone when the result is already near the top of the screen.
  useEffect(() => {
    const result = resultRef.current;
    if (rollPresses === 0 || !result) return;
    const { top } = result.getBoundingClientRect();
    if (top >= 0 && top < window.innerHeight / 2) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    result.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [rollPresses]);

  // 1. Check names, 2. roll, 3. show it, unlocked. A roll only picks a comp: history is written
  //    when the host locks it in, so rerolling doesn't skew it (D26). Reads the newest state through `live`.
  const roll = () => {
    setRollPresses((n) => n + 1);
    const { players, roster, history, settings, rolled } = live.current;
    const duplicate = findDuplicateName(players);
    if (duplicate) {
      setError(`Two players are both called ${duplicate}. Give them different names.`);
      return;
    }
    try {
      const rollPlayers = toRollPlayers(players);
      const comp = rollComp(rollPlayers, settings, history);
      const nextRolled = { comp, players: rollPlayers, id: (rolled?.id ?? 0) + 1, locked: false };
      live.current.rolled = nextRolled;
      setRolled(nextRolled);
      setError(null);
      commitRoster(rememberPlayers(roster, players));
    } catch (e) {
      if (!(e instanceof RollError)) throw e;
      setError(e.message);
    }
  };

  // Saves the shown comp to history, once. Only named players who are still on the team count, since an
  // unnamed slot has no one to remember (D10) and someone removed after the roll shouldn't come back.
  const lockIn = () => {
    const { players, history, rolled } = live.current;
    if (!rolled || rolled.locked) return;
    const onTeam = new Set(players.map(playerKey));
    const picks = rolled.comp.filter((pick) => isNamedKey(pick.playerId) && onTeam.has(pick.playerId));
    const nextHistory = recordRoll(history, picks);
    const nextRolled = { ...rolled, locked: true };
    live.current.rolled = nextRolled;
    live.current.history = nextHistory;
    setRolled(nextRolled);
    setHistory(nextHistory);
    historyStore.save(nextHistory);
  };

  const clearHistory = () => {
    setHistory({});
    historyStore.save({});
  };

  // Remove keeps the person's saved details and history, forgetting deletes them (D9).
  const removePlayer = (player: Player, forgetThem: boolean) => {
    // Read from `live`, since a friend leaving the party arrives here from a message, not a render.
    const { players, roster, history, settings } = live.current;
    // A party member who is removed is also disconnected, so they can't keep sending bans.
    if (player.member) host.kick(player.id);
    const removed = removeFromTeam(players, roster, history, player, forgetThem);
    // A friend leaving can empty the team, which always keeps one blank slot to type a name into.
    const next =
      removed.players.length === 0
        ? { ...removed, players: [{ id: crypto.randomUUID(), name: "", excludedAgents: [], bannedRoles: [] }] }
        : removed;
    commitPlayers(next.players);
    commitRoster(next.roster);
    // With fewer players the role minimums may no longer fit, so lower them to match.
    const fitted = fitMinimums(settings.minPerRole, next.players.length);
    if (totalMinimums(fitted) !== totalMinimums(settings.minPerRole)) {
      setSettings({ ...settings, minPerRole: fitted });
    }
    if (next.history !== history) {
      setHistory(next.history);
      historyStore.save(next.history);
    }
  };

  const forget = (key: string) => {
    const next = forgetPlayer(roster, history, key);
    commitRoster(next.roster);
    setHistory(next.history);
    historyStore.save(next.history);
  };

  // 1. A new device must send a join first. It is refused if the name is taken or the team is full.
  // 2. Later, its bans replace the member's bans and are saved to the roster (so they survive the
  //    member leaving). Only the host rolls and locks in, so a member sends nothing else.
  function handleMemberMessage(peerId: string, message: MemberMessage) {
    if (message.type === "join") {
      // A member who has gone quiet is probably this same person coming back from sleep, so their name
      // is freed up. Someone who is still answering keeps it, and a second person using it is refused.
      let team = live.current.players;
      const sameName = team.find((p) => p.member === "online" && playerKey(p) === keyForName(message.name));
      if (sameName && host.isQuiet(sameName.id)) team = setMemberStatus(team, sameName.id, "offline");
      const result = admitMember(team, message, crypto.randomUUID());
      if ("refused" in result) {
        host.send(peerId, { type: "refused", reason: result.refused });
        host.drop(peerId);
        return;
      }
      host.admit(peerId, result.playerId);
      commitPlayers(result.players);
      commitRoster(rememberPlayers(live.current.roster, result.players.filter((p) => p.id === result.playerId)));
      return;
    }
    const playerId = host.playerOf(peerId);
    if (playerId === null) return;
    if (message.type === "leave") {
      // They left on purpose, so unlike a dropped connection they come off the team (their bans stay saved).
      const leaver = live.current.players.find((p) => p.id === playerId);
      if (leaver) removePlayer(leaver, false);
      return;
    }
    const next = setMemberBans(live.current.players, playerId, message);
    commitPlayers(next);
    commitRoster(rememberPlayers(live.current.roster, next.filter((p) => p.id === playerId)));
  }

  // Everyone in the party is sent the whole picture whenever it changes, rather than a list of edits,
  // so a member who joins late or reconnects needs nothing special to catch up.
  useEffect(() => {
    if (host.status !== "open") return;
    host.broadcast({
      type: "snapshot",
      team: teamForMembers(players),
      rolled: rolled && {
        comp: rolled.comp,
        players: rolled.players.map(({ id, name }) => ({ id, name })),
        id: rolled.id,
        locked: rolled.locked,
      },
      error,
    });
    // `host` changes every render, so listing it would resend on every render instead of on every change.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [host.status, players, rolled, error]);

  const stopParty = () => {
    host.stop();
    commitPlayers(endParty(players));
  };

  // Starts a join. A typed code and a rejoin after sleep go through here the same way.
  const startJoin = (code: string, typedName: string) => {
    const name = cleanName(typedName);
    const saved = findSaved(live.current.roster, name);
    setShared(null);
    setMe({
      id: "me",
      name: saved?.name ?? name,
      excludedAgents: saved?.excludedAgents ?? [],
      bannedRoles: saved?.bannedRoles ?? [],
    });
    member.join(code, {
      type: "join",
      name: saved?.name ?? name,
      excludedAgents: saved?.excludedAgents ?? [],
      bannedRoles: saved?.bannedRoles ?? [],
    });
  };

  const joinParty = (code: string, typedName: string) => {
    setToast(null);
    setAttempt({ name: typedName, code });
    setRejoinTries(0);
    saveSession(storage, normaliseCode(code), cleanName(typedName));
    saveLastParty(storage, normaliseCode(code), cleanName(typedName));
    setLastParty(loadLastParty(storage));
    startJoin(code, typedName);
  };

  // A device that was in a party and lost it (it slept, the signal dropped, the page was refreshed)
  // goes back in by itself with the code and name it remembered. It waits until the tab is in front,
  // tries a few times, and stops if the code no longer belongs to a party.
  useEffect(() => {
    if (loadSession(storage)) setWantRejoin(true);
  }, []);

  useEffect(() => {
    if (!wantRejoin) return;
    const attempt = () => {
      if (document.visibilityState !== "visible") return;
      setWantRejoin(false);
      const session = loadSession(storage);
      if (!session) return;
      setRejoinTries((n) => n + 1);
      notify("Reconnecting to the party…", "info", true);
      startJoin(session.code, session.name);
    };
    attempt();
    document.addEventListener("visibilitychange", attempt);
    return () => document.removeEventListener("visibilitychange", attempt);
    // `startJoin` is remade every render and only the newest one is wanted, so it is not listed.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [wantRejoin]);

  useEffect(() => {
    if (member.status === "joined") {
      // Being in the party starts the three hours again.
      const session = loadSession(storage);
      if (session) saveLastParty(storage, session.code, session.name);
      setLastParty(loadLastParty(storage));
      setRejoinTries(0);
      setToast(null);
      setAttempt(null);
      return;
    }
    if (member.status !== "error") return;
    const retrying = rejoinTries > 0;
    const gone = member.error === NO_PARTY_MESSAGE;
    if (!loadSession(storage)) {
      if (member.error) notify(member.error, "error");
      return;
    }
    // A rejoin is tried again, until the party is gone or the tries run out.
    if (retrying && !gone && rejoinTries < MAX_REJOIN_TRIES) {
      const timer = setTimeout(() => setWantRejoin(true), REJOIN_DELAY_MS);
      return () => clearTimeout(timer);
    }
    // Giving up: a typed join that failed, a party that is gone, or a rejoin that ran out of tries.
    // A code with no party behind it is no use to offer again, whether it was mistyped or the party ended.
    if (gone || !retrying) {
      clearLastParty(storage);
      setLastParty(null);
    }
    clearSession(storage);
    setRejoinTries(0);
    if (retrying && gone) notify(PARTY_ENDED_MESSAGE);
    else if (member.error) notify(member.error, "error");
    // Runs when the connection's state changes, not when the try counter does, or each try would start another.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [member.status]);

  const changeMyBans = (patch: Partial<Player>) => {
    if (!me) return;
    const next = { ...me, ...patch };
    setMe(next);
    commitRoster(rememberPlayers(live.current.roster, [next]));
    member.send({ type: "bans", excludedAgents: next.excludedAgents, bannedRoles: next.bannedRoles });
  };

  const leaveParty = () => {
    clearSession(storage);
    setRejoinTries(0);
    setWantRejoin(false);
    setToast(null);
    member.leave();
    setShared(null);
    setMe(null);
    setScreen("entry");
  };

  // Create opens the main page, and remembers it so the entry page stops greeting this device.
  const create = () => {
    markOpenedCreate(storage);
    setScreen("main");
  };

  // A friend's page. It has no Roll bar, so the toast can sit lower.
  if (memberActive && me) {
    return (
      <>
        <MemberView
          me={me}
          code={lastParty?.code ?? attempt?.code ?? ""}
          status={member.status}
          step={member.step}
          shared={shared}
          onChange={changeMyBans}
          onLeave={leaveParty}
        />
        <Toast toast={toast} low onClose={closeToast} />
      </>
    );
  }

  // The entry page has no Roll bar, so the toast can sit lower.
  if (screen === "entry") {
    return (
      <>
        <EntryPage last={lastParty} initial={attempt} onCreate={create} onJoin={joinParty} />
        <Toast toast={toast} low onClose={closeToast} />
      </>
    );
  }

  return (
    <main className="app">
      {/* Header: title on the left, Roll and Lock in on the right on wide screens and pinned to the bottom on phones */}
      <header className="app-head">
        <div>
          <div className="head-links">
            {/* The portfolio's Lab page is one level up from where this is served (D14). */}
            <a className="back-link" href="../">
              ← Back to Projects
            </a>
            <button type="button" className="menu-link" onClick={() => setScreen("entry")}>
              Menu
            </button>
          </div>
          <h1>Team randomiser</h1>
        </div>
        <div className="roll-bar">
          <button type="button" className="roll" onClick={roll}>
            Roll
          </button>
          <button type="button" className="roll lock" disabled={!rolled || rolled.locked} onClick={lockIn}>
            {rolled?.locked ? "Locked in" : "Lock in"}
          </button>
        </div>
      </header>

      {/* Result: the error, the comp, or a prompt before the first roll */}
      <div ref={resultRef} className="result">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {rolled ? (
          <CompResult comp={rolled.comp} players={rolled.players} rollId={rolled.id} locked={rolled.locked} />
        ) : (
          <p className="empty">Press Roll to give everyone an agent for the next game.</p>
        )}
      </div>

      <div className="columns">
        <PlayerList
          players={players}
          roster={roster}
          onChange={commitPlayers}
          onRemove={removePlayer}
          onForget={forget}
          party={{
            code: host.code,
            status: host.status,
            onStart: host.start,
            onStop: stopParty,
          }}
        />
        <SettingsPanel settings={settings} playerCount={players.length} onChange={setSettings} />
      </div>
      <HistoryView players={toRollPlayers(players)} history={history} onClear={clearHistory} />

      <Disclaimer />
      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}
