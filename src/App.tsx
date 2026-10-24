import { useEffect, useRef, useState } from "react";
import { CompResult } from "./components/CompResult";
import { HistoryView } from "./components/HistoryView";
import { MemberView } from "./components/MemberView";
import { PartyPanel } from "./components/PartyPanel";
import { PlayerList } from "./components/PlayerList";
import { SettingsPanel } from "./components/SettingsPanel";
import { usePersistentState } from "./hooks/usePersistentState";
import { useHostParty, useMemberParty } from "./hooks/useParty";
import { createLocalHistoryStore, recordRoll } from "./lib/history";
import { fitMinimums, totalMinimums } from "./lib/minimums";
import { parsePlayers, parseRoster, parseSettings } from "./lib/parse";
import {
  admitMember,
  cleanName,
  endParty,
  setMemberBans,
  setMemberStatus,
  teamForMembers,
} from "./lib/party";
import type { SharedRoll, TeamMember, ToHost } from "./lib/party";
import { RollError, rollComp } from "./lib/roll";
import {
  findDuplicateName,
  findSaved,
  forgetPlayer,
  isNamedKey,
  keepNamedHistory,
  rememberPlayers,
  removeFromTeam,
  toRollPlayers,
} from "./lib/roster";
import { browserStorage } from "./lib/storage";
import type { Assignment, Player, Roster, Settings } from "./lib/types";

const storage = browserStorage();
const historyStore = createLocalHistoryStore(storage);

const defaultPlayers: Player[] = [1, 2, 3, 4, 5].map((n) => ({
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
  const [partyNotice, setPartyNotice] = useState<string | null>(null);
  const [me, setMe] = useState<Player | null>(null);
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
    onEnded: (reason) => {
      setShared(null);
      setMe(null);
      setPartyNotice(reason);
    },
  });
  const memberActive = member.status === "connecting" || member.status === "joined";

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

  // 1. Check names, 2. roll, 3. show it, 4. remember it. Every roll counts toward history (D4),
  //    but only for named players, since an unnamed slot has no one to remember (D10).
  //    A party member's Roll press arrives here too, and reads the newest state through `live`.
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
      const nextHistory = recordRoll(history, comp.filter((pick) => isNamedKey(pick.playerId)));
      const nextRolled = { comp, players: rollPlayers, id: (rolled?.id ?? 0) + 1 };
      live.current.rolled = nextRolled;
      live.current.history = nextHistory;
      setRolled(nextRolled);
      setError(null);
      setHistory(nextHistory);
      historyStore.save(nextHistory);
      commitRoster(rememberPlayers(roster, players));
    } catch (e) {
      if (!(e instanceof RollError)) throw e;
      setError(e.message);
    }
  };

  const clearHistory = () => {
    setHistory({});
    historyStore.save({});
  };

  // Remove keeps the person's saved details and history, forgetting deletes them (D9).
  const removePlayer = (player: Player, forgetThem: boolean) => {
    // A party member who is removed is also disconnected, so they can't keep sending bans.
    if (player.member) host.kick(player.id);
    const next = removeFromTeam(players, roster, history, player, forgetThem);
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
  //    member leaving), and its Roll presses roll for everyone.
  function handleMemberMessage(peerId: string, message: ToHost) {
    if (message.type === "join") {
      const result = admitMember(live.current.players, message, crypto.randomUUID());
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
    if (message.type === "roll") {
      roll();
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
      rolled: rolled && { comp: rolled.comp, players: rolled.players.map(({ id, name }) => ({ id, name })), id: rolled.id },
      error,
    });
    // `host` changes every render, so listing it would resend on every render instead of on every change.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [host.status, players, rolled, error]);

  const stopParty = () => {
    host.stop();
    commitPlayers(endParty(players));
  };

  const joinParty = (code: string, typedName: string) => {
    const name = cleanName(typedName);
    const saved = findSaved(roster, name);
    setPartyNotice(null);
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

  const changeMyBans = (patch: Partial<Player>) => {
    if (!me) return;
    const next = { ...me, ...patch };
    setMe(next);
    commitRoster(rememberPlayers(live.current.roster, [next]));
    member.send({ type: "bans", excludedAgents: next.excludedAgents, bannedRoles: next.bannedRoles });
  };

  const leaveParty = () => {
    member.leave();
    setShared(null);
    setMe(null);
  };

  if (memberActive && me) {
    return (
      <MemberView
        me={me}
        status={member.status}
        shared={shared}
        onChange={changeMyBans}
        onRoll={() => member.send({ type: "roll" })}
        onLeave={leaveParty}
      />
    );
  }

  return (
    <main className="app">
      {/* Header: title on the left, Roll on the right on wide screens and pinned to the bottom on phones */}
      <header className="app-head">
        <div>
          {/* The portfolio's Lab page is one level up from where this is served (D14). */}
          <a className="back-link" href="../">
            ← Back to Projects
          </a>
          <h1>Team randomiser</h1>
        </div>
        <div className="roll-bar">
          <button type="button" className="roll" onClick={roll}>
            Roll
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
          <CompResult comp={rolled.comp} players={rolled.players} rollId={rolled.id} />
        ) : (
          <p className="empty">Press Roll to give everyone an agent for the next game.</p>
        )}
      </div>

      <div className="columns">
        <PlayerList players={players} roster={roster} onChange={commitPlayers} onRemove={removePlayer} onForget={forget} />
        <SettingsPanel settings={settings} playerCount={players.length} onChange={setSettings} />
      </div>
      <PartyPanel
        host={host}
        onStart={host.start}
        onStop={stopParty}
        joinError={member.error}
        notice={partyNotice}
        onJoin={joinParty}
      />
      <HistoryView players={toRollPlayers(players)} history={history} onClear={clearHistory} />

      {/* Footer: two Riot notices, both worded as Riot gives them and neither to be reworded. */}
      <footer className="disclaimer">
        {/* Fan-content notice, fixed by Riot's "Legal Jibber Jabber" policy, section 6 (#5). */}
        <p>
          Valorant Team Randomizer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot
          Games. Riot Games does not endorse or sponsor this project.
        </p>
        {/* Product notice that Riot's general developer policy requires of every registered product. */}
        <p>
          Valorant Team Randomizer isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games
          or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>
      </footer>
    </main>
  );
}
