import type { BathEvent, DiaperEvent, FeedingEvent, SleepEvent, SleepPause, WakeEvent } from '@/types';
import { getDayViewBounds } from '@/lib/dayAnchor';
import { groupPausesByEventId, totalSleepMinutesInRange } from '@/lib/sleepTotals';

export type WakeDaySummary = {
  totalSleepMinutes: number;
  napCount: number;
  bedtimeCount: number;
  feedCount: number;
  breast: number;
  bottle: number;
  solid: number;
  diaperCount: number;
  wet: number;
  dirty: number;
  mixed: number;
  bathCount: number;
  wakeCount: number;
};

function inWakeRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function formatSleepDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getWakeDaySummary(
  events: SleepEvent[],
  sleepPauses: SleepPause[],
  feedings: FeedingEvent[],
  diapers: DiaperEvent[],
  baths: BathEvent[],
  wakes: WakeEvent[],
  anchorDate: Date,
  now: Date = new Date()
): WakeDaySummary & { mode: 'calendar' } {
  const { start, end, mode } = getDayViewBounds(events, wakes, anchorDate, now);
  const completed = events.filter((e) => e.endTime !== null);
  const pausesByEventId = groupPausesByEventId(sleepPauses);

  const cycleSleep = completed.filter((e) => inWakeRange(e.startTime, start, end));
  const napCount = cycleSleep.filter((e) => e.type === 'nap').length;
  const bedtimeCount = cycleSleep.filter((e) => e.type === 'night').length;

  const dayFeedings = feedings.filter((e) => inWakeRange(e.startTime, start, end));
  const dayDiapers = diapers.filter((e) => inWakeRange(e.time, start, end));
  const dayBaths = baths.filter((e) => inWakeRange(e.time, start, end));
  const dayWakes = wakes.filter((e) => inWakeRange(e.time, start, end));

  return {
    totalSleepMinutes: Math.min(
      1440,
      totalSleepMinutesInRange(cycleSleep, pausesByEventId, start, end)
    ),
    napCount,
    bedtimeCount,
    feedCount: dayFeedings.length,
    breast: dayFeedings.filter((e) => e.feedType === 'breast').length,
    bottle: dayFeedings.filter((e) => e.feedType === 'bottle').length,
    solid: dayFeedings.filter((e) => e.feedType === 'solid').length,
    diaperCount: dayDiapers.length,
    wet: dayDiapers.filter((e) => e.diaperType === 'wet').length,
    dirty: dayDiapers.filter((e) => e.diaperType === 'dirty').length,
    mixed: dayDiapers.filter((e) => e.diaperType === 'mixed').length,
    bathCount: dayBaths.length,
    wakeCount: dayWakes.length,
    mode,
  };
}
