import type { NapGoal, SleepEvent, SleepSlot, WakeEvent } from '@/types';
import { getBedtimeSlot } from '@/lib/predictNextSleep';
import { getDayCycleEvents } from '@/lib/dayAnchor';
import { startOfDay } from '@/lib/dateUtils';

/** Long enough to cover typical Napper imports for young infants. */
export const SLEEP_PATTERN_LOOKBACK_DAYS = 120;
/** Usual-times board uses recent rhythm, not the full import window. */
export const USUAL_TIMES_LOOKBACK_DAYS = 14;
const MIN_SAMPLES = 1;
/** Soft ceiling so one noisy day cannot invent endless slots. */
const MAX_NAP_ORDINALS = 8;

const NAP_ORDINAL_LABELS = [
  '1st nap',
  '2nd nap',
  '3rd nap',
  '4th nap',
  '5th nap',
  '6th nap',
  '7th nap',
  '8th nap',
] as const;

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

function napOrdinalLabel(index: number): string {
  return NAP_ORDINAL_LABELS[index] ?? `Nap ${index + 1}`;
}

/**
 * Nap start minutes (in order) plus bedtime from night sleeps on a calendar day.
 * Uses event type — not nap-goal caps — so evening naps stay naps.
 */
export function getNapAndBedtimeStartsForDay(
  events: SleepEvent[],
  wakes: WakeEvent[],
  day: Date
): { naps: number[]; bedtime: number | null } {
  const dayEvents = getDayCycleEvents(events, wakes, day);
  const naps: number[] = [];
  let bedtime: number | null = null;

  for (const event of dayEvents) {
    const minutes = minutesFromMidnight(new Date(event.startTime));
    if (event.type === 'night') {
      bedtime = minutes;
    } else {
      naps.push(minutes);
    }
  }

  return { naps, bedtime };
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
  /** Stable row id: `nap-0` … or `bedtime`. */
  id: string;
  /** @deprecated Prefer `id`; kept for older call sites that keyed on slot index. */
  slot: number | 'bedtime';
  slotLabel: string;
  typicalTime: Date;
  sampleCount: number;
};

/**
 * Typical start times from recent logs: every nap ordinal that appears,
 * plus bedtime — not capped at 4 naps / nap-goal.
 */
export function getTypicalSleepSchedule(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date,
  _napGoal?: NapGoal,
  lookbackDays: number = USUAL_TIMES_LOOKBACK_DAYS
): TypicalSlotStart[] {
  const napSamples: number[][] = Array.from({ length: MAX_NAP_ORDINALS }, () => []);
  const bedtimeSamples: number[] = [];

  for (let i = 0; i < lookbackDays; i++) {
    const day = startOfDay(now);
    day.setDate(day.getDate() - i);
    const { naps, bedtime } = getNapAndBedtimeStartsForDay(events, wakes, day);

    for (let n = 0; n < Math.min(naps.length, MAX_NAP_ORDINALS); n++) {
      napSamples[n]!.push(naps[n]!);
    }
    if (bedtime !== null) {
      bedtimeSamples.push(bedtime);
    }
  }

  const result: TypicalSlotStart[] = [];

  for (let n = 0; n < MAX_NAP_ORDINALS; n++) {
    const samples = napSamples[n]!;
    if (samples.length < MIN_SAMPLES) continue;
    result.push({
      id: `nap-${n}`,
      slot: n,
      slotLabel: napOrdinalLabel(n),
      typicalTime: minutesToDate(median(samples), now),
      sampleCount: samples.length,
    });
  }

  if (bedtimeSamples.length >= MIN_SAMPLES) {
    result.push({
      id: 'bedtime',
      slot: 'bedtime',
      slotLabel: 'bedtime',
      typicalTime: minutesToDate(median(bedtimeSamples), now),
      sampleCount: bedtimeSamples.length,
    });
  }

  return result;
}
