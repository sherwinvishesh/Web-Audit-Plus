import { useEffect, useState } from 'react';

/** The current time, ticking while `live`. */
export function useNow(live: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [live, intervalMs]);
  return now;
}
