import { useRef, useState } from "react";
import { CODE_LENGTH, cleanName, isPartyCode, normaliseCode } from "../lib/party";
import { CodeBoxes } from "./CodeBoxes";
import { Disclaimer } from "./Disclaimer";
import { ArrowRightIcon } from "./icons";

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

/** A code split into its four boxes, with empty strings where it is short. */
const toBoxes = (code: string) => Array.from({ length: CODE_LENGTH }, (_, i) => normaliseCode(code)[i] ?? "");

/**
 * The first page: Host a team, or Join a party.
 *
 * This is always the first page, and Home on the other pages comes back to it. Host opens the main page,
 * where a party can be started from the Team panel. Join is always open, since most people arriving here
 * are friends with a code: four boxes, a name, or a one-tap rejoin of the last party above the buttons. The form checks the code's shape before anyone is called, so a typo
 * gets a plain message under the boxes instead of a wait.
 */
export function EntryPage({ last, initial, onCreate, onJoin }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [boxes, setBoxes] = useState(() => toBoxes(initial?.code ?? ""));
  const [problem, setProblem] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = boxes.join("");
    if (!isPartyCode(code)) return setProblem("A party code is four letters or numbers, like K7QD.");
    if (!cleanName(name)) return setProblem("Type the name you want on the team.");
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
      </header>

      {/* Rejoin: the last party again, above the choices because it is the likeliest one */}
      {last && (
        <button type="button" className="rejoin" onClick={() => onJoin(last.code, last.name)}>
          <span>
            Rejoin <b>{last.code}</b> as {last.name}
          </span>
          <small>{ago(last.at, now)}</small>
        </button>
      )}

      {/* Host: a solid button to the main page */}
      <button type="button" className="entry-create" onClick={onCreate}>
        <span>Host a team</span>
        <ArrowRightIcon size={26} />
      </button>

      {/* Join: a code and a name */}
      <form className="panel entry-join" onSubmit={submit}>
        <h2 className="entry-title">Join</h2>
        <div className="entry-field">
          <span className="section-label">Party code</span>
          <CodeBoxes boxes={boxes} onChange={setBoxes} onFull={() => nameRef.current?.focus()} />
        </div>
        {problem && (
          <p role="alert" className="entry-problem">
            {problem}
          </p>
        )}
        <label className="entry-field">
          <span className="section-label">Your name</span>
          <input
            ref={nameRef}
            type="text"
            placeholder="Your name"
            autoComplete="off"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="roll small entry-submit">
          Join party
        </button>
      </form>

      <Disclaimer />
    </main>
  );
}
