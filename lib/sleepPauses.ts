import type { SleepEvent, SleepPause } from '@/types';
import { minutesBetween } from '@/lib/dateUtils';

export function getPausesForSleep(
  pauses: SleepPause[],
  sleepEventId: string
): SleepPause[] {
  return pauses
    .filter((p) => p.sleepEventId === sleepEventId)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function getOngoingPause(
  pauses: SleepPause[],
  sleepEventId: string | undefined
): SleepPause | null {
  if (!sleepEventId) return null;
  return (
    pauses.find((p) => p.sleepEventId === sleepEventId && p.endTime === null) ?? null
  );
}

export function isSleepPaused(
  ongoing: SleepEvent | null,
  pauses: SleepPause[]
): boolean {
  return getOngoingPause(pauses, ongoing?.id) !== null;
}

/** Sleep duration minus pause intervals. */
export function getEffectiveSleepMinutes(
  startTime: string,
  endTime: string,
  pauses: SleepPause[]
): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  let total = minutesBetween(start, end);

  for (const pause of pauses) {
    if (!pause.endTime) continue;
    const pStart = new Date(pause.startTime);
    const pEnd = new Date(pause.endTime);
    if (pEnd <= start || pStart >= end) continue;
    const overlapStart = Math.max(pStart.getTime(), start.getTime());
    const overlapEnd = Math.min(pEnd.getTime(), end.getTime());
    if (overlapEnd > overlapStart) {
      total -= (overlapEnd - overlapStart) / (60 * 1000);
    }
  }

  return Math.max(0, Math.round(total));
}
