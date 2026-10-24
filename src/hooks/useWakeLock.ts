import { useEffect } from "react";

/**
 * Asks the browser to keep the screen on while `active` is true.
 *
 * Browsers let go of the lock whenever the tab is hidden, so it is asked for again each time
 * the tab comes back to the front. Where the browser has no wake lock, or refuses, nothing
 * happens and the page works as it did, since a sleeping screen is an inconvenience here, not an error.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const request = () => {
      navigator.wakeLock
        .request("screen")
        .then((granted) => {
          // The party may have ended while the browser was deciding, so give it straight back.
          if (stopped) granted.release().catch(() => {});
          else lock = granted;
        })
        .catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
