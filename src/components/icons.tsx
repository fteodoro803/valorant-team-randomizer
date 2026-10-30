import type { ReactNode } from "react";

interface IconProps {
  /** Width and height in pixels. */
  size?: number;
}

/** Shared look for the small line icons: drawn in the button's text colour. */
const Icon = ({ children, size = 18 }: IconProps & { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** A bin, for deleting a saved person for good. */
export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
);

/** A person with a minus, for taking someone off the team but keeping them saved. */
export const UserMinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
    <path d="M17 8h5" />
  </Icon>
);

export const BanIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);

/** A plus, for steppers. */
export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);

/** A minus, for steppers. */
export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
  </Icon>
);

/** A cross, for closing a message. */
export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
);

/** A house, for the way back to the entry page. */
export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h4v-5h4v5h4v-9" />
  </Icon>
);

/** An arrow pointing right, for a button that moves on to the next page. */
export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Icon>
);

/** A padlock, for locking a player's pick through the next Roll. */
export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icon>
);

/** A person's head and shoulders, for the button that opens Configure. */
export const ProfileIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </Icon>
);
