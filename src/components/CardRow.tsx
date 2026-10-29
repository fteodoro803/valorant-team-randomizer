import type { ReactNode } from "react";
import { agentIconUrl } from "../data/agents";
import type { CardView } from "../lib/cards";
import { keyForName } from "../lib/roster";

/** What a tap on a card does, for the host's page. A card with none is plain. */
export interface CardAction {
  /** What a screen reader says the card does. */
  label: string;
  /** Set when the card is a toggle, as a locked pick is. */
  pressed?: boolean;
  onClick: () => void;
}

interface Props {
  cards: CardView[];
  /** A party member's page passes their name so their own portrait is outlined. */
  you?: string;
  /** The ids of locked picks, drawn with a ring and a padlock. */
  kept?: string[];
  /** The host's page passes these so a card can be tapped and can carry a three-dots menu. Joiners get plain cards. */
  action?: (card: CardView) => CardAction | null;
  menu?: (card: CardView) => ReactNode;
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
 * The team's five cards: a strip of portraits on phones and rows on wide screens, both drawn by CSS
 * from the same markup (D23).
 *
 * A card is one of four things (see `CardView`): waiting for the roll with a "?", rolled with its
 * agent and role, a random teammate's dimmed and dashed card, or an empty one with a "+". The
 * reveal is a CSS animation on each card, and a card is keyed by its agent, so after a partial
 * reroll only the changed cards play it. The role is always in the text, though the strip hides it
 * visually and leaves the colour to say it.
 *
 * On the host's page a card can be tapped (an invisible button laid over the whole card) and can
 * carry the three-dots menu, which sits beside the card rather than inside it so the wide
 * layout's rounded clipping can't cut its popover off. A locked pick is a ring and a padlock (D27).
 */
export function CardRow({ cards, you, kept = [], action, menu }: Props) {
  return (
    <ul className="cards">
      {cards.map((card) => {
        const act = action?.(card) ?? null;
        const isKept = card.rollId !== undefined && kept.includes(card.rollId);
        const hasAgent = card.agent !== undefined && card.role !== undefined;
        const plain = card.state === "empty" || card.state === "waiting" || !hasAgent;
        const name = card.name ?? "";

        return (
          <li key={card.key} className="card-item">
            <div
              className={`card ${plain ? "slot" : card.role}`}
              data-state={card.state}
              data-you={you !== undefined && name !== "" && keyForName(name) === keyForName(you)}
              data-kept={isKept}
              data-outside={card.state === "teammate"}
            >
              {/* Portrait: the agent, or a mark for a card with none */}
              <span className="card-art">
                {hasAgent && card.agent ? (
                  <img src={agentIconUrl(card.agent)} alt="" />
                ) : (
                  <span className="card-initial" aria-hidden="true">
                    {card.state === "empty" ? "+" : "?"}
                  </span>
                )}
                {card.state !== "empty" && <OnlineDot name={name} online={card.online} />}
                {isKept && <LockBadge />}
              </span>

              {/* Text: role, then the agent (or the name of someone still waiting), then the player */}
              <div className="card-body">
                {card.state === "empty" && (
                  <>
                    <span className="card-role">Empty</span>
                    <span className="card-agent">Add</span>
                  </>
                )}
                {card.state === "waiting" && (
                  <>
                    <span className="card-role">Waiting</span>
                    <span className="card-agent">{name}</span>
                  </>
                )}
                {card.state === "rolled" && (
                  <>
                    <span className="card-role">{card.role}</span>
                    <span className="card-agent">{card.agent}</span>
                    <span className="card-player">{name}</span>
                  </>
                )}
                {card.state === "teammate" &&
                  (hasAgent ? (
                    <>
                      <span className="card-role">{card.role}</span>
                      <span className="card-agent">{card.agent}</span>
                      <span className="sr-only">Random teammate</span>
                    </>
                  ) : (
                    <>
                      <span className="card-role">Random</span>
                      <span className="card-agent">Pick agent</span>
                    </>
                  ))}
              </div>
            </div>

            {act && (
              <button
                type="button"
                className="card-hit"
                aria-label={act.label}
                aria-pressed={act.pressed}
                title={act.label}
                onClick={act.onClick}
              />
            )}
            {menu && <div className="card-menu">{menu(card)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
