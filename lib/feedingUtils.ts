import type { FeedingEvent } from '@/types';

const INSTANT_TOLERANCE_MS = 1000;

/** Feed logged at a single moment (no duration tracking). */
export function isInstantFeeding(event: FeedingEvent): boolean {
  if (event.endTime === null) return false;
  const start = new Date(event.startTime).getTime();
  const end = new Date(event.endTime).getTime();
  return Math.abs(end - start) <= INSTANT_TOLERANCE_MS;
}

export function isOngoingFeeding(events: FeedingEvent[]): FeedingEvent | null {
  const sorted = [...events].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  const latest = sorted[0];
  if (latest && latest.endTime === null && latest.feedType === 'breast') return latest;
  return null;
}
