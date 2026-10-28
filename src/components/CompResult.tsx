import { agentIconUrl } from "../data/agents";
import { keyForName } from "../lib/roster";
import type { Assignment, Player } from "../lib/types";

interface Props {
  comp: Assignment[];
  players: Player[];
  /** Random teammates' picks, drawn greyed after the players' cards. They aren't part of the team's own comp, so they can't be locked. */
  others?: Assignment[];
  /** Whether the host has locked this comp in. Locked comps are in history, the rest are still just a pick. */
  locked: boolean;
  /** A party member's page passes these so their own portrait is outlined and each portrait shows who is online. */
  you?: string;
  onlineOf?: (playerId: string) => boolean | undefined;
  /** The host's page passes these so a card can be tapped to lock its pick through the next Roll. Joiners get plain cards. */
  kept?: string[];
  allKept?: boolean;
  onToggleKept?: (playerId: string) => void;
  onClearKept?: () => void;
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

/** The small padlock on a portrait whose pick is locked. Hidden from screen readers, since the card says "pressed". */
function LockBadge() {
  return (
    <span className="card-lock" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  );
}

/**
 * The rolled comp: one card per player showing their agent and role.
 *
 * A strip of five portraits on phones and rows on wide screens, both drawn by CSS from the same
 * markup. The whole list appears at once (the reveal is a CSS animation on each card, and a card is
 * keyed by its agent, so after a partial reroll only the changed cards play it), and the
 * section is a live region, so a screen reader hears the new comp. The role is always in the
 * text, though the strip hides it visually and leaves the colour to say it.
 *
 * Random teammates follow the players, dimmed with a dashed outline and no name. Screen readers still hear "Random teammate".
 *
 * On the host's page (when `onToggleKept` is given) each card is a button that locks or unlocks
 * that player's pick, shown as a ring and a padlock (D27). A locked-in comp can't be edited.
 */
export function CompResult({ comp, players, others = [], locked, you, onlineOf, kept = [], allKept = false, onToggleKept, onClearKept }: Props) {
  const nameOf = (id: string) => {
    const index = players.findIndex((p) => p.id === id);
    return players[index]?.name || `Player ${index + 1}`;
  };
  const editable = onToggleKept !== undefined && !locked;

  return (
    <section aria-live="polite">
      <h2 className="section-label">Your comp</h2>
      <ul className="cards">
        {comp.map((pick) => {
          const name = nameOf(pick.playerId);
          const isKept = kept.includes(pick.playerId);
          const content = (
            <>
              <span className="card-art">
                <img src={agentIconUrl(pick.agent)} alt="" />
                <OnlineDot name={name} online={onlineOf?.(pick.playerId)} />
                {isKept && <LockBadge />}
              </span>
              <div className="card-body">
                <span className="card-role">{pick.role}</span>
                <span className="card-agent">{pick.agent}</span>
                <span className="card-player">{name}</span>
              </div>
            </>
          );
          const props = {
            className: `card ${pick.role}`,
            "data-you": you !== undefined && keyForName(name) === keyForName(you),
            "data-kept": isKept,
          };
          return (
            <li key={`${pick.playerId}-${pick.agent}`} className="card-item">
              {editable ? (
                <button type="button" {...props} aria-pressed={isKept} title="Lock this pick through the next Roll" onClick={() => onToggleKept(pick.playerId)}>
                  {content}
                </button>
              ) : (
                <div {...props}>{content}</div>
              )}
            </li>
          );
        })}
        {/* Random teammates: the same card, dimmed and dashed so it's plain they aren't on the team, and never tappable */}
        {others.map((pick) => (
          <li key={`${pick.playerId}-${pick.agent}`} className="card-item">
            <div className={`card ${pick.role}`} data-outside="true">
              <span className="card-art">
                <img src={agentIconUrl(pick.agent)} alt="" />
              </span>
              <div className="card-body">
                <span className="card-role">{pick.role}</span>
                <span className="card-agent">{pick.agent}</span>
                <span className="sr-only">Random teammate</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* Note: what Roll will do while picks are locked, otherwise whether the comp has reached history */}
      {editable && kept.length > 0 ? (
        <p className="lock-note">
          {allKept ? "All locked. Tap one to change." : `${kept.length} locked. Roll changes the rest.`}{" "}
          <button type="button" className="note-link" onClick={onClearKept}>
            Clear
          </button>
        </p>
      ) : (
        <p className="lock-note" data-locked={locked}>
          {locked ? "Locked in. Saved to history." : "Not locked in yet. Not saved to history."}
        </p>
      )}
    </section>
  );
}

interface StripProps {
  team: { name: string; online: boolean }[];
  you: string;
}

/**
 * The same strip before anything is rolled: a "?" portrait for each person on the team, laid out
 * like a rolled card (a Waiting label where the role goes, the name where the agent goes) so the roll
 * fills the same cards in rather than swapping them for different ones (D30).
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
                ?
              </span>
              <OnlineDot name={member.name} online={member.online} />
            </span>
            <div className="card-body">
              <span className="card-role">Waiting</span>
              <span className="card-agent">{member.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
