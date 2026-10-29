import type { JoinStep, MemberStatus } from "../hooks/useParty";
import { buildSharedCards } from "../lib/cards";
import type { SharedRoll, TeamMember } from "../lib/party";
import type { Player } from "../lib/types";
import { BanPicker } from "./BanPicker";
import { CardRow } from "./CardRow";
import { Disclaimer } from "./Disclaimer";
import { HomeButton } from "./HomeButton";

interface Props {
  /** The member as they are on their own device. Their bans are saved here and sent to the host. */
  me: Player;
  /** The party's code, shown under the title. */
  code: string;
  status: MemberStatus;
  /** Where a join is up to, shown while the member waits to be let in. */
  step: JoinStep;
  /** What the host last sent: who is on the team, the agents of its random teammates, the latest roll, and why a roll failed. */
  shared: { team: TeamMember[]; teammates: string[]; rolled: SharedRoll | null; error: string | null } | null;
  onChange: (patch: Partial<Player>) => void;
  onLeave: () => void;
}

/**
 * The page a party member sees: the team's five cards, then their own bans.
 *
 * The member never holds the team or rolls anything. They send their bans to the host, and show whatever the host sends back, so every phone matches.
 * The cards are the same five the host sees (D32), without taps: before a roll each person is a
 * waiting card with their name, after a roll the agents, and the online dot sits on each portrait,
 * so there is no Team panel. The host's random teammates and the empty cards show too.
 */
export function MemberView({ me, code, status, step, shared, onChange, onLeave }: Props) {
  const joined = status === "joined" && shared !== null;
  const cards = buildSharedCards(shared?.team ?? [], shared?.rolled ?? null, shared?.teammates ?? []);

  return (
    <main className="app">
      {/* Header: Leave party above the title and party code */}
      <header className="app-head member-head">
        <div>
          <HomeButton label={joined ? "Leave party" : "Cancel"} onClick={onLeave} />
          <h1>Team randomiser</h1>
          {code && <p className="party-line">Party {code}</p>}
        </div>
      </header>

      {/* Result: the host's error, then the comp, the waiting strip or a connecting line */}
      <div className="result">
        {shared?.error && (
          <p role="alert" className="error">
            {shared.error}
          </p>
        )}
        {joined ? (
          <section aria-live="polite">
            <h2 className="section-label">{shared?.rolled ? "Your comp" : "Waiting for the roll"}</h2>
            <CardRow cards={cards} you={me.name} />
            {shared?.rolled && (
              <p className="lock-note" data-locked={shared.rolled.locked}>
                {shared.rolled.locked ? "Locked in. Saved to history." : "Not locked in yet. Not saved to history."}
              </p>
            )}
          </section>
        ) : (
          <p className="empty">{step === "asking" ? "Asking the host to let you in…" : "Connecting to the party…"}</p>
        )}
      </div>

      {/* You: bans, saved on this device and sent to the host as they change */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-label">Your bans</h2>
          <span className="panel-hint">Saved on this device and sent to the host</span>
        </div>
        <BanPicker player={me} roleHeading="Roles you never want" onChange={onChange} />
      </section>

      <Disclaimer />
    </main>
  );
}
