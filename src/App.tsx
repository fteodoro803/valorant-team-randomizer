import { useEffect, useRef, useState } from "react";
import { EntryPage } from "./components/EntryPage";
import { MainPage } from "./components/MainPage";
import { MemberView } from "./components/MemberView";
import { Toast } from "./components/Toast";
import type { ToastMessage } from "./components/Toast";
import { usePersistentState } from "./hooks/usePersistentState";
import { useMemberParty } from "./hooks/useParty";
import { useRoute } from "./hooks/useRoute";
import { cleanName, NO_PARTY_MESSAGE, normaliseCode, PARTY_ENDED_MESSAGE } from "./lib/party";
import type { SharedRoll, TeamMember } from "./lib/party";
import {
  clearLastParty,
  clearSession,
  loadLastParty,
  loadSession,
  saveLastParty,
  saveSession,
} from "./lib/partySession";
import { findSaved, rememberPlayers } from "./lib/roster";
import { joinCodeOf } from "./lib/route";
import type { Route } from "./lib/route";
import { parseRoster } from "./lib/parse";
import { browserStorage } from "./lib/storage";
import type { Player, Roster } from "./lib/types";

/** How many times a device that lost its party tries to get back in, and how long it waits between tries. */
const MAX_REJOIN_TRIES = 3;
const REJOIN_DELAY_MS = 4000;

const storage = browserStorage();

export default function App() {
  const [roster, setRoster] = usePersistentState<Roster>(storage, "valorant-randomizer-saved-players", {}, parseRoster);
  // The newest saved people, kept current as soon as a handler changes them, because a message from a
  // party member can arrive outside React's renders (see the host's page).
  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
  });
  const commitRoster = (next: Roster) => {
    rosterRef.current = next;
    setRoster(next);
  };

  // The page is the address (#/, #/host, #/party), so Back and refresh work (D-new2). Back from the host's page
  // asks the question Home asks, and Back from a friend's page leaves the party.
  const leaveHost = useRef<() => boolean>(() => true);
  function allowNavigation(_to: Route, from: Route) {
    if (from === "host") return leaveHost.current();
    if (from === "party" && friendsPageShowing) leaveParty(false);
    return true;
  }
  const { route, hash, go } = useRoute(allowNavigation);

  // Party state. A friend's page shows what the host last sent (`shared`) and their own details (`me`).
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
      go("entry", true);
      notify("The host removed you from the party.");
    },
    // The connection went quiet or the host left. The device tries to get back in (see below).
    onEnded: () => {
      setShared(null);
      go("entry", true);
      notify("Connection lost. Reconnecting to the party…", "info", true);
      setWantRejoin(true);
    },
  });
  const memberActive = member.status === "connecting" || member.status === "joined";
  const friendsPageShowing = memberActive && me;

  // An address with no party behind it, such as #/party typed in or reached by Forward, goes to the entry page.
  // A device still trying to get back into its party keeps it, and a join link (#/party/K7QD) stays, since
  // the entry page opens with its code filled in (D-new5).
  useEffect(() => {
    if (route === "party" && !memberActive && !wantRejoin && !loadSession(storage) && !joinCodeOf(hash)) {
      go("entry", true);
    }
    // `go` never changes, and only these can make the party's page stop being right.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, memberActive, wantRejoin, member.status]);

  // Starts a join. A typed code and a rejoin after sleep go through here the same way.
  const startJoin = (code: string, typedName: string) => {
    const name = cleanName(typedName);
    const saved = findSaved(rosterRef.current, name);
    go("party");
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
    commitRoster(rememberPlayers(rosterRef.current, [next]));
    member.send({ type: "bans", excludedAgents: next.excludedAgents, bannedRoles: next.bannedRoles });
  };

  const leaveParty = (navigate = true) => {
    clearSession(storage);
    setRejoinTries(0);
    setWantRejoin(false);
    setToast(null);
    member.leave();
    setShared(null);
    setMe(null);
    if (navigate) go("entry");
  };

  const create = () => go("host");
  const linkCode = joinCodeOf(hash);

  return (
    <>
      {/* Host's page: stays mounted behind the other two so a roll in progress survives Home and Host again */}
      <MainPage
        active={!friendsPageShowing && route === "host"}
        storage={storage}
        roster={roster}
        onRosterChange={commitRoster}
        toast={toast}
        notify={notify}
        onCloseToast={closeToast}
        onHome={() => go("entry")}
        leaveRef={leaveHost}
      />

      {/* A friend's page. It has no Roll bar, so the toast can sit lower. */}
      {friendsPageShowing && (
        <>
          <MemberView
            me={me}
            code={lastParty?.code ?? attempt?.code ?? ""}
            status={member.status}
            step={member.step}
            shared={shared}
            onChange={changeMyBans}
            onLeave={() => leaveParty()}
          />
          <Toast toast={toast} low onClose={closeToast} />
        </>
      )}

      {/* Entry page. It has no Roll bar either, so the toast can sit lower. */}
      {!friendsPageShowing && route !== "host" && (
        <>
          <EntryPage
            key={linkCode ?? ""}
            last={lastParty}
            initial={attempt ?? (linkCode ? { name: "", code: linkCode } : null)}
            onCreate={create}
            onJoin={joinParty}
          />
          <Toast toast={toast} low onClose={closeToast} />
        </>
      )}
    </>
  );
}
