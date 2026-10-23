import type { ReactNode } from "react";

/** Shared look for the small line icons: drawn in the button's text colour. */
const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
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
export const TrashIcon = () => (
  <Icon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
);

/** A person with a plus, for putting a saved person on the team. */
export const UserPlusIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
    <path d="M19.5 5.5v5" />
    <path d="M17 8h5" />
  </Icon>
);

/** A person with a minus, for taking someone off the team but keeping them saved. */
export const UserMinusIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
    <path d="M17 8h5" />
  </Icon>
);
