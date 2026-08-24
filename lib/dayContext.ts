import type {
  DayContextTag,
  DayContextTagEvent,
  SleepEvent,
  SleepPause,
  WakeEvent,
} from '@/types';
import { addDays, formatDateKey, startOfDay } from '@/lib/dateUtils';
import { getDaySleepInsights, type WakeReadiness } from '@/lib/sleepInsights';

/** Tags that usually mean more stimulation / disruption than a quiet home day. */
export const HIGH_STIM_TAGS: readonly DayContextTag[] = [
  'outing',
  'park',
  'visitors',
  'cafe',
  'shopping',
  'car',
  'transit',
  'baby_class',
  'travel',
] as const;

/** Health / recovery tags — useful for explaining odd sleep, not “busy outing”. */
export const CHALLENGE_TAGS: readonly DayContextTag[] = [
  'sick',
  'teething',
  'vaccination',
] as const;

export function isHighStimTag(tag: DayContextTag): boolean {
  return (HIGH_STIM_TAGS as readonly string[]).includes(tag);
}

export function isChallengeTag(tag: DayContextTag): boolean {
  return (CHALLENGE_TAGS as readonly string[]).includes(tag);
}

export function tagsForDate(
  rows: DayContextTagEvent[],
  dateKey: string
): DayContextTag[] {
  return rows.filter((r) => r.dateKey === dateKey).map((r) => r.tag);
}

export function dayHasHighStim(tags: DayContextTag[]): boolean {
  return tags.some(isHighStimTag);
}

export function dayHasChallenge(tags: DayContextTag[]): boolean {
  return tags.some(isChallengeTag);
}

/** Soft calm-window nudge: busy day and not already past the wake window. */
export function shouldSuggestCalmWindow(input: {
  tags: DayContextTag[];
  wakeReadiness: WakeReadiness | null;
  easilyOverstimulated?: boolean;
  asleep?: boolean;
}): boolean {
  if (input.asleep) return false;
  if (!dayHasHighStim(input.tags)) return false;
  if (input.wakeReadiness === 'ready') return false;
  if (input.wakeReadiness === 'rested' || input.wakeReadiness === 'prepare') {
    return true;
  }
  // No readiness yet — still nudge when profile is easily overstimulated.
  return input.easilyOverstimulated === true;
}

/** Show a short “today’s context” line when tags exist and sleep looks uncertain. */
export function shouldExplainDayContext(input: {
  tags: DayContextTag[];
  confidence?: 'low' | 'medium' | 'high' | null;
  wakeReadiness?: WakeReadiness | null;
}): boolean {
  if (input.tags.length === 0) return false;
  if (input.confidence === 'low') return true;
  if (input.wakeReadiness === 'ready') return true;
  if (dayHasHighStim(input.tags) || dayHasChallenge(input.tags)) return true;
  return input.tags.length > 0;
}

export function formatDayContextLabelList(
  tags: DayContextTag[],
  labelFor: (tag: DayContextTag) => string
): string {
  return tags.map(labelFor).join(' · ');
}

export type BusyQuietCompare = {
  lookbackDays: number;
  busyDays: number;
  quietDays: number;
  busyAvgNapMinutes: number | null;
  quietAvgNapMinutes: number | null;
  busyAvgWakeWindowMinutes: number | null;
  quietAvgWakeWindowMinutes: number | null;
  napDelta: number | null;
  wakeDelta: number | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Compare nap / wake-window averages on high-stim (“busy”) days vs other days
 * over the lookback window. Only days with at least one completed nap count.
 */
export function compareBusyVsQuietDays(
  events: SleepEvent[],
  pauses: SleepPause[],
  wakes: WakeEvent[],
  dayContextTags: DayContextTagEvent[],
  now: Date,
  lookbackDays = 14
): BusyQuietCompare {
  const todayStart = startOfDay(now);
  const tagsByDay = new Map<string, DayContextTag[]>();
  for (const row of dayContextTags) {
    const list = tagsByDay.get(row.dateKey) ?? [];
    list.push(row.tag);
    tagsByDay.set(row.dateKey, list);
  }

  const busyNaps: number[] = [];
  const quietNaps: number[] = [];
  const busyWakes: number[] = [];
  const quietWakes: number[] = [];
  let busyDays = 0;
  let quietDays = 0;

  for (let i = 0; i < lookbackDays; i++) {
    const day = addDays(todayStart, -i);
    const key = formatDateKey(day);
    const insights = getDaySleepInsights(events, pauses, wakes, day, now);
    if (insights.napCount <= 0) continue;

    const tags = tagsByDay.get(key) ?? [];
    const busy = dayHasHighStim(tags);
    const avgNap =
      insights.napCount > 0 && insights.daytimeSleepMinutes > 0
        ? Math.round(insights.daytimeSleepMinutes / insights.napCount)
        : insights.longestNapMinutes;

    if (busy) {
      busyDays += 1;
      if (avgNap != null) busyNaps.push(avgNap);
      if (insights.avgWakeWindowMinutes != null) {
        busyWakes.push(insights.avgWakeWindowMinutes);
      }
    } else {
      quietDays += 1;
      if (avgNap != null) quietNaps.push(avgNap);
      if (insights.avgWakeWindowMinutes != null) {
        quietWakes.push(insights.avgWakeWindowMinutes);
      }
    }
  }

  const busyAvgNapMinutes = average(busyNaps);
  const quietAvgNapMinutes = average(quietNaps);
  const busyAvgWakeWindowMinutes = average(busyWakes);
  const quietAvgWakeWindowMinutes = average(quietWakes);

  return {
    lookbackDays,
    busyDays,
    quietDays,
    busyAvgNapMinutes,
    quietAvgNapMinutes,
    busyAvgWakeWindowMinutes,
    quietAvgWakeWindowMinutes,
    napDelta:
      busyAvgNapMinutes != null && quietAvgNapMinutes != null
        ? busyAvgNapMinutes - quietAvgNapMinutes
        : null,
    wakeDelta:
      busyAvgWakeWindowMinutes != null && quietAvgWakeWindowMinutes != null
        ? busyAvgWakeWindowMinutes - quietAvgWakeWindowMinutes
        : null,
  };
}
