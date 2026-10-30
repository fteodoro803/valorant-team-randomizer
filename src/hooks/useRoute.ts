import { useCallback, useEffect, useRef, useState } from "react";
import { parseRoute, routeHash } from "../lib/route";
import type { Route } from "../lib/route";

/**
 * Which page the address shows, and a way to change it.
 *
 * Going to a page by code (`go`) writes the address with pushState, which tells the browser nothing
 * to react to, so the only `popstate` events are the person's own: Back, Forward or a typed address.
 * Those go through `allow` first. When it says no, the address is put back, so a Back press can ask a
 * question (end the party?) instead of leaving. The whole address is kept, not just the page, because
 * a join link (#/party/K7QD) carries a code after the page.
 */
export function useRoute(allow: (to: Route, from: Route) => boolean) {
  const [hash, setHash] = useState(() => window.location.hash);
  // The newest address and rule, read from the event, which outlives the render that added it.
  const live = useRef({ hash, allow });
  useEffect(() => {
    live.current.allow = allow;
  });

  useEffect(() => {
    const onPop = () => {
      const from = live.current.hash;
      const to = window.location.hash;
      if (to === from) return;
      if (parseRoute(to) !== parseRoute(from) && !live.current.allow(parseRoute(to), parseRoute(from))) {
        window.history.pushState(null, "", from || routeHash("entry"));
        return;
      }
      live.current.hash = to;
      setHash(to);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((to: Route, replace = false) => {
    if (parseRoute(window.location.hash) !== to) {
      if (replace) window.history.replaceState(null, "", routeHash(to));
      else window.history.pushState(null, "", routeHash(to));
    }
    live.current.hash = window.location.hash;
    setHash(window.location.hash);
  }, []);

  return { route: parseRoute(hash), hash, go };
}
