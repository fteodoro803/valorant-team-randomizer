import { useEffect, useRef, useState } from "react";
import { HistoryView } from "./components/HistoryView";
import { Disclaimer } from "./components/Disclaimer";
import { EntryPage } from "./components/EntryPage";
import { HomeButton } from "./components/HomeButton";
import { MemberView } from "./components/MemberView";
import { RollBar } from "./components/RollBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { StopPartyDialog } from "./components/StopPartyDialog";
import { TeamCards } from "./components/TeamCards";
import { Toast } from "./components/Toast";
import type { ToastMessage } from "./components/Toast";
import { usePersistentState } from "./hooks/usePersistentState";
import { useHostParty, useMemberParty } from "./hooks/useParty";
import { useWakeLock } from "./hooks/useWakeLock";
import { assignPick } from "./lib/assign";
import { createLocalHistoryStore, recordRoll } from "./lib/history";
import { fitMinimums, totalMinimums } from "./lib/minimums";
import { parsePlayers, parseRoster, parseSettings, parseTeammates } from "./lib/parse";
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
  loadLastParty,
  loadSession,
  saveLastParty,
  saveSession,
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
import { slotsForPlayers, takenPicks, teamSize } from "./lib/teammates";
import type { Assignment, Player, Roster, Settings, Teammate } from "./lib/types";

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

const defaultTeammates: Teammate[] = [];

const defaultSettings: Settings = {
  minPerRole: { duelist: 0, initiator: 0, controller: 0, sentinel: 0 },
  historyAware: true,
};

/** A finished roll and the players it was rolled for. The cards match players to it by their roll key. */
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
  const [teammates, setTeammates] = usePersistentState(storage, "valorant-randomizer-teammates", defaultTeammates, parseTeammates);
  const [settings, setSettings] = usePersistentState(storage, "valorant-randomizer-settings", defaultSettings, parseSettings);
  const [roster, setRoster] = usePersistentState<Roster>(storage, "valorant-randomizer-saved-players", {}, parseRoster);
  // History filed under old player slots can't be tied to anyone, so it is dropped on load (D8).
  const [history, setHistory] = useState(() => keepNamedHistory(historyStore.load()));
  const [rolled, setRolled] = useState<RolledComp | null>(null);
  // Players whose picks are locked, so Roll leaves them alone (D27). Kept across rerolls until Lock in or New.
  const [kept, setKept] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Counts every press of Roll, successful or not, so the page can scroll to what it produced.
  const [rollPresses, setRollPresses] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  // Party state. A member's page shows what the host last sent (`shared`) and their own details (`me`).
  // The entry page always opens first, so Home is the one way to switch between hosting and joining.
  const [screen, setScreen] = useState<"entry" | "main">("entry");
  // True while Home is asking whether to end a party that friends are still in.
  const [confirmingHome, setConfirmingHome] = useState(false);
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
  const [shared, setShared] = useState<{
    team: TeamMember[];
    teammates: string[];
    rolled: SharedRoll | null;
    error: string | null;
  } | null>(null);

  // The newest team, roster, history, settings and roll, kept current as soon as a handler changes them.
  // Messages from party members arrive outside React's renders, so reading state from the render
  // that created the handler could miss the message just before it.
  const live = useRef({ players, teammates, roster, history, settings, rolled, kept });
  useEffect(() => {
    live.current = { players, teammates, roster, history, settings, rolled, kept };
  });
  const commitPlayers = (next: Player[]) => {
    live.current.players = next;
    setPlayers(next);
  };
  // Random teammates change the size the role minimums can cover, so the minimums are lowered to fit.
  const commitTeammates = (next: Teammate[]) => {
    live.current.teammates = next;
    setTeammates(next);
    const { players, settings } = live.current;
    const fitted = fitMinimums(settings.minPerRole, teamSize(players, next));
    if (totalMinimums(fitted) !== totalMinimums(settings.minPerRole)) {
      setSettings({ ...settings, minPerRole: fitted });
    }
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
    onMessage: (snapshot) =>
      setShared({ team: snapshot.team, teammates: snapshot.teammates, rolled: snapshot.rolled, error: snapshot.error }),
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
  //    when the host locks it in, so rerolling doesn't skew it (D26). If some players' picks are
  //    locked (D27) and the comp isn't locked in yet, only the others are rolled. Random teammates'
  //    agents are worked around, not rolled. Reads the newest state through `live`.
  const roll = () => {
    setRollPresses((n) => n + 1);
    const { players, teammates, roster, history, settings, rolled, kept } = live.current;
    const duplicate = findDuplicateName(players);
    if (duplicate) {
      setError(`Two players are both called ${duplicate}. Give them different names.`);
      return;
    }
    try {
      const rollPlayers = toRollPlayers(players);
      const keptNow = rolled && !rolled.locked ? kept.filter((id) => rollPlayers.some((p) => p.id === id)) : [];
      const others = takenPicks(teammates);
      const comp = rollComp(
        rollPlayers,
        settings,
        history,
        undefined,
        undefined,
        keptNow.length > 0 && rolled ? { current: rolled.comp, keptIds: keptNow } : undefined,
        others,
      );
      const nextRolled = { comp, players: rollPlayers, id: (rolled?.id ?? 0) + 1, locked: false };
      live.current.rolled = nextRolled;
      setRolled(nextRolled);
      // A lock whose pick was dropped (it clashed with a random teammate's agent) is gone with it.
      if (rolled) {
        const agentOf = (picks: Assignment[], id: string) => picks.find((c) => c.playerId === id)?.agent;
        const stillKept = keptNow.filter((id) => agentOf(comp, id) === agentOf(rolled.comp, id));
        if (stillKept.length !== keptNow.length) {
          live.current.kept = stillKept;
          setKept(stillKept);
        }
      }
      setError(null);
      commitRoster(rememberPlayers(roster, players));
    } catch (e) {
      if (!(e instanceof RollError)) throw e;
      setError(e.message);
    }
  };

  // Locking a player's pick keeps it through the next Roll. Only a comp that isn't locked in yet can be edited this way.
  const toggleKept = (playerId: string) => {
    if (!live.current.rolled || live.current.rolled.locked) return;
    const next = live.current.kept.includes(playerId)
      ? live.current.kept.filter((id) => id !== playerId)
      : [...live.current.kept, playerId];
    live.current.kept = next;
    setKept(next);
  };

  const clearKept = () => {
    live.current.kept = [];
    setKept([]);
  };

  // Gives a player an agent by hand and locks it, so Roll leaves it alone (D36). It works before the first
  // roll too: the comp then holds only the assigned picks, and Roll fills in the rest. The player's old
  // pick is replaced, and the role counts toward the minimums like any locked pick.
  const assignAgent = (rollId: string, agent: string) => {
    const { players, rolled, kept } = live.current;
    if (rolled?.locked) return;
    const rollPlayers = toRollPlayers(players);
    const comp = assignPick(
      rolled?.comp ?? [],
      rollPlayers.map((p) => p.id),
      rollId,
      agent,
    );
    if (!comp) return;
    const nextRolled = { comp, players: rollPlayers, id: rolled?.id ?? 0, locked: false };
    live.current.rolled = nextRolled;
    setRolled(nextRolled);
    if (!kept.includes(rollId)) {
      live.current.kept = [...kept, rollId];
      setKept(live.current.kept);
    }
    setError(null);
  };

  // Saves the shown comp to history, once. Only named players who are still on the team count, since an
  // unnamed slot has no one to remember (D10) and someone removed after the roll shouldn't come back.
  const lockIn = () => {
    const { players, history, rolled } = live.current;
    if (!rolled || rolled.locked) return;
    // A comp that holds only the assigned picks isn't a game yet: everyone needs an agent first.
    if (!toRollPlayers(players).every((p) => rolled.comp.some((c) => c.playerId === p.id))) return;
    const onTeam = new Set(players.map(playerKey));
    const picks = rolled.comp.filter((pick) => isNamedKey(pick.playerId) && onTeam.has(pick.playerId));
    const nextHistory = recordRoll(history, picks);
    const nextRolled = { ...rolled, locked: true };
    live.current.rolled = nextRolled;
    live.current.history = nextHistory;
    setRolled(nextRolled);
    setHistory(nextHistory);
    historyStore.save(nextHistory);
    // The next game starts with nobody locked.
    clearKept();
  };

  // After a game is locked in, New starts the next one: the cards go back to waiting, locks and any
  // error are dropped, and the random teammates are removed, since they belonged to that game (D35).
  // Players stay, and the locked-in roll stays in history. Friends follow, as they see the host's team.
  const newGame = () => {
    live.current.rolled = null;
    setRolled(null);
    clearKept();
    setError(null);
    commitTeammates([]);
  };

  const clearHistory = () => {
    setHistory({});
    historyStore.save({});
  };

  // Remove keeps the person's saved details and history, forgetting deletes them (D9).
  const removePlayer = (player: Player, forgetThem: boolean) => {
    // Read from `live`, since a friend leaving the party arrives here from a message, not a render.
    const { players, teammates, roster, history, settings } = live.current;
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
    const fitted = fitMinimums(settings.minPerRole, teamSize(next.players, teammates));
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
      const result = admitMember(team, message, crypto.randomUUID(), slotsForPlayers(live.current.teammates));
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
      teammates: takenPicks(teammates).map((t) => t.agent),
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
  }, [host.status, players, teammates, rolled, error]);

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

  const create = () => setScreen("main");

  // Home ends any party this device is hosting, since a party only lives on the main page. It asks first
  // when friends are connected, because one tap would otherwise end their game.
  const friendsInParty = players.filter((p) => p.member === "online").length;
  const goHome = () => {
    if (host.status === "idle") return setScreen("entry");
    if (friendsInParty > 0) return setConfirmingHome(true);
    stopParty();
    setScreen("entry");
  };
  const stopAndGoHome = () => {
    setConfirmingHome(false);
    stopParty();
    setScreen("entry");
  };

  // A friend's page. It has no Roll bar, so the toast can sit lower.
  // Locked players who are still on the team, and whether that is everyone, in which case there is nothing to roll.
  const rollPlayerIds = toRollPlayers(players).map((p) => p.id);
  const keptShown = rolled && !rolled.locked ? kept.filter((id) => rollPlayerIds.includes(id)) : [];
  const allKept = keptShown.length > 0 && rollPlayerIds.every((id) => keptShown.includes(id));
  // Whether every player has an agent, by roll or by hand. Lock in waits for this.
  const everyoneHasAgent = rolled !== null && rollPlayerIds.every((id) => rolled.comp.some((c) => c.playerId === id));

  // The same Roll and Lock in, drawn where CSS wants them (see RollBar).
  const rollBar = (className: string) => (
    <RollBar
      className={className}
      rolled={rolled !== null}
      locked={rolled?.locked ?? false}
      everyoneHasAgent={everyoneHasAgent}
      allKept={allKept}
      onRoll={roll}
      onLockIn={lockIn}
      onNew={newGame}
    />
  );

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
      {/* Header: Home, the title, the party code and the party button on one row. Roll and Lock in join it on a tablet and are pinned to the bottom on phones. A desktop has them in the Rules panel. */}
      <header className="app-head app-head-main">
        <div className="app-head-title">
          <HomeButton label="Home" onClick={goHome} />
          <h1>Team randomiser</h1>
          {/* The brackets sit outside the inner span so a tap selects just the code, ready to copy */}
          {host.code && (
            <span className="party-code-tag">
              (<span className="party-code-text">{host.code}</span>)
            </span>
          )}
        </div>
        {/* One button that is Start a party until a party is open and Stop party after, so nothing shifts */}
        <div className="panel-actions">
          {host.status === "open" ? (
            <button type="button" className="ghost" onClick={stopParty}>
              Stop party
            </button>
          ) : (
            <button type="button" className="ghost start-party" disabled={host.status === "connecting"} onClick={host.start}>
              {host.status === "connecting" ? "Starting…" : "Start a party"}
            </button>
          )}
        </div>
        {rollBar("roll-bar-head")}
      </header>

      {/* Result: the error, then the team's five cards, which are the comp once it is rolled */}
      <div ref={resultRef} className="result">
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <TeamCards
          players={players}
          teammates={teammates}
          roster={roster}
          comp={rolled?.comp ?? null}
          locked={rolled?.locked ?? false}
          kept={keptShown}
          onPlayersChange={commitPlayers}
          onTeammatesChange={commitTeammates}
          onRemove={removePlayer}
          onForget={forget}
          onToggleKept={toggleKept}
          onAssign={assignAgent}
        />
      </div>

      <div className="columns">
        <SettingsPanel
          settings={settings}
          playerCount={teamSize(players, teammates)}
          onChange={setSettings}
          aside={rollBar("roll-bar-rules")}
        />
      </div>
      <HistoryView players={toRollPlayers(players)} history={history} onClear={clearHistory} />

      <Disclaimer />
      <Toast toast={toast} onClose={closeToast} />
      {confirmingHome && (
        <StopPartyDialog friends={friendsInParty} onStop={stopAndGoHome} onCancel={() => setConfirmingHome(false)} />
      )}
    </main>
  );
}
