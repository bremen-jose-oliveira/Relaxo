import { useEffect, useState } from 'react';
import { getSleepElapsedMs, formatElapsedClock } from '@/lib/elapsedTime';
import type { SleepPause } from '@/types';

export function useSleepElapsedClock(
  active: boolean,
  sleepEventId: string | undefined,
  startTime: string | undefined,
  pauses: SleepPause[]
): string {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active || !startTime) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active, startTime]);

  if (!active || !startTime || !sleepEventId) return '0:00';

  const ms = getSleepElapsedMs(new Date(startTime), now, sleepEventId, pauses);
  return formatElapsedClock(ms);
}
