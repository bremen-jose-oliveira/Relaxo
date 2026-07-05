import type { SleepEvent, WakeEvent } from '@/types';
import { getMorningWakeForDay } from '@/lib/dayAnchor';
import { isSameDay } from '@/lib/dateUtils';
import { newId } from '@/lib/newId';

/** Today's wake-day is anchored (morning wake logged, or bedtime already ended). */
export function hasDayStartedToday(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date = new Date()
): boolean {
  if (getMorningWakeForDay(wakes, now)) return true;

  return events.some(
    (e) =>
      e.type === 'night' &&
      e.endTime !== null &&
      isSameDay(new Date(e.endTime), now)
  );
}

/** Create a morning wake when bedtime ends — skips if today already has one. */
export function buildMorningWakeAfterBedtime(
  babyId: string,
  bedtimeEndTime: string,
  wakes: WakeEvent[]
): WakeEvent | null {
  const endDay = new Date(bedtimeEndTime);
  if (getMorningWakeForDay(wakes, endDay)) return null;

  return {
    id: newId(),
    babyId,
    time: bedtimeEndTime,
    endTime: null,
    wakeType: 'morning',
    notes: null,
  };
}
