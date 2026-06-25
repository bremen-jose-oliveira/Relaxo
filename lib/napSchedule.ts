import type { Baby, NapGoal, SleepEvent, WakeEvent } from '@/types';
import { getDayCycleEvents } from '@/lib/dayAnchor';
import { ageInWeeks } from '@/lib/dateUtils';

/** DB stores 0 for automatic schedule. */
export const NAP_GOAL_AUTO_DB = 0;

const LOOKBACK_DAYS = 14;
const MIN_DAYS_TO_INFER = 3;

export type NapGoalSource = 'manual' | 'history' | 'age';

export type ResolvedNapGoal = {
  goal: NapGoal;
  source: NapGoalSource;
  historySampleDays?: number;
};

/** Age-based fallback when not enough sleep history (Napper learning phase). */
export function getAgeBasedNapGoal(weeks: number): NapGoal {
  if (weeks < 13) return 4;
  if (weeks < 30) return 3;
  return 2;
}

/** Infer typical naps per wake-day from recent logs; recent days weighted higher. */
export function inferNapGoalFromHistory(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date
): { goal: NapGoal; sampleDays: number } | null {
  const weights = new Map<NapGoal, number>();
  let sampleDays = 0;

  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    const dayEvents = getDayCycleEvents(events, wakes, day);
    const napCount = dayEvents.filter((e) => e.type === 'nap').length;
    if (napCount === 0) continue;

    sampleDays++;
    const clamped = Math.min(4, Math.max(2, napCount)) as NapGoal;
    const dayWeight = LOOKBACK_DAYS - i + 1;
    weights.set(clamped, (weights.get(clamped) ?? 0) + dayWeight);
  }

  if (sampleDays < MIN_DAYS_TO_INFER) return null;

  let bestGoal: NapGoal = 3;
  let bestWeight = -1;
  for (const [goal, weight] of weights) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestGoal = goal;
    }
  }

  return { goal: bestGoal, sampleDays };
}

export function resolveNapGoal(
  baby: Baby,
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date = new Date()
): ResolvedNapGoal {
  if (baby.napGoal !== null) {
    return { goal: baby.napGoal, source: 'manual' };
  }

  const inferred = inferNapGoalFromHistory(events, wakes, now);
  if (inferred) {
    return {
      goal: inferred.goal,
      source: 'history',
      historySampleDays: inferred.sampleDays,
    };
  }

  const weeks = ageInWeeks(baby.birthDate, now);
  return { goal: getAgeBasedNapGoal(weeks), source: 'age' };
}

export function formatNapScheduleLabel(resolved: ResolvedNapGoal): string {
  if (resolved.source === 'manual') {
    return `${resolved.goal} naps (your routine)`;
  }
  if (resolved.source === 'history') {
    return `Automatic · ~${resolved.goal} naps from logs`;
  }
  return `Automatic · ~${resolved.goal} naps for age`;
}
