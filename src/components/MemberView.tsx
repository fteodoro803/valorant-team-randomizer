import { useState } from "react";
import type { JoinStep, MemberStatus } from "../hooks/useParty";
import type { SharedRoll, TeamMember } from "../lib/party";
import type { Player } from "../lib/types";
import { BansDialog } from "./BansDialog";
import { CompResult } from "./CompResult";
import { Disclaimer } from "./Disclaimer";

interface Props {
  /** The member as they are on their own device. Their bans are saved here and sent to the host. */
  me: Player;
  status: MemberStatus;
  /** Where a join is up to, shown while the member waits to be let in. */
  step: JoinStep;
  /** What the host last sent: who is on the team, the latest roll, and why a roll failed. */
  shared: { team: TeamMember[]; rolled: SharedRoll | null; error: string | null } | null;
  onChange: (patch: Partial<Player>) => void;
  onRoll: () => void;
  onLeave: () => void;
}

/**
 * The page a party member sees: their own bans, the shared comp, and who else is on the team.
 *
 * The member never holds the team or rolls anything. They send their bans and Roll
 * presses to the host, and show whatever the host sends back, so every phone matches.
 */
export function MemberView({ me, status, step, shared, onChange, onRoll, onLeave }: Props) {
  const [bansOpen, setBansOpen] = useState(false);
  const joined = status === "joined" && shared !== null;
  const banCount = me.excludedAgents.length + me.bannedRoles.length;

  // The cards only need names, so the host's roll is turned back into players without bans.
  const players: Player[] =
    shared?.rolled?.players.map((p) => ({ id: p.id, name: p.name, excludedAgents: [], bannedRoles: [] })) ?? [];

  return (
    <main className="app">
      {/* Header: title, and Roll pinned to the bottom on phones like the host's */}
      <header className="app-head">
        <div>
          <a className="back-link" href="../">
            ← Back to Projects
          </a>
          <h1>Team randomiser</h1>
        </div>
        <div className="roll-bar">
          <button type="button" className="roll" disabled={!joined} onClick={onRoll}>
            Roll
          </button>
        </div>
      </header>

      {/* Result: the host's error, the shared comp, or a prompt */}
      <div className="result">
        {shared?.error && (
          <p role="alert" className="error">
            {shared.error}
          </p>
        )}
        {shared?.rolled ? (
          <CompResult comp={shared.rolled.comp} players={players} rollId={shared.rolled.id} />
        ) : (
          <p className="empty">{joined
              ? "Press Roll to give everyone an agent for the next game."
              : step === "asking"
                ? "Asking the host to let you in…"
                : "Connecting to the party…"}</p>
        )}
      </div>

      {/* You: bans, saved on this device */}
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-label">{me.name}</h2>
          <button type="button" className="ghost" onClick={() => setBansOpen(true)}>
            Bans{banCount > 0 ? ` (${banCount})` : ""}
          </button>
        </div>
        <p className="panel-hint">Your bans are saved on this device and sent to the host as you change them.</p>
      </section>

      {/* Team: who the host has */}
      <section className="panel party-team">
        <div className="panel-head">
          <h2 className="section-label">Team</h2>
          <button type="button" className="ghost" onClick={onLeave}>
            {joined ? "Leave party" : "Cancel"}
          </button>
        </div>
        <ul className="team-list">
          {(shared?.team ?? []).map((member) => (
            <li key={member.name} data-online={member.online}>
              <span>{member.name}</span>
              <span
                className="status-dot"
                data-online={member.online}
                role="img"
                aria-label={`${member.name} is ${member.online ? "in the party" : "offline"}`}
              />
            </li>
          ))}
        </ul>
      </section>

      <Disclaimer />

      {bansOpen && <BansDialog player={me} label={me.name} onChange={onChange} onClose={() => setBansOpen(false)} />}
    </main>
  );
}
