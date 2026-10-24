import type { JoinStep, MemberStatus } from "../hooks/useParty";
import type { SharedRoll, TeamMember } from "../lib/party";
import { keyForName } from "../lib/roster";
import type { Player } from "../lib/types";
import { BanPicker } from "./BanPicker";
import { CompResult, TeamStrip } from "./CompResult";
import { Disclaimer } from "./Disclaimer";

interface Props {
  /** The member as they are on their own device. Their bans are saved here and sent to the host. */
  me: Player;
  /** The party's code, shown under the title. */
  code: string;
  status: MemberStatus;
  /** Where a join is up to, shown while the member waits to be let in. */
  step: JoinStep;
  /** What the host last sent: who is on the team, the latest roll, and why a roll failed. */
  shared: { team: TeamMember[]; rolled: SharedRoll | null; error: string | null } | null;
  onChange: (patch: Partial<Player>) => void;
  onLeave: () => void;
}

/**
 * The page a party member sees: the team as a strip of portraits, then their own bans.
 *
 * The member never holds the team or rolls anything. They send their bans to the host, and show whatever the host sends back, so every phone matches.
 * The strip is the team list too: before a roll it shows empty portraits with names, after
 * a roll the agents, and the online dot sits on each portrait, so there is no Team panel.
 */
export function MemberView({ me, code, status, step, shared, onChange, onLeave }: Props) {
  const joined = status === "joined" && shared !== null;
  const team = shared?.team ?? [];

  // The cards only need names, so the host's roll is turned back into players without bans.
  const players: Player[] =
    shared?.rolled?.players.map((p) => ({ id: p.id, name: p.name, excludedAgents: [], bannedRoles: [] })) ?? [];
  const onlineOf = (playerId: string) => {
    const name = players.find((p) => p.id === playerId)?.name ?? "";
    return team.find((m) => keyForName(m.name) === keyForName(name))?.online;
  };

  return (
    <main className="app">
      {/* Header: title and party code and Leave party beside the back link */}
      <header className="app-head member-head">
        <div>
          <div className="head-links">
            <a className="back-link" href="../">
              ← Back to Projects
            </a>
            <button type="button" className="menu-link" onClick={onLeave}>
              {joined ? "Leave party" : "Cancel"}
            </button>
          </div>
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
        {shared?.rolled ? (
          <CompResult
            comp={shared.rolled.comp}
            players={players}
            rollId={shared.rolled.id}
            locked={shared.rolled.locked}
            you={me.name}
            onlineOf={onlineOf}
          />
        ) : joined ? (
          <TeamStrip team={team} you={me.name} />
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
