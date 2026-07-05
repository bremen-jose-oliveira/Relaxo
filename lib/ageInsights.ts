import { getDayCycleEvents } from '@/lib/dayAnchor';
import { ageInWeeks } from '@/lib/dateUtils';
import { getAgeBasedNapGoal } from '@/lib/napSchedule';
import { getAgeWakeWindowRange } from '@/lib/predictNextSleep';
import type { NapGoal, SleepEvent, WakeEvent } from '@/types';

export type InsightCategory = 'sleep' | 'routine' | 'feeding' | 'development';

export type AgeInsightPeriod = {
  id: string;
  weekFrom: number;
  weekTo: number;
  category: InsightCategory;
};

export const AGE_INSIGHT_PERIODS: AgeInsightPeriod[] = [
  { id: 'newborn', weekFrom: 0, weekTo: 2, category: 'sleep' },
  { id: 'early', weekFrom: 3, weekTo: 6, category: 'sleep' },
  { id: 'preFour', weekFrom: 7, weekTo: 12, category: 'routine' },
  { id: 'fourMonth', weekFrom: 13, weekTo: 17, category: 'sleep' },
  { id: 'fiveMonth', weekFrom: 18, weekTo: 22, category: 'routine' },
  { id: 'sixMonth', weekFrom: 23, weekTo: 26, category: 'routine' },
  { id: 'sevenMonth', weekFrom: 27, weekTo: 30, category: 'development' },
  { id: 'eightMonth', weekFrom: 31, weekTo: 35, category: 'sleep' },
  { id: 'nineMonth', weekFrom: 36, weekTo: 39, category: 'development' },
  { id: 'tenMonth', weekFrom: 40, weekTo: 44, category: 'routine' },
  { id: 'elevenMonth', weekFrom: 45, weekTo: 48, category: 'development' },
  { id: 'twelveMonth', weekFrom: 49, weekTo: 52, category: 'routine' },
];

const FIRST_YEAR_MAX_WEEKS = 52;
const NAP_LOOKBACK_DAYS = 7;
const MIN_DAYS_FOR_PERSONAL = 2;

export type ResolvedAgeInsight = {
  periodId: string;
  category: InsightCategory;
  weeks: number;
  titleKey: string;
  bodyKey: string;
  upcomingKey?: string;
  params: Record<string, string | number>;
  personalKey?: string;
  personalParams?: Record<string, string | number>;
  temperamentKeys: string[];
};

export type BabyTemperament = {
  easilyOverstimulated: boolean;
  highNeed: boolean;
};

export function resolveTemperamentTipKeys(temperament: BabyTemperament): string[] {
  if (temperament.easilyOverstimulated && temperament.highNeed) {
    return ['insights.temperament_both'];
  }
  const keys: string[] = [];
  if (temperament.easilyOverstimulated) keys.push('insights.temperament_overstimulated');
  if (temperament.highNeed) keys.push('insights.temperament_highNeed');
  return keys;
}

export function insightKey(periodId: string, part: 'title' | 'body' | 'upcoming'): string {
  return `insights.period_${periodId}_${part}`;
}

export function categoryKey(category: InsightCategory): string {
  return `insights.cat_${category}`;
}

export function findPeriodForWeeks(weeks: number): AgeInsightPeriod {
  const clamped = Math.min(weeks, FIRST_YEAR_MAX_WEEKS);
  const match = AGE_INSIGHT_PERIODS.find((p) => clamped >= p.weekFrom && clamped <= p.weekTo);
  return match ?? AGE_INSIGHT_PERIODS[AGE_INSIGHT_PERIODS.length - 1];
}

export function findUpcomingPeriod(weeks: number): AgeInsightPeriod | null {
  const clamped = Math.min(weeks, FIRST_YEAR_MAX_WEEKS);
  return AGE_INSIGHT_PERIODS.find((p) => p.weekFrom > clamped) ?? null;
}

export function formatWakeWindowLabel(
  minMinutes: number,
  maxMinutes: number,
  locale: 'en' | 'de'
): string {
  const fmt = (minutes: number) => {
    if (minutes < 60) {
      return locale === 'de' ? `${minutes} Min.` : `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    if (rem === 0) {
      return locale === 'de' ? `${hours} Std.` : `${hours} h`;
    }
    return locale === 'de' ? `${hours} Std. ${rem} Min.` : `${hours} h ${rem} min`;
  };
  return `${fmt(minMinutes)}–${fmt(maxMinutes)}`;
}

export function getRecentAverageNaps(
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date,
  days = NAP_LOOKBACK_DAYS
): number | null {
  let total = 0;
  let sampleDays = 0;

  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);

    const dayEvents = getDayCycleEvents(events, wakes, day);
    const napCount = dayEvents.filter((e) => e.type === 'nap').length;
    if (napCount === 0) continue;

    total += napCount;
    sampleDays++;
  }

  if (sampleDays < MIN_DAYS_FOR_PERSONAL) return null;
  return Math.round(total / sampleDays);
}

function resolvePersonalNote(
  weeks: number,
  avgNaps: number | null
): { key: string; params: Record<string, string | number> } | null {
  if (avgNaps === null) return null;

  const expected = getAgeBasedNapGoal(Math.min(weeks, FIRST_YEAR_MAX_WEEKS));
  const params = { count: avgNaps };

  if (avgNaps === expected) {
    return { key: 'insights.personalTypical', params };
  }
  if (avgNaps > expected) {
    return { key: 'insights.personalMoreNaps', params };
  }
  return { key: 'insights.personalFewerNaps', params };
}

export function resolveAgeInsight(
  birthDate: string,
  events: SleepEvent[],
  wakes: WakeEvent[],
  now: Date = new Date(),
  locale: 'en' | 'de' = 'en',
  temperament: BabyTemperament = { easilyOverstimulated: false, highNeed: false }
): ResolvedAgeInsight | null {
  const weeks = ageInWeeks(birthDate, now);
  if (weeks > FIRST_YEAR_MAX_WEEKS) return null;

  const period = findPeriodForWeeks(weeks);
  const upcoming = findUpcomingPeriod(weeks);
  const wakeRange = getAgeWakeWindowRange(weeks);
  const avgNaps = getRecentAverageNaps(events, wakes, now);
  const personal = resolvePersonalNote(weeks, avgNaps);

  const params: Record<string, string | number> = {
    wakeWindow: formatWakeWindowLabel(wakeRange.min, wakeRange.max, locale),
    week: weeks,
  };

  return {
    periodId: period.id,
    category: period.category,
    weeks,
    titleKey: insightKey(period.id, 'title'),
    bodyKey: insightKey(period.id, 'body'),
    upcomingKey: upcoming ? insightKey(upcoming.id, 'upcoming') : undefined,
    params,
    personalKey: personal?.key,
    personalParams: personal?.params,
    temperamentKeys: resolveTemperamentTipKeys(temperament),
  };
}
