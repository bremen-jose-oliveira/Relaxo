import type { SleepEvent, WakeEvent } from '@/types';
import { isSameDay, startOfDay } from '@/lib/dateUtils';

/** Latest morning wake on the given calendar day. */
export function getMorningWakeForDay(wakes: WakeEvent[], day: Date): WakeEvent | null {
  const matches = wakes
    .filter((w) => w.wakeType === 'morning' && isSameDay(new Date(w.time), day))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return matches[0] ?? null;
}

/** When the current wake-day started (morning wake or night-sleep end). Null if unknown. */
export function getDayStartTime(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): Date | null {
  const morning = getMorningWakeForDay(wakes, now);
  if (morning) return new Date(morning.time);

  const nightEnd = events
    .filter((e) => e.type === 'night' && e.endTime !== null)
    .map((e) => new Date(e.endTime!))
    .filter((t) => t.getTime() <= now.getTime() && isSameDay(t, now))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (nightEnd) return nightEnd;
  return null;
}

/** Day start for a historical calendar day (used in wake-window averages). */
export function getDayStartForHistoricalDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): Date {
  const morning = getMorningWakeForDay(wakes, day);
  if (morning) return new Date(morning.time);

  const nightEnd = events
    .filter((e) => e.type === 'night' && e.endTime !== null)
    .filter((e) => isSameDay(new Date(e.endTime!), day))
    .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

  if (nightEnd) return new Date(nightEnd.endTime!);
  return startOfDay(day);
}

/** Sleep events in a wake-day cycle (morning wake → next morning wake). */
export function getDayCycleEvents(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): SleepEvent[] {
  const dayStart = getDayStartForHistoricalDay(events, wakes, day);
  const nextMorning = wakes
    .filter((w) => w.wakeType === 'morning')
    .map((w) => new Date(w.time))
    .filter((t) => t.getTime() > dayStart.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const cycleEnd =
    nextMorning ??
    (() => {
      const end = new Date(dayStart);
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
      return end;
    })();

  return events
    .filter((e) => e.endTime !== null)
    .filter((e) => {
      const start = new Date(e.startTime);
      return start.getTime() >= dayStart.getTime() && start.getTime() < cycleEnd.getTime();
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

/** Wake-day cycle bounds for timeline (morning wake → next morning wake). */
export function getWakeDayBounds(
  events: SleepEvent[],
  wakes: WakeEvent[],
  anchorDate: Date,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = getDayStartForHistoricalDay(events, wakes, anchorDate);
  const nextMorning = wakes
    .filter((w) => w.wakeType === 'morning')
    .map((w) => new Date(w.time))
    .filter((t) => t.getTime() > start.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (nextMorning) {
    return { start, end: nextMorning };
  }

  if (isSameDay(anchorDate, now)) {
    const end = new Date(now);
    end.setMinutes(end.getMinutes() + 1);
    return { start, end };
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function formatWakeDayRange(start: Date, end: Date): string {
  const sameDay = isSameDay(start, end);
  const startStr = start.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (sameDay) {
    return `${startStr} → ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  const endStr = end.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${startStr} → ${endStr}`;
}

/** Completed naps since today's day start (not calendar midnight). */
export function countNapsSinceDayStart(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): number {
  const dayStart = getDayStartTime(events, wakes, now);
  if (!dayStart) {
    return events.filter(
      (e) =>
        e.type === 'nap' &&
        e.endTime !== null &&
        isSameDay(new Date(e.startTime), now)
    ).length;
  }
  return events.filter(
    (e) =>
      e.type === 'nap' &&
      e.endTime !== null &&
      new Date(e.startTime).getTime() >= dayStart.getTime()
  ).length;
}
