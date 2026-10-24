import { useState } from "react";
import type { HostStatus } from "../hooks/useParty";
import { cleanName, isPartyCode } from "../lib/party";

interface Props {
  host: { code: string | null; status: HostStatus; error: string | null };
  onStart: () => void;
  onStop: () => void;
  /** Why the last join failed, from the connection. */
  joinError: string | null;
  /** Why the last party ended, if it ended on its own. */
  notice: string | null;
  onJoin: (code: string, name: string) => void;
}

/**
 * Party controls on the host's page: start a party and show its code, or join someone else's.
 *
 * While a party is open it shows the code in large type to read out, and a Stop button.
 * Otherwise it offers the two ways in. The code is checked here before anyone is called,
 * so a typo gets a plain message instead of a wait.
 */
export function PartyPanel({ host, onStart, onStop, joinError, notice, onJoin }: Props) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPartyCode(code)) return setProblem("A party code is four letters or numbers, like K7QD.");
    if (!cleanName(name)) return setProblem("Type the name you want on the team.");
    setProblem(null);
    onJoin(code, name);
  };

  const message = problem ?? joinError ?? host.error ?? notice;

  return (
    <section className="panel party">
      <div className="panel-head">
        <h2 className="section-label">Party</h2>
      </div>

      {host.status === "open" ? (
        <>
          {/* Hosting: the code to read out */}
          <p className="party-code" aria-label={`Party code ${host.code?.split("").join(" ")}`}>
            {host.code}
          </p>
          <p className="panel-hint">
            Friends open this page, type the code under Join a party, and set their own bans on their phones.
            Anyone you connect with can see your network address, because browsers talk to each other directly.
          </p>
          <button type="button" className="ghost" onClick={onStop}>
            Stop party
          </button>
        </>
      ) : (
        <>
          {/* Not hosting: start one, or join one */}
          <p className="panel-hint">Host a party so friends set their own bans from their own phones.</p>
          <button type="button" className="ghost" disabled={host.status === "connecting"} onClick={onStart}>
            {host.status === "connecting" ? "Starting…" : "Start a party"}
          </button>

          <form className="party-join" onSubmit={submit}>
            <h3 className="party-sub">Join a party</h3>
            <div className="party-fields">
              <input
                type="text"
                aria-label="Party code"
                placeholder="Code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <input
                type="text"
                aria-label="Your name"
                placeholder="Your name"
                autoComplete="off"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button type="submit" className="ghost">
              Join
            </button>
          </form>
        </>
      )}

      {message && (
        <p role="alert" className="party-message">
          {message}
        </p>
      )}
    </section>
  );
}
