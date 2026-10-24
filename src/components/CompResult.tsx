import { agentIconUrl } from "../data/agents";
import { keyForName } from "../lib/roster";
import type { Assignment, Player } from "../lib/types";

interface Props {
  comp: Assignment[];
  players: Player[];
  /** Changes on every roll, so the cards are drawn fresh and the reveal plays again. */
  rollId: number;
  /** Whether the host has locked this comp in. Locked comps are in history, the rest are still just a pick. */
  locked: boolean;
  /** A party member's page passes these so their own portrait is outlined and each portrait shows who is online. */
  you?: string;
  onlineOf?: (playerId: string) => boolean | undefined;
}

/** The green or hollow dot at the corner of a portrait, drawn only when the page knows who is online. */
function OnlineDot({ name, online }: { name: string; online: boolean | undefined }) {
  if (online === undefined) return null;
  return (
    <span
      className="status-dot"
      data-online={online}
      role="img"
      aria-label={`${name} is ${online ? "in the party" : "offline"}`}
    />
  );
}

/**
 * The rolled comp: one card per player showing their agent and role.
 *
 * A strip of five portraits on phones and rows on wide screens, both drawn by CSS from the same
 * markup. The whole list appears at once (the reveal is a CSS animation on each card), and the
 * section is a live region, so a screen reader hears the new comp. The role is always in the
 * text, though the strip hides it visually and leaves the colour to say it.
 */
export function CompResult({ comp, players, rollId, locked, you, onlineOf }: Props) {
  const nameOf = (id: string) => {
    const index = players.findIndex((p) => p.id === id);
    return players[index]?.name || `Player ${index + 1}`;
  };

  return (
    <section aria-live="polite">
      <h2 className="section-label">Your comp</h2>
      <ul className="cards">
        {comp.map((pick) => {
          const name = nameOf(pick.playerId);
          return (
            <li key={`${rollId}-${pick.playerId}`} className={`card ${pick.role}`} data-you={you !== undefined && keyForName(name) === keyForName(you)}>
              <span className="card-art">
                <img src={agentIconUrl(pick.agent)} alt="" />
                <OnlineDot name={name} online={onlineOf?.(pick.playerId)} />
              </span>
              <div className="card-body">
                <span className="card-role">{pick.role}</span>
                <span className="card-agent">{pick.agent}</span>
                <span className="card-player">{name}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="lock-note" data-locked={locked}>
        {locked ? "Locked in. Saved to history." : "Not locked in yet. Only locked-in rolls are saved to history."}
      </p>
    </section>
  );
}

interface StripProps {
  team: { name: string; online: boolean }[];
  you: string;
}

/**
 * The same strip before anything is rolled: an empty portrait for each person on the team.
 *
 * It keeps a joiner's page from being blank while they wait, and it is the team list, so a joiner
 * needs no separate Team panel.
 */
export function TeamStrip({ team, you }: StripProps) {
  return (
    <section aria-live="polite">
      <h2 className="section-label">Waiting for the roll</h2>
      <ul className="cards">
        {team.map((member) => (
          <li key={member.name} className="card slot" data-you={keyForName(member.name) === keyForName(you)}>
            <span className="card-art">
              <span className="card-initial" aria-hidden="true">
                {member.name.slice(0, 1)}
              </span>
              <OnlineDot name={member.name} online={member.online} />
            </span>
            <div className="card-body">
              <span className="card-player">{member.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
