import type { NapGoal, SleepEvent, SleepSlot, WakeEvent } from '@/types';
import { getBedtimeSlot, getSlotLabel } from '@/lib/predictNextSleep';
import { getDayCycleEvents } from '@/lib/dayAnchor';
import { startOfDay } from '@/lib/dateUtils';

/** Long enough to cover typical Napper imports for young infants. */
export const SLEEP_PATTERN_LOOKBACK_DAYS = 120;
const MIN_SAMPLES = 1;

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function minutesToDate(minutes: number, now: Date): Date {
  const d = startOfDay(now);
  d.setMinutes(Math.round(minutes));
  return d;
}

/**
 * Start times (minutes from midnight) for each sleep slot on a calendar day.
 * Naps fill slots in order; night sleep (or sleeps beyond nap goal) map to bedtime.
 */
export function getStartMinutesBySlotForDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date,
  napGoal: NapGoal = 3
): Partial<Record<SleepSlot, number>> {
  const dayEvents = getDayCycleEvents(events, wakes, day);
  if (dayEvents.length === 0) return {};

  const result: Partial<Record<SleepSlot, number>> = {};
  let napIndex = 0;
  const bedtimeSlot = getBedtimeSlot(napGoal);

  for (const event of dayEvents) {
    const minutes = minutesFromMidnight(new Date(event.startTime));
    const treatAsBedtime =
      event.type === 'night' || napIndex >= napGoal;

    if (treatAsBedtime) {
      result[bedtimeSlot] = minutes;
    } else {
      result[napIndex as SleepSlot] = minutes;
      napIndex++;
    }
  }

  return result;
}

/**
 * Typical clock start time for a sleep slot (median over lookback).
 * Returns null typicalTime when no samples exist.
 */
export function getTypicalStartTimeForSlot(
  events: SleepEvent[],
  wakes: WakeEvent[],
  slot: SleepSlot,
  now: Date,
  napGoal: NapGoal = 3,
  lookbackDays: number = SLEEP_PATTERN_LOOKBACK_DAYS
): { typicalTime: Date | null; sampleCount: number } {
  const samples: number[] = [];

  for (let i = 0; i < lookbackDays; i++) {
    const day = startOfDay(now);
    day.setDate(day.getDate() - i);

    const slotStarts = getStartMinutesBySlotForDay(events, wakes, day, napGoal);
    const value = slotStarts[slot];
    if (value !== undefined) {
      samples.push(value);
    }
  }

  if (samples.length < MIN_SAMPLES) {
    return { typicalTime: null, sampleCount: samples.length };
  }

  return {
    typicalTime: minutesToDate(median(samples), now),
    sampleCount: samples.length,
  };
}

export type TypicalSlotStart = {
  slot: SleepSlot;
  slotLabel: string;
  typicalTime: Date;
  sampleCount: number;
};

/**
 * Typical start times for every nap slot plus bedtime (slots with ≥1 sample).
 * Ordered: 1st nap → … → bedtime.
 */
export function getTypicalSleepSchedule(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date,
  napGoal: NapGoal = 3,
  lookbackDays: number = SLEEP_PATTERN_LOOKBACK_DAYS
): TypicalSlotStart[] {
  const bedtimeSlot = getBedtimeSlot(napGoal);
  const slots: SleepSlot[] = [];
  for (let i = 0; i < napGoal; i++) {
    slots.push(i as SleepSlot);
  }
  slots.push(bedtimeSlot);

  const result: TypicalSlotStart[] = [];
  for (const slot of slots) {
    const { typicalTime, sampleCount } = getTypicalStartTimeForSlot(
      events,
      wakes,
      slot,
      now,
      napGoal,
      lookbackDays
    );
    if (!typicalTime) continue;
    result.push({
      slot,
      slotLabel: getSlotLabel(slot, napGoal),
      typicalTime,
      sampleCount,
    });
  }
  return result;
}
