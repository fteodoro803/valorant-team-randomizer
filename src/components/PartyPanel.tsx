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
  /** The last party this device joined, within three hours, so the form can start filled in. */
  last: { code: string; name: string } | null;
}

/**
 * Party controls on the host's page: start a party and show its code, or join someone else's.
 *
 * While a party is open it shows the code in large type to read out, and a Stop button.
 * Otherwise it offers the two ways in. The code is checked here before anyone is called,
 * so a typo gets a plain message instead of a wait.
 */
export function PartyPanel({ host, onStart, onStop, joinError, notice, onJoin, last }: Props) {
  const [code, setCode] = useState(last?.code ?? "");
  const [name, setName] = useState(last?.name ?? "");
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
          <p className="panel-hint">
            Host from a computer if you can. If this page closes or its device sleeps, the party ends for everyone.
            On a phone, keep this page in front with the screen on.
          </p>
          <button type="button" className="ghost" onClick={onStop}>
            Stop party
          </button>
        </>
      ) : (
        <>
          {/* Not hosting: start one, or join one */}
          <p className="panel-hint">
            Host a party so friends set their own bans from their own phones. It works best when the host is on a
            computer, because the party ends if the host's page closes or its device sleeps.
          </p>
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
