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

/** Three dots in a column, for a row's options menu. */
export const KebabIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" />
  </Icon>
);

/** A circle with a slash, for bans. */
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
