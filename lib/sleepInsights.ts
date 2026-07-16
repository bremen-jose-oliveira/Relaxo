import type { NapExtension, SleepEvent, SleepPause, WakeEvent } from '@/types';
import { getCalendarDayBounds } from '@/lib/dayAnchor';
import { addDays, ageInWeeks, formatDateKey, minutesBetween, startOfDay } from '@/lib/dateUtils';
import { getAgeBasedNapGoal } from '@/lib/napSchedule';
import {
  getAgeWakeWindowRange,
  getWakeWindowsBySlotForDay,
} from '@/lib/predictNextSleep';
import {
  contributesToSleepTotals,
  groupPausesByEventId,
  sleepIntervalsMinusPauses,
  totalMinutesFromIntervals,
  totalSleepMinutesInRange,
} from '@/lib/sleepTotals';

export type NapEval = 'longer' | 'around' | 'shorter';
export type WakeReadiness = 'rested' | 'prepare' | 'ready';

export type DaySleepInsights = {
  daytimeSleepMinutes: number;
  napCount: number;
  avgWakeWindowMinutes: number | null;
  longestNapMinutes: number | null;
};

export type WeekSleepMetrics = {
  avgNapMinutes: number | null;
  daytimeSleepMinutes: number;
  avgWakeWindowMinutes: number | null;
  napCount: number;
};

export type WeekCompare = {
  avgNapDelta: number | null;
  daytimeSleepDelta: number;
  avgWakeWindowDelta: number | null;
  napCountDelta: number;
  thisWeek: WeekSleepMetrics;
  lastWeek: WeekSleepMetrics;
};

export type SleepStats = {
  avgNapMinutes: number | null;
  longestNapMinutes: number | null;
  avgNapsPerDay: number | null;
  avgWakeWindowMinutes: number | null;
  extensionSuccessPercent: number | null;
  avgDaytimeSleepMinutes: number | null;
};

export type AgeNorms = {
  typicalNaps: number;
  wakeWindowMin: number;
  wakeWindowMax: number;
  typicalDaytimeSleepMin: number;
  typicalDaytimeSleepMax: number;
};

const NAP_EVAL_BAND = 0.2;
const EXTENDED_VALUES: NapExtension[] = ['independent', 'feeding', 'rocking', 'contact'];

function napDurationMinutes(
  event: SleepEvent,
  pausesByEventId: Map<string, SleepPause[]>
): number | null {
  if (event.type !== 'nap' || !contributesToSleepTotals(event)) return null;
  const chunks = sleepIntervalsMinusPauses(event, pausesByEventId.get(event.id) ?? []);
  const minutes = totalMinutesFromIntervals(chunks);
  return minutes > 0 ? minutes : null;
}

function completedNapsInRange(
  events: SleepEvent[],
  rangeStart: Date,
  rangeEnd: Date
): SleepEvent[] {
  return events.filter((e) => {
    if (e.type !== 'nap' || !e.endTime) return false;
    const start = new Date(e.startTime).getTime();
    return start >= rangeStart.getTime() && start < rangeEnd.getTime();
  });
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Average nap duration (pause-aware) for naps started in [rangeStart, rangeEnd). */
export function getAverageNapMinutes(
  events: SleepEvent[],
  pauses: SleepPause[],
  rangeStart: Date,
  rangeEnd: Date
): number | null {
  const pausesByEventId = groupPausesByEventId(pauses);
  const durations = completedNapsInRange(events, rangeStart, rangeEnd)
    .map((e) => napDurationMinutes(e, pausesByEventId))
    .filter((m): m is number => m !== null);
  return average(durations);
}

export function getAverageNapForWindows(
  events: SleepEvent[],
  pauses: SleepPause[],
  now: Date
): { today: number | null; last7: number | null; last30: number | null } {
  const todayStart = startOfDay(now);
  const end = new Date(now.getTime() + 60_000);
  return {
    today: getAverageNapMinutes(events, pauses, todayStart, end),
    last7: getAverageNapMinutes(events, pauses, addDays(todayStart, -6), end),
    last30: getAverageNapMinutes(events, pauses, addDays(todayStart, -29), end),
  };
}

function avgWakeWindowsForDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): number | null {
  const windows = getWakeWindowsBySlotForDay(events, wakes, day);
  const values = Object.values(windows).filter(
    (m): m is number => typeof m === 'number' && m > 0 && m < 12 * 60
  );
  return average(values);
}

/** Daytime = naps only on that calendar day (not night sleep). */
export function getDaySleepInsights(
  events: SleepEvent[],
  pauses: SleepPause[],
  wakes: WakeEvent[],
  day: Date,
  now: Date = new Date()
): DaySleepInsights {
  const { start, end } = getCalendarDayBounds(day, now);
  const pausesByEventId = groupPausesByEventId(pauses);
  const naps = completedNapsInRange(events, start, end);
  const durations = naps
    .map((e) => napDurationMinutes(e, pausesByEventId))
    .filter((m): m is number => m !== null);

  const daytimeSleepMinutes = totalSleepMinutesInRange(
    naps,
    pausesByEventId,
    start,
    end
  );

  return {
    daytimeSleepMinutes: Math.min(720, daytimeSleepMinutes),
    napCount: naps.length,
    avgWakeWindowMinutes: avgWakeWindowsForDay(events, wakes, day),
    longestNapMinutes: durations.length > 0 ? Math.max(...durations) : null,
  };
}

function metricsForDayRange(
  events: SleepEvent[],
  pauses: SleepPause[],
  wakes: WakeEvent[],
  rangeStart: Date,
  rangeEndExclusive: Date,
  now: Date
): WeekSleepMetrics {
  const pausesByEventId = groupPausesByEventId(pauses);
  const naps = completedNapsInRange(events, rangeStart, rangeEndExclusive);
  const durations = naps
    .map((e) => napDurationMinutes(e, pausesByEventId))
    .filter((m): m is number => m !== null);

  let daytimeSleepMinutes = 0;
  const wakeWindows: number[] = [];
  let cursor = startOfDay(rangeStart);
  const endDay = startOfDay(addDays(rangeEndExclusive, -1));

  while (cursor.getTime() <= endDay.getTime()) {
    const dayInsights = getDaySleepInsights(events, pauses, wakes, cursor, now);
    daytimeSleepMinutes += dayInsights.daytimeSleepMinutes;
    if (dayInsights.avgWakeWindowMinutes != null) {
      wakeWindows.push(dayInsights.avgWakeWindowMinutes);
    }
    cursor = addDays(cursor, 1);
  }

  return {
    avgNapMinutes: average(durations),
    daytimeSleepMinutes,
    avgWakeWindowMinutes: average(wakeWindows),
    napCount: naps.length,
  };
}

/** Compare calendar Mon–Sun this week vs previous week (relative to `now`). */
export function compareSleepWeeks(
  events: SleepEvent[],
  pauses: SleepPause[],
  wakes: WakeEvent[],
  now: Date
): WeekCompare {
  const today = startOfDay(now);
  const dayOfWeek = today.getDay(); // 0 Sun
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisWeekStart = addDays(today, -daysSinceMonday);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisWeekEnd = addDays(thisWeekStart, 7);

  const thisWeek = metricsForDayRange(
    events,
    pauses,
    wakes,
    thisWeekStart,
    thisWeekEnd,
    now
  );
  const lastWeek = metricsForDayRange(
    events,
    pauses,
    wakes,
    lastWeekStart,
    thisWeekStart,
    now
  );

  return {
    thisWeek,
    lastWeek,
    avgNapDelta:
      thisWeek.avgNapMinutes != null && lastWeek.avgNapMinutes != null
        ? thisWeek.avgNapMinutes - lastWeek.avgNapMinutes
        : null,
    daytimeSleepDelta: thisWeek.daytimeSleepMinutes - lastWeek.daytimeSleepMinutes,
    avgWakeWindowDelta:
      thisWeek.avgWakeWindowMinutes != null && lastWeek.avgWakeWindowMinutes != null
        ? thisWeek.avgWakeWindowMinutes - lastWeek.avgWakeWindowMinutes
        : null,
    napCountDelta: thisWeek.napCount - lastWeek.napCount,
  };
}

export function getSleepStats(
  events: SleepEvent[],
  pauses: SleepPause[],
  wakes: WakeEvent[],
  now: Date,
  lookbackDays = 30
): SleepStats {
  const todayStart = startOfDay(now);
  const rangeStart = addDays(todayStart, -(lookbackDays - 1));
  const rangeEnd = new Date(now.getTime() + 60_000);
  const pausesByEventId = groupPausesByEventId(pauses);

  const naps = completedNapsInRange(events, rangeStart, rangeEnd);
  const durations = naps
    .map((e) => napDurationMinutes(e, pausesByEventId))
    .filter((m): m is number => m !== null);

  const daysWithNaps = new Set(naps.map((e) => formatDateKey(new Date(e.startTime))));
  const daytimeTotals: number[] = [];
  const wakeWindows: number[] = [];

  for (let i = 0; i < lookbackDays; i++) {
    const day = addDays(todayStart, -i);
    const insights = getDaySleepInsights(events, pauses, wakes, day, now);
    if (insights.napCount > 0) {
      daytimeTotals.push(insights.daytimeSleepMinutes);
    }
    if (insights.avgWakeWindowMinutes != null) {
      wakeWindows.push(insights.avgWakeWindowMinutes);
    }
  }

  const withExtensionAnswer = naps.filter((e) => e.extension != null);
  const extended = withExtensionAnswer.filter(
    (e) => e.extension != null && EXTENDED_VALUES.includes(e.extension)
  );

  return {
    avgNapMinutes: average(durations),
    longestNapMinutes: durations.length > 0 ? Math.max(...durations) : null,
    avgNapsPerDay:
      daysWithNaps.size > 0
        ? Math.round((naps.length / daysWithNaps.size) * 10) / 10
        : null,
    avgWakeWindowMinutes: average(wakeWindows),
    extensionSuccessPercent:
      withExtensionAnswer.length > 0
        ? Math.round((extended.length / withExtensionAnswer.length) * 100)
        : null,
    avgDaytimeSleepMinutes: average(daytimeTotals),
  };
}

/** Personal average nap length over the last `lookbackDays` (default 14). */
export function getPersonalNapAverageMinutes(
  events: SleepEvent[],
  pauses: SleepPause[],
  now: Date,
  lookbackDays = 14
): number | null {
  const todayStart = startOfDay(now);
  return getAverageNapMinutes(
    events,
    pauses,
    addDays(todayStart, -(lookbackDays - 1)),
    new Date(now.getTime() + 60_000)
  );
}

export function evaluateNapLength(
  minutes: number,
  personalAverage: number | null
): NapEval | null {
  if (personalAverage == null || personalAverage <= 0) return null;
  const high = personalAverage * (1 + NAP_EVAL_BAND);
  const low = personalAverage * (1 - NAP_EVAL_BAND);
  if (minutes > high) return 'longer';
  if (minutes < low) return 'shorter';
  return 'around';
}

/**
 * Wake readiness from awake minutes vs target window (personal avg preferred).
 * rested < 70% of target · prepare 70–100% · ready ≥ 100%
 */
export function getWakeReadiness(
  awakeMinutes: number,
  targetWakeMinutes: number
): WakeReadiness {
  if (targetWakeMinutes <= 0) return 'prepare';
  const ratio = awakeMinutes / targetWakeMinutes;
  if (ratio < 0.7) return 'rested';
  if (ratio < 1) return 'prepare';
  return 'ready';
}

/** Calendar age as "X months, Y days" (or days-only under 1 month). */
export function formatBabyAge(birthDate: string, now: Date, locale = 'en'): string {
  const birth = new Date(birthDate + 'T00:00:00');
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  let dayAnchor = new Date(birth);
  dayAnchor.setMonth(birth.getMonth() + months);
  if (dayAnchor > now) {
    months -= 1;
    dayAnchor = new Date(birth);
    dayAnchor.setMonth(birth.getMonth() + months);
  }
  const days = Math.max(
    0,
    Math.floor((now.getTime() - dayAnchor.getTime()) / (24 * 60 * 60 * 1000))
  );
  const safeMonths = Math.max(0, months);

  if (locale.startsWith('de')) {
    if (safeMonths === 0) return `${days} Tage`;
    if (days === 0) return safeMonths === 1 ? '1 Monat' : `${safeMonths} Monate`;
    return `${safeMonths} Mon., ${days} T.`;
  }

  if (safeMonths === 0) return days === 1 ? '1 day' : `${days} days`;
  if (days === 0) return safeMonths === 1 ? '1 month' : `${safeMonths} months`;
  return `${safeMonths} months, ${days} days`;
}

/** Rough daytime sleep norms by age (minutes) — reference only. */
function typicalDaytimeSleepRange(weeks: number): { min: number; max: number } {
  if (weeks < 13) return { min: 180, max: 360 };
  if (weeks < 26) return { min: 150, max: 270 };
  if (weeks < 39) return { min: 120, max: 210 };
  if (weeks < 52) return { min: 90, max: 180 };
  return { min: 60, max: 150 };
}

export function getAgeNorms(birthDate: string, now: Date): AgeNorms {
  const weeks = ageInWeeks(birthDate, now);
  const wake = getAgeWakeWindowRange(weeks);
  const daytime = typicalDaytimeSleepRange(weeks);
  return {
    typicalNaps: getAgeBasedNapGoal(weeks),
    wakeWindowMin: wake.min,
    wakeWindowMax: wake.max,
    typicalDaytimeSleepMin: daytime.min,
    typicalDaytimeSleepMax: daytime.max,
  };
}

export function napDurationForEvent(
  event: SleepEvent,
  pauses: SleepPause[]
): number | null {
  return napDurationMinutes(event, groupPausesByEventId(pauses));
}
