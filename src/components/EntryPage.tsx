import { useState } from "react";
import { cleanName, isPartyCode } from "../lib/party";
import { Disclaimer } from "./Disclaimer";

interface Props {
  /** The last party this device joined, within three hours, offered as a one-tap rejoin. */
  last: { code: string; name: string; at: number } | null;
  /** What was last typed into the form, so a join that failed doesn't empty it. */
  initial: { name: string; code: string } | null;
  onCreate: () => void;
  onJoin: (code: string, name: string) => void;
}

/** How long ago something happened, in words small enough for a button. */
function ago(at: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - at) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

/**
 * The first page: Create a team, or Join a party.
 *
 * Create opens the main page, where a party can be started from the Team panel. Join takes a name
 * and a code, or rejoins the last party in one tap. The form checks the code's shape before anyone is
 * called, so a typo gets a plain message under the fields instead of a wait.
 */
export function EntryPage({ last, initial, onCreate, onJoin }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanName(name)) return setProblem("Type the name you want on the team.");
    if (!isPartyCode(code)) return setProblem("A party code is four letters or numbers, like K7QD.");
    setProblem(null);
    onJoin(code, name);
  };

  return (
    <main className="entry">
      <header>
        {/* The portfolio's Lab page is one level up from where this is served (D14). */}
        <a className="back-link" href="../">
          ← Back to Projects
        </a>
        <h1>Team randomiser</h1>
        <p className="entry-lede">Give everyone an agent for the next game. What would you like to do?</p>
      </header>

      {/* Create: the main page */}
      <button type="button" className="entry-create" onClick={onCreate}>
        <span className="entry-title">Create</span>
        <span>Set up your team and roll. You can start a party from there.</span>
      </button>

      {/* Join: a name and a code, or the last party again */}
      <form className="panel entry-join" onSubmit={submit}>
        <h2 className="entry-title">Join a party</h2>
        {last && (
          <button type="button" className="rejoin" onClick={() => onJoin(last.code, last.name)}>
            <span>
              Rejoin <b>{last.code}</b> as {last.name}
            </span>
            <small>{ago(last.at, now)}</small>
          </button>
        )}
        <div className="entry-fields">
          <input
            type="text"
            aria-label="Your name"
            placeholder="Your name"
            autoComplete="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            className="entry-code"
            aria-label="Party code"
            placeholder="Code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {problem && (
          <p role="alert" className="entry-problem">
            {problem}
          </p>
        )}
        <button type="submit" className="ghost">
          Join
        </button>
      </form>

      <Disclaimer />
    </main>
  );
}
