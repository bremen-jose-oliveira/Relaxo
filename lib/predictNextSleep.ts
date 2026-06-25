import type { Baby, NapGoal, SleepEvent, SleepPause, SleepSlot, WakeEvent } from '@/types';
import { resolveNapGoal, type NapGoalSource } from '@/lib/napSchedule';
import { getWakeDayBounds } from '@/lib/dayAnchor';
import {
  groupPausesByEventId,
  totalSleepMinutesInRange,
} from '@/lib/sleepTotals';
import {
  countNapsSinceDayStart,
  getDayCycleEvents,
  getDayStartForHistoricalDay,
  getDayStartTime,
} from '@/lib/dayAnchor';
import {
  ageInWeeks,
  formatDateKey,
  isSameDay,
  minutesBetween,
  startOfDay,
} from '@/lib/dateUtils';

// General reference wake-window ranges (minutes awake), NOT medical advice.
// Tweak these constants as needed for your baby.
const WAKE_WINDOW_RANGES: { maxWeeks: number; min: number; max: number }[] = [
  { maxWeeks: 12, min: 45, max: 90 }, // 0–12 weeks
  { maxWeeks: 17, min: 75, max: 120 }, // 3–4 months (~13–17 wks)
  { maxWeeks: 26, min: 120, max: 150 }, // 5–6 months
  { maxWeeks: 39, min: 150, max: 210 }, // 7–9 months
  { maxWeeks: 52, min: 180, max: 240 }, // 10–12 months
  { maxWeeks: 78, min: 240, max: 300 }, // 13–18 months
  { maxWeeks: Infinity, min: 300, max: 360 }, // 19+ months
];

const NAP_SLOT_LABELS = ['1st nap', '2nd nap', '3rd nap', '4th nap'] as const;

const HISTORY_DAYS = 14;
const SAMPLES_FOR_FULL_CONFIDENCE = 5;

export function getBedtimeSlot(napGoal: NapGoal): SleepSlot {
  return napGoal as SleepSlot;
}

export function getSlotLabel(slot: SleepSlot, napGoal: NapGoal = 3): string {
  if (slot >= napGoal) return 'bedtime';
  return NAP_SLOT_LABELS[slot as 0 | 1 | 2 | 3] ?? 'nap';
}

export function getAgeWakeWindowRange(weeks: number): { min: number; max: number } {
  for (const range of WAKE_WINDOW_RANGES) {
    if (weeks <= range.maxWeeks) {
      return { min: range.min, max: range.max };
    }
  }
  const last = WAKE_WINDOW_RANGES[WAKE_WINDOW_RANGES.length - 1];
  return { min: last.min, max: last.max };
}

export function getAgeDefaultMidpoint(weeks: number): number {
  const { min, max } = getAgeWakeWindowRange(weeks);
  return (min + max) / 2;
}

/** Completed naps since today's day start (morning wake, not midnight). */
export function countNapsToday(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): number {
  return countNapsSinceDayStart(events, wakes, now);
}

/** Next sleep slot based on naps since morning wake and nap goal. */
export function getCurrentSlot(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date,
  napGoal: NapGoal = 3
): SleepSlot {
  const napsToday = countNapsToday(events, wakes, now);
  if (napsToday >= napGoal) return getBedtimeSlot(napGoal);
  return napsToday as SleepSlot;
}

function getCompletedEvents(events: SleepEvent[]): SleepEvent[] {
  return events
    .filter((e) => e.endTime !== null)
    .sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
}

function getEventsForDay(events: SleepEvent[], day: Date): SleepEvent[] {
  return getCompletedEvents(events).filter((e) =>
    isSameDay(new Date(e.startTime), day)
  );
}

/**
 * For a given day, compute wake-window lengths before each nap (slots 0–2)
 * and before bedtime (slot 3).
 */
export function getWakeWindowsBySlotForDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date,
  napGoal: NapGoal = 3
): Partial<Record<SleepSlot, number>> {
  const dayStart = getDayStartForHistoricalDay(events, wakes, day);
  const dayEvents = getDayCycleEvents(events, wakes, day);
  if (dayEvents.length === 0) return {};

  const result: Partial<Record<SleepSlot, number>> = {};
  let napIndex = 0;
  const bedtimeSlot = getBedtimeSlot(napGoal);

  for (let i = 0; i < dayEvents.length; i++) {
    const event = dayEvents[i];
    const prevEnd =
      i === 0 ? dayStart : new Date(dayEvents[i - 1].endTime!);
    const wakeMinutes = minutesBetween(prevEnd, new Date(event.startTime));

    if (event.type === 'nap' && napIndex < napGoal) {
      result[napIndex as SleepSlot] = wakeMinutes;
      napIndex++;
    } else if (event.type === 'night') {
      result[bedtimeSlot] = wakeMinutes;
    }
  }

  return result;
}

/** Average wake-window for a specific slot over the last HISTORY_DAYS days. */
export function getPersonalAverageForSlot(
  events: SleepEvent[],
  wakes: WakeEvent[],
  slot: SleepSlot,
  now: Date,
  napGoal: NapGoal = 3
): { average: number | null; sampleCount: number } {
  const samples: number[] = [];

  for (let i = 1; i <= HISTORY_DAYS; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    const slotWindows = getWakeWindowsBySlotForDay(events, wakes, day, napGoal);
    const value = slotWindows[slot];
    if (value !== undefined && value > 0 && value < 12 * 60) {
      samples.push(value);
    }
  }

  if (samples.length === 0) {
    return { average: null, sampleCount: 0 };
  }

  const average = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { average, sampleCount: samples.length };
}

export function getLastWakeUpTime(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): Date | null {
  if (isCurrentlyAsleep(events)) return null;

  const dayStart = getDayStartTime(events, wakes, now);
  const completed = dayStart
    ? getCompletedEvents(events).filter(
        (e) => new Date(e.endTime!).getTime() >= dayStart.getTime()
      )
    : getCompletedEvents(events);

  if (completed.length > 0) {
    return new Date(completed[completed.length - 1].endTime!);
  }

  if (dayStart) return dayStart;
  return null;
}

export function isCurrentlyAsleep(events: SleepEvent[]): SleepEvent | null {
  const sorted = [...events].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
  const latest = sorted[0];
  if (latest && latest.endTime === null) return latest;
  return null;
}

export type PredictResult = {
  predictedTime: Date;
  confidence: 'low' | 'medium' | 'high';
  slot: SleepSlot;
  slotLabel: string;
  personalWeight: number;
  resolvedNapGoal: NapGoal;
  napGoalSource: NapGoalSource;
};

export function predictNextSleep(
  events: SleepEvent[],
  wakes: WakeEvent[],
  baby: Baby,
  now: Date
): PredictResult {
  const weeks = ageInWeeks(baby.birthDate, now);
  const ageDefaultMidpoint = getAgeDefaultMidpoint(weeks);
  const { goal: napGoal, source: napGoalSource } = resolveNapGoal(
    baby,
    events,
    wakes,
    now
  );
  const slot = getCurrentSlot(events, wakes, now, napGoal);
  const slotLabel = getSlotLabel(slot, napGoal);

  const { average: personalAvg, sampleCount } = getPersonalAverageForSlot(
    events,
    wakes,
    slot,
    now,
    napGoal
  );

  const personalWeight = Math.min(sampleCount / SAMPLES_FOR_FULL_CONFIDENCE, 1);

  const predictedWindowMinutes =
    personalWeight * (personalAvg ?? ageDefaultMidpoint) +
    (1 - personalWeight) * ageDefaultMidpoint;

  let lastWakeUp = getLastWakeUpTime(events, wakes, now);
  if (!lastWakeUp) {
    lastWakeUp = now;
  }

  const predictedTime = new Date(
    lastWakeUp.getTime() + predictedWindowMinutes * 60 * 1000
  );

  let confidence: 'low' | 'medium' | 'high';
  if (personalWeight < 0.3) confidence = 'low';
  else if (personalWeight < 0.8) confidence = 'medium';
  else confidence = 'high';

  return {
    predictedTime,
    confidence,
    slot,
    slotLabel,
    personalWeight,
    resolvedNapGoal: napGoal,
    napGoalSource,
  };
}

/** Group events by day for history view. */
export function groupEventsByDay(
  events: SleepEvent[],
  days: number,
  now: Date
): { date: string; events: SleepEvent[] }[] {
  const completed = getCompletedEvents(events);
  const groups = new Map<string, SleepEvent[]>();

  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    groups.set(formatDateKey(day), []);
  }

  for (const event of completed) {
    const key = formatDateKey(new Date(event.startTime));
    if (groups.has(key)) {
      groups.get(key)!.push(event);
    }
  }

  return Array.from(groups.entries())
    .map(([date, dayEvents]) => ({
      date,
      events: dayEvents.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Daytime sleep totals for trend chart (last N days). */
export function getDaytimeSleepTrend(
  events: SleepEvent[],
  days: number,
  now: Date
): { date: string; label: string; napCount: number; totalMinutes: number }[] {
  const result: {
    date: string;
    label: string;
    napCount: number;
    totalMinutes: number;
  }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const key = formatDateKey(day);

    const dayEvents = getEventsForDay(events, day);
    const naps = dayEvents.filter((e) => e.type === 'nap');
    const totalMinutes = naps.reduce((sum, e) => {
      return sum + minutesBetween(new Date(e.startTime), new Date(e.endTime!));
    }, 0);

    result.push({
      date: key,
      label: day.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      napCount: naps.length,
      totalMinutes: Math.round(totalMinutes),
    });
  }

  return result;
}

function overlapMinutes(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  if (end <= start) return 0;
  return (end - start) / (60 * 1000);
}

export function getSleepTrend(
  events: SleepEvent[],
  wakes: WakeEvent[],
  pauses: SleepPause[],
  days: number,
  now: Date
): { date: string; label: string; napCount: number; bedtimeCount: number; totalMinutes: number }[] {
  const completed = getCompletedEvents(events);
  const pausesByEventId = groupPausesByEventId(pauses);
  const result: {
    date: string;
    label: string;
    napCount: number;
    bedtimeCount: number;
    totalMinutes: number;
  }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const anchor = new Date(now);
    anchor.setDate(anchor.getDate() - i);
    anchor.setHours(0, 0, 0, 0);
    const key = formatDateKey(anchor);

    const { start: cycleStart, end: cycleEnd } = getWakeDayBounds(
      events,
      wakes,
      anchor,
      now
    );

    const cycleEvents = completed.filter((e) => {
      const start = new Date(e.startTime);
      return start.getTime() >= cycleStart.getTime() && start.getTime() < cycleEnd.getTime();
    });

    const napCount = cycleEvents.filter((e) => e.type === 'nap').length;
    const bedtimeCount = cycleEvents.filter((e) => e.type === 'night').length;

    const totalMinutes = totalSleepMinutesInRange(
      completed,
      pausesByEventId,
      cycleStart,
      cycleEnd
    );

    result.push({
      date: key,
      label: anchor.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      napCount,
      bedtimeCount,
      totalMinutes: Math.min(1440, totalMinutes),
    });
  }

  return result;
}

export function getSleepMetrics24h(events: SleepEvent[], now: Date): {
  total24hMinutes: number;
  daytimeTodayMinutes: number;
  nighttimeLastNightMinutes: number;
} {
  const completed = getCompletedEvents(events);

  const windowEnd = new Date(now);
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const todayStart = startOfDay(now);
  const todayDaytimeEnd = new Date(todayStart);
  todayDaytimeEnd.setHours(20, 0, 0, 0);

  const nightStart = new Date(todayStart);
  nightStart.setDate(nightStart.getDate() - 1);
  nightStart.setHours(20, 0, 0, 0);
  const nightEnd = new Date(todayStart);
  nightEnd.setHours(8, 0, 0, 0);

  const total24hMinutes = completed.reduce((sum, e) => {
    return (
      sum +
      overlapMinutes(
        new Date(e.startTime),
        new Date(e.endTime!),
        windowStart,
        windowEnd
      )
    );
  }, 0);

  const daytimeTodayMinutes = completed.reduce((sum, e) => {
    return (
      sum +
      overlapMinutes(
        new Date(e.startTime),
        new Date(e.endTime!),
        todayStart,
        todayDaytimeEnd
      )
    );
  }, 0);

  const nighttimeLastNightMinutes = completed.reduce((sum, e) => {
    return (
      sum +
      overlapMinutes(
        new Date(e.startTime),
        new Date(e.endTime!),
        nightStart,
        nightEnd
      )
    );
  }, 0);

  return {
    total24hMinutes: Math.round(total24hMinutes),
    daytimeTodayMinutes: Math.round(daytimeTodayMinutes),
    nighttimeLastNightMinutes: Math.round(nighttimeLastNightMinutes),
  };
}
