import { useEffect, useState } from 'react';
import {
  getCurrentSegmentElapsedMs,
  getSleepElapsedMs,
  formatElapsedClock,
} from '@/lib/elapsedTime';
import { getOngoingPause } from '@/lib/sleepPauses';
import type { SleepPause } from '@/types';

export type SleepTimerDisplay = {
  segmentClock: string;
  totalClock: string;
  showTotalLine: boolean;
  paused: boolean;
};

export function useSleepTimerDisplay(
  active: boolean,
  sleepEventId: string | undefined,
  startTime: string | undefined,
  pauses: SleepPause[],
  paused: boolean
): SleepTimerDisplay {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active || !startTime) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active, startTime]);

  if (!active || !startTime || !sleepEventId) {
    return { segmentClock: '0:00', totalClock: '0:00', showTotalLine: false, paused: false };
  }

  const sleepStart = new Date(startTime);
  const openPause = getOngoingPause(pauses, sleepEventId);

  if (paused && openPause) {
    const pauseStart = new Date(openPause.startTime);
    const awakeMs = Math.max(0, now.getTime() - pauseStart.getTime());
    const totalMs = getSleepElapsedMs(sleepStart, pauseStart, sleepEventId, pauses);
    return {
      segmentClock: formatElapsedClock(awakeMs),
      totalClock: formatElapsedClock(totalMs),
      showTotalLine: false,
      paused: true,
    };
  }

  const totalMs = getSleepElapsedMs(sleepStart, now, sleepEventId, pauses);
  const segmentMs = getCurrentSegmentElapsedMs(
    sleepStart,
    now,
    sleepEventId,
    pauses,
    false
  );

  return {
    segmentClock: formatElapsedClock(segmentMs),
    totalClock: formatElapsedClock(totalMs),
    showTotalLine: totalMs - segmentMs > 1000,
    paused: false,
  };
}

/** @deprecated use useSleepTimerDisplay */
export function useSleepElapsedClock(
  active: boolean,
  sleepEventId: string | undefined,
  startTime: string | undefined,
  pauses: SleepPause[]
): string {
  const { segmentClock, totalClock, showTotalLine } = useSleepTimerDisplay(
    active,
    sleepEventId,
    startTime,
    pauses,
    false
  );
  return showTotalLine ? totalClock : segmentClock;
}
