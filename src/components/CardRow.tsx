import type { ReactNode } from "react";
import { agentIconUrl } from "../data/agents";
import type { CardView } from "../lib/cards";
import { keyForName } from "../lib/roster";
import { CogIcon, LockIcon, TrashIcon } from "./icons";

/** One tappable part of a card, for the host's page. A part with none is plain. */
export interface Zone {
  /** What a screen reader says the part does. */
  label: string;
  onClick: () => void;
  /** Drawn greyed out and not tappable, such as the lock before there is an agent to lock. */
  disabled?: boolean;
  /** The same action as the text side, so keyboard and screen readers skip this copy of it. */
  duplicate?: boolean;
}

/** The bar along the bottom: it locks a player's pick, or removes a random teammate. */
export interface BarZone extends Zone {
  kind: "lock" | "remove";
  /** The word shown beside the icon on wide screens. */
  text: string;
  /** For a lock: whether the pick is locked. */
  on?: boolean;
}

/**
 * The three parts of a card (D38): Configure (a strip across the top on a wide card, a cog beside
 * the lock on a phone row), the card itself, which opens the agent window, and the bar.
 */
export interface CardZones {
  config?: Zone;
  main?: Zone;
  bar?: BarZone;
}

interface Props {
  cards: CardView[];
  /** A party member's page passes their name so their own portrait is outlined. */
  you?: string;
  /** The ids of locked picks, drawn with a ring. */
  kept?: string[];
  /** The host's page passes this so the parts of a card can be tapped. Joiners get plain cards. */
  zones?: (card: CardView) => CardZones;
}

/** The green or hollow dot at the corner of a portrait, drawn only when the page knows who is online. */
function OnlineDot({ name, online, className = "" }: { name: string; online: boolean | undefined; className?: string }) {
  if (online === undefined) return null;
  return (
    <span
      className={`status-dot ${className}`}
      data-online={online}
      role="img"
      aria-label={`${name} is ${online ? "in the party" : "offline"}`}
    />
  );
}

/** A part of the card that is a button when it has an action and a plain box when it doesn't. */
function Part({ zone, className, children }: { zone: Zone | undefined; className: string; children: ReactNode }) {
  if (!zone) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      className={`zone ${className}`}
      aria-label={zone.duplicate ? undefined : zone.label}
      aria-hidden={zone.duplicate || undefined}
      tabIndex={zone.duplicate ? -1 : undefined}
      title={zone.duplicate ? undefined : zone.label}
      disabled={zone.disabled}
      onClick={zone.onClick}
    >
      {children}
    </button>
  );
}

/**
 * The team's five cards: rows on phones and cards in a row on wide screens, both drawn by CSS from the
 * same markup (D37).
 *
 * A card is one of four things (see `CardView`): waiting for the roll with a "?", rolled with its
 * agent and role, a random teammate's dimmed and dashed card, or an empty one with a "+". Every card
 * is the same size, because waiting, empty and random teammate cards carry an invisible line where a
 * rolled card has the player's name. The reveal is a CSS animation on each card, and a card is keyed
 * by its agent, so after a partial reroll only the changed cards play it.
 *
 * On the host's page a card has three tappable parts, each a real button, so a tap is never
 * ambiguous (D38). The card itself opens the agent window. Configure is a strip across the top of a
 * wide card, carrying the player's name and a dot for a joined friend, and a cog button beside the lock
 * on a phone row. The bar locks a pick, or removes a random teammate. The name and the dot are drawn
 * twice, once for each layout, and CSS hides the one that does not apply. A locked pick is a ring
 * round the card and a bar that reads Locked.
 */
export function CardRow({ cards, you, kept = [], zones }: Props) {
  return (
    <ul className="cards">
      {cards.map((card) => {
        const z = zones?.(card) ?? {};
        const isKept = card.rollId !== undefined && kept.includes(card.rollId);
        const hasAgent = card.agent !== undefined && card.role !== undefined;
        const plain = card.state === "empty" || card.state === "waiting" || !hasAgent;
        const name = card.name ?? "";
        const bar = z.bar;
        // What the strip says: the player's name, or what kind of card it is when nobody is on it.
        const heading = card.state === "teammate" ? "Random teammate" : card.state === "empty" ? "Empty" : name;

        return (
          <li key={card.key} className="card-item">
            <div
              className={`card ${plain ? "slot" : card.role}`}
              data-state={card.state}
              data-you={you !== undefined && name !== "" && keyForName(name) === keyForName(you)}
              data-kept={isKept}
              data-outside={card.state === "teammate"}
            >
              {/* Configure: a strip across the top, or a cog beside the lock on a phone */}
              <Part zone={z.config} className="card-config">
                {card.state !== "empty" && <OnlineDot name={name} online={card.online} className="head-dot" />}
                <span className="card-config-name">{heading}</span>
                {z.config && <CogIcon size={14} />}
              </Part>

              {/* The card itself: the portrait and the text, which open the agent window */}
              <Part zone={z.main} className="card-main">
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
                </span>

                {/* Text: role, then the agent, then the player (a phone row only: a wide card has the name in its strip) */}
                <span className="card-body">
                  {card.state === "empty" && (
                    <>
                      <span className="card-role">Empty</span>
                      <span className="card-agent">Add</span>
                      <span className="card-player" aria-hidden="true">&nbsp;</span>
                    </>
                  )}
                  {card.state === "waiting" && (
                    <>
                      <span className="card-role">Waiting</span>
                      <span className="card-agent">
                        <span className="phone-only">{name}</span>
                        <span className="wide-only">No agent</span>
                      </span>
                      <span className="card-player" aria-hidden="true">&nbsp;</span>
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
                        <span className="card-player">&nbsp;</span>
                      </>
                    ) : (
                      <>
                        <span className="card-role">Random</span>
                        <span className="card-agent">Pick agent</span>
                        <span className="card-player" aria-hidden="true">&nbsp;</span>
                      </>
                    ))}
                </span>
              </Part>

              {/* Bar: lock or unlock a player's pick, remove a random teammate, or blank */}
              {bar ? (
                <button
                  type="button"
                  className="card-bar"
                  data-kind={bar.kind}
                  data-on={bar.on === true}
                  aria-label={bar.label}
                  aria-pressed={bar.kind === "lock" ? bar.on === true : undefined}
                  title={bar.label}
                  disabled={bar.disabled}
                  onClick={bar.onClick}
                >
                  {bar.kind === "lock" ? <LockIcon size={16} /> : <TrashIcon size={16} />}
                  <span className="wide-only">{bar.text}</span>
                </button>
              ) : (
                <div className="card-bar" data-kind="none" aria-hidden="true" />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
