import { useEffect, useState } from 'react';

/**
 * The current time (epoch ms), refreshed every `refreshMs` (default: one minute).
 *
 * For render-time deadline checks ("is the 24-hour IRN cancel window still open?"). Reading
 * `Date.now()` while rendering is impure — the answer only changed when something else happened to
 * re-render the page, so a window could close while its button stayed on screen. Holding the time
 * in state keeps rendering pure and lets the deadline lapse on time.
 */
export function useNow(refreshMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  return now;
}
