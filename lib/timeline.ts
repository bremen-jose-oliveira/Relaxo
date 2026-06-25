import type {
  DiaperEvent,
  FeedingEvent,
  SleepEvent,
  TimelineItem,
  WakeEvent,
} from '@/types';
import { getWakeDayBounds } from '@/lib/dayAnchor';
import { formatDateKey, isSameDay } from '@/lib/dateUtils';

export function buildTimeline(
  sleep: SleepEvent[],
  feedings: FeedingEvent[],
  diapers: DiaperEvent[],
  wakes: WakeEvent[] = []
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...sleep.map((data) => ({
      kind: 'sleep' as const,
      id: data.id,
      sortTime: data.startTime,
      data,
    })),
    ...feedings.map((data) => ({
      kind: 'feeding' as const,
      id: data.id,
      sortTime: data.startTime,
      data,
    })),
    ...diapers.map((data) => ({
      kind: 'diaper' as const,
      id: data.id,
      sortTime: data.time,
      data,
    })),
    ...wakes.map((data) => ({
      kind: 'wake' as const,
      id: data.id,
      sortTime: data.time,
      data,
    })),
  ];

  return items.sort(
    (a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime()
  );
}

export function filterTimelineForDay(items: TimelineItem[], day: Date): TimelineItem[] {
  return items.filter((item) => isSameDay(new Date(item.sortTime), day));
}

/** Filter timeline to a wake-day cycle (not calendar midnight). */
export function filterTimelineForWakeDay(
  items: TimelineItem[],
  sleep: SleepEvent[],
  wakes: WakeEvent[],
  anchorDate: Date,
  now: Date = new Date()
): TimelineItem[] {
  const { start, end } = getWakeDayBounds(sleep, wakes, anchorDate, now);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return items
    .filter((item) => {
      const t = new Date(item.sortTime).getTime();
      return t >= startMs && t < endMs;
    })
    .sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());
}

export function groupTimelineByDay(
  items: TimelineItem[],
  days: number,
  now: Date
): { date: string; items: TimelineItem[] }[] {
  const groups = new Map<string, TimelineItem[]>();

  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    groups.set(formatDateKey(day), []);
  }

  for (const item of items) {
    const key = formatDateKey(new Date(item.sortTime));
    if (groups.has(key)) {
      groups.get(key)!.push(item);
    }
  }

  return Array.from(groups.entries())
    .map(([date, dayItems]) => ({
      date,
      items: dayItems.sort(
        (a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime()
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function isOngoingFeeding(events: FeedingEvent[]): FeedingEvent | null {
  const sorted = [...events].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  const latest = sorted[0];
  if (latest && latest.endTime === null && latest.feedType === 'breast') return latest;
  return null;
}
