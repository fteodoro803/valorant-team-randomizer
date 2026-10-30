import { isPartyCode, normaliseCode } from "./party";

/** The three pages, each with its own address after the # so Back and refresh work (D44). A friend joins from #/party/<code> (D47). */
export type Route = "entry" | "host" | "party";

const HASHES: Record<Route, string> = { entry: "#/", host: "#/host", party: "#/party" };

/** The address that shows a page. */
export const routeHash = (route: Route): string => HASHES[route];

/** The address's path with the leading # and any slashes at the ends taken off. */
const pathOf = (hash: string) => hash.replace(/^#\/?/, "").replace(/\/+$/, "");

/** The page an address belongs to. Anything unknown, or no address at all, is the entry page. */
export function parseRoute(hash: string): Route {
  const path = pathOf(hash);
  if (path === "host") return "host";
  if (path === "party" || path.startsWith("party/")) return "party";
  return "entry";
}

/** The party code in a join link such as #/party/K7QD, or null when the address has none or it isn't a code. */
export function joinCodeOf(hash: string): string | null {
  const [page, code] = pathOf(hash).split("/");
  return page === "party" && code && isPartyCode(code) ? normaliseCode(code) : null;
}

/** The link a host shares: this page's address with the party's code on the end. */
export const joinLink = (base: string, code: string): string => `${base}${routeHash("party")}/${normaliseCode(code)}`;
