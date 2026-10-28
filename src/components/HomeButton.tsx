import { HomeIcon } from "./icons";

interface Props {
  /** What the button says: "Home" on the host's page, "Leave party" or "Cancel" on a friend's. */
  label: string;
  onClick: () => void;
}

/**
 * The way back to the entry page, shown at the top of the host's and a friend's page.
 *
 * A filled chip with a house icon rather than a text link, so it reads as a button. The entry page
 * is the only page that links back to the portfolio (D14), so this is the one way back from here.
 */
export function HomeButton({ label, onClick }: Props) {
  return (
    <button type="button" className="home-button" onClick={onClick}>
      <HomeIcon size={20} />
      <span>{label}</span>
    </button>
  );
}
