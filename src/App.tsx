import { useEffect, useRef, useState } from "react";
import { CompResult } from "./components/CompResult";
import { HistoryView } from "./components/HistoryView";
import { PlayerList } from "./components/PlayerList";
import { SettingsPanel } from "./components/SettingsPanel";
import { usePersistentState } from "./hooks/usePersistentState";
import { createLocalHistoryStore, recordRoll } from "./lib/history";
import { fitMinimums, totalMinimums } from "./lib/minimums";
import { parsePlayers, parseRoster, parseSettings } from "./lib/parse";
import { RollError, rollComp } from "./lib/roll";
import {
  findDuplicateName,
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
  minPerRole: { duelist: 1, initiator: 1, controller: 1, sentinel: 0 },
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
  const roll = () => {
    setRollPresses((n) => n + 1);
    const duplicate = findDuplicateName(players);
    if (duplicate) {
      setError(`Two players are both called ${duplicate}. Give them different names.`);
      return;
    }
    try {
      const rollPlayers = toRollPlayers(players);
      const comp = rollComp(rollPlayers, settings, history);
      const nextHistory = recordRoll(history, comp.filter((pick) => isNamedKey(pick.playerId)));
      setRolled({ comp, players: rollPlayers, id: (rolled?.id ?? 0) + 1 });
      setError(null);
      setHistory(nextHistory);
      historyStore.save(nextHistory);
      setRoster(rememberPlayers(roster, players));
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
    const next = removeFromTeam(players, roster, history, player, forgetThem);
    setPlayers(next.players);
    setRoster(next.roster);
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
    setRoster(next.roster);
    setHistory(next.history);
    historyStore.save(next.history);
  };

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
        <PlayerList players={players} roster={roster} onChange={setPlayers} onRemove={removePlayer} onForget={forget} />
        <SettingsPanel settings={settings} playerCount={players.length} onChange={setSettings} />
      </div>
      <HistoryView players={toRollPlayers(players)} history={history} onClear={clearHistory} />
    </main>
  );
}
