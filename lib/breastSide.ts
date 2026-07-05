import type { FeedingEvent } from '@/types';

export type BreastSide = 'left' | 'right';

/** Most recent breast feed on a single side (skips "both"). */
export function getLastBreastSide(feedings: FeedingEvent[]): BreastSide | null {
  const sorted = [...feedings]
    .filter((f) => f.feedType === 'breast')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  for (const feed of sorted) {
    if (feed.side === 'left' || feed.side === 'right') return feed.side;
  }
  return null;
}

/** Napper-style: alternate from the last single-side breast feed. */
export function suggestNextBreastSide(feedings: FeedingEvent[]): BreastSide {
  const last = getLastBreastSide(feedings);
  if (!last) return 'left';
  return last === 'left' ? 'right' : 'left';
}

export function alternateBreastSide(side: BreastSide): BreastSide {
  return side === 'left' ? 'right' : 'left';
}
