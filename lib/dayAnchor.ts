import type { SleepEvent, WakeEvent } from '@/types';
import { isSameDay, startOfDay } from '@/lib/dateUtils';

export type DayViewMode = 'calendar';

/** Latest morning wake on the given calendar day (for timeline display / imports). */
export function getMorningWakeForDay(wakes: WakeEvent[], day: Date): WakeEvent | null {
  const matches = wakes
    .filter((w) => w.wakeType === 'morning' && isSameDay(new Date(w.time), day))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return matches[0] ?? null;
}

/** Calendar day bounds: midnight → next midnight (today ends at now). */
export function getCalendarDayBounds(
  anchorDate: Date,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = startOfDay(anchorDate);
  if (isSameDay(anchorDate, now)) {
    const end = new Date(now);
    end.setMinutes(end.getMinutes() + 1);
    return { start, end };
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Wake anchor for predictions: morning wake, last night-sleep end today, else midnight. */
function getEffectiveWakeAnchor(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): Date {
  const morning = getMorningWakeForDay(wakes, day);
  if (morning) return new Date(morning.time);

  const nightEndedToday = events
    .filter(
      (e) =>
        e.type === 'night' &&
        e.endTime !== null &&
        isSameDay(new Date(e.endTime), day)
    )
    .sort(
      (a, b) =>
        new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
    )[0];
  if (nightEndedToday?.endTime) return new Date(nightEndedToday.endTime);

  return startOfDay(day);
}

/** Start of today's wake window math (not calendar filtering). */
export function getDayStartTime(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): Date {
  return getEffectiveWakeAnchor(events, wakes, now);
}

export function getDayStartForHistoricalDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): Date {
  return getEffectiveWakeAnchor(events, wakes, day);
}

/** @deprecated wake-day anchors removed; always false. */
export function isWakeDayAnchored(
  _events: SleepEvent[],
  _wakes: WakeEvent[],
  _anchorDate: Date
): boolean {
  return false;
}

export function getDayViewBounds(
  _events: SleepEvent[],
  _wakes: WakeEvent[],
  anchorDate: Date,
  now: Date = new Date()
): { start: Date; end: Date; mode: DayViewMode } {
  const { start, end } = getCalendarDayBounds(anchorDate, now);
  return { start, end, mode: 'calendar' };
}

/** Completed sleep events that started on the given calendar day. */
export function getDayCycleEvents(
  events: SleepEvent[],
  _wakes: WakeEvent[],
  day: Date
): SleepEvent[] {
  const { start, end } = getCalendarDayBounds(day, day);
  const endMs = new Date(start);
  endMs.setDate(endMs.getDate() + 1);

  return events
    .filter((e) => e.endTime !== null)
    .filter((e) => {
      const t = new Date(e.startTime).getTime();
      return t >= start.getTime() && t < endMs.getTime();
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

/** Calendar-day bounds for timeline and charts. */
export function getWakeDayBounds(
  events: SleepEvent[],
  wakes: WakeEvent[],
  anchorDate: Date,
  now: Date = new Date()
): { start: Date; end: Date } {
  void events;
  void wakes;
  return getCalendarDayBounds(anchorDate, now);
}

export function formatCalendarDayLabel(day: Date): string {
  return day.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** @deprecated use formatCalendarDayLabel */
export function formatWakeDayRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return formatCalendarDayLabel(start);
  }
  return formatCalendarDayLabel(start);
}

/** Completed naps on today's calendar day. */
export function countNapsSinceDayStart(
  events: SleepEvent[],
  _wakes: WakeEvent[],
  now: Date
): number {
  return events.filter(
    (e) =>
      e.type === 'nap' &&
      e.endTime !== null &&
      isSameDay(new Date(e.startTime), now)
  ).length;
}
