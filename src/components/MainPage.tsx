import { useEffect, useMemo, useRef, useState } from "react";
import { HistoryView } from "./HistoryView";
import { Disclaimer } from "./Disclaimer";
import { HomeButton } from "./HomeButton";
import { RollBar } from "./RollBar";
import { SettingsPanel } from "./SettingsPanel";
import { StopPartyDialog } from "./StopPartyDialog";
import { TeamCards } from "./TeamCards";
import { Toast } from "./Toast";
import type { ToastMessage } from "./Toast";
import { usePersistentState } from "../hooks/usePersistentState";
import { useHostParty } from "../hooks/useParty";
import { useWakeLock } from "../hooks/useWakeLock";
import { assignPick } from "../lib/assign";
import { createLocalHistoryStore, recordRoll } from "../lib/history";
import { fitMaximums, totalMaximums } from "../lib/minimums";
import { parsePlayers, parseSettings, parseTeammates } from "../lib/parse";
import { joinLink } from "../lib/route";
import { admitMember, endParty, setMemberBans, setMemberStatus, teamForMembers } from "../lib/party";
import type { MemberMessage } from "../lib/party";
import { RollError, rollComp } from "../lib/roll";
import {
  findDuplicateName,
  forgetPlayer,
  isNamedKey,
  keepNamedHistory,
  keyForName,
  playerKey,
  rememberPlayers,
  removeFromTeam,
  toRollPlayers,
} from "../lib/roster";
import type { KeyValueStorage } from "../lib/storage";
import { slotsForPlayers, takenPicks, teamSize } from "../lib/teammates";
import type { Assignment, Player, Roster, Settings, Teammate } from "../lib/types";
import { MAX_PLAYERS } from "../lib/types";

const defaultPlayers: Player[] = [1].map((n) => ({
  id: `player-${n}`,
  name: "",
  excludedAgents: [],
  bannedRoles: [],
}));

const defaultTeammates: Teammate[] = [];

const defaultSettings: Settings = {
  minPerRole: { duelist: 0, initiator: 0, controller: 0, sentinel: 0 },
  maxPerRole: { duelist: MAX_PLAYERS, initiator: MAX_PLAYERS, controller: MAX_PLAYERS, sentinel: MAX_PLAYERS },
  ruleOn: { duelist: false, initiator: false, controller: false, sentinel: false },
  historyAware: true,
  agentHistoryAware: true,
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

/** Shows a message in the toast. Errors stay until closed, the rest fade by themselves. */
export type Notify = (text: string, tone?: "error" | "info", sticky?: boolean) => void;

interface Props {
  /** False while the entry page or a friend's page is showing. The page stays mounted, so a roll in progress is still there when the host comes back. */
  active: boolean;
  storage: KeyValueStorage;
  /** The saved people, owned by the app because a friend's page edits them too. */
  roster: Roster;
  onRosterChange: (next: Roster) => void;
  toast: ToastMessage | null;
  notify: Notify;
  onCloseToast: (id: number) => void;
  /** Back to the entry page, once any party this device hosts has been stopped. */
  onHome: () => void;
  /** Filled with the question Back asks, which is Home's: true when leaving is fine, false while the dialog asks first. */
  leaveRef: { current: () => boolean };
}

/**
 * The host's page: the team's five cards, the rules, Roll and Lock in, history, and the party.
 *
 * Everything the host does lives here, including the end of a party this device hosts, since a party only
 * lives on this page (D29). The app above holds only what the pages share: which page shows, the saved
 * people, the toast, and a friend's end of a party. The page renders nothing while another page shows but
 * stays mounted, so Home and Host again doesn't lose the comp that was rolled.
 */
export function MainPage({ active, storage, roster, onRosterChange, toast, notify, onCloseToast, onHome, leaveRef }: Props) {
  const historyStore = useMemo(() => createLocalHistoryStore(storage), [storage]);
  const [players, setPlayers] = usePersistentState(storage, "valorant-randomizer-players", defaultPlayers, parsePlayers);
  const [teammates, setTeammates] = usePersistentState(storage, "valorant-randomizer-teammates", defaultTeammates, parseTeammates);
  const [settings, setSettings] = usePersistentState(storage, "valorant-randomizer-settings", defaultSettings, parseSettings);
  // History filed under old player slots can't be tied to anyone, so it is dropped on load (D8).
  const [history, setHistory] = useState(() => keepNamedHistory(historyStore.load()));
  const [rolled, setRolled] = useState<RolledComp | null>(null);
  // Players whose picks are locked, so Roll leaves them alone (D27). Kept across rerolls until Lock in or New.
  const [kept, setKept] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Counts every press of Roll, successful or not, so the page can scroll to what it produced.
  const [rollPresses, setRollPresses] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  // True while Home is asking whether to end a party that friends are still in.
  const [confirmingHome, setConfirmingHome] = useState(false);


  // The newest team, roster, history, settings and roll, kept current as soon as a handler changes them.
  // Messages from party members arrive outside React's renders, so reading state from the render
  // that created the handler could miss the message just before it.
  const live = useRef({ players, teammates, roster, history, settings, rolled, kept });
  useEffect(() => {
    live.current = { players, teammates, roster, history, settings, rolled, kept };
  });
  // A bigger team can leave the role maximums adding up to less than the team, so the lowest ones go up
  // to fit. Minimums are left alone however the team changes: a roll fills as many as it can (D39).
  const raiseMaximums = (players: Player[], teammates: Teammate[]) => {
    const { settings } = live.current;
    const fitted = fitMaximums(settings, teamSize(players, teammates));
    if (totalMaximums(fitted) !== totalMaximums(settings.maxPerRole)) {
      const next = { ...settings, maxPerRole: fitted };
      live.current.settings = next;
      setSettings(next);
    }
  };
  const commitPlayers = (next: Player[]) => {
    live.current.players = next;
    setPlayers(next);
    raiseMaximums(next, live.current.teammates);
  };
  const commitTeammates = (next: Teammate[]) => {
    live.current.teammates = next;
    setTeammates(next);
    raiseMaximums(live.current.players, next);
  };
  const commitRoster = (next: Roster) => {
    live.current.roster = next;
    onRosterChange(next);
  };

  // The host's end of a party. Members' bans are saved to this device's roster by name, so a member
  // who leaves the tab keeps their last bans and still gets an agent.
  const host = useHostParty({
    onMessage: (peerId, message) => handleMemberMessage(peerId, message),
    onLeave: (playerId) => commitPlayers(setMemberStatus(live.current.players, playerId, "offline")),
  });

  useWakeLock(host.status === "open");

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
    const { players, roster, history } = live.current;
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

  // Copies the link friends open to join, with the party's code in it (D47).
  const shareLink = () => {
    if (!host.code) return;
    const base = `${window.location.origin}${window.location.pathname}`;
    navigator.clipboard
      .writeText(joinLink(base, host.code))
      .then(() => notify("Link copied. Send it to your friends."))
      .catch(() => notify("Couldn't copy the link. Tell your friends the code instead.", "error"));
  };

  const stopParty = () => {
    host.stop();
    commitPlayers(endParty(players));
  };

  // Home, and the browser's Back button, end any party this device is hosting, since a party only lives on
  // this page. It asks first when friends are connected, because one tap would otherwise end their game.
  const friendsInParty = players.filter((p) => p.member === "online").length;
  const tryLeave = () => {
    if (host.status === "idle") return true;
    if (friendsInParty > 0) {
      setConfirmingHome(true);
      return false;
    }
    stopParty();
    return true;
  };
  useEffect(() => {
    leaveRef.current = tryLeave;
  });
  const goHome = () => {
    if (tryLeave()) onHome();
  };
  const stopAndGoHome = () => {
    setConfirmingHome(false);
    stopParty();
    onHome();
  };

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

  if (!active) return null;

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
        {/* Start a party until a party is open, then Share link and Stop party */}
        <div className="panel-actions">
          {host.status === "open" ? (
            <>
              <button type="button" className="ghost" onClick={shareLink}>
                Share link
              </button>
              <button type="button" className="ghost" onClick={stopParty}>
                Stop party
              </button>
            </>
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
      <Toast toast={toast} onClose={onCloseToast} />
      {confirmingHome && (
        <StopPartyDialog friends={friendsInParty} onStop={stopAndGoHome} onCancel={() => setConfirmingHome(false)} />
      )}
    </main>
  );
}
