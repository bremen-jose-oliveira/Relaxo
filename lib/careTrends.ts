import type { DiaperEvent, FeedingEvent } from '@/types';
import { formatDateKey } from '@/lib/dateUtils';

export type FeedingDayTrend = {
  date: string;
  label: string;
  totalFeeds: number;
  breast: number;
  bottle: number;
  solid: number;
  avgBottleAmount: number | null;
  avgSolidAmount: number | null;
  bottleUnit: 'ml' | 'oz' | null;
  solidUnit: 'g' | null;
};

export type DiaperDayTrend = {
  date: string;
  label: string;
  total: number;
  wet: number;
  dirty: number;
  mixed: number;
};

export function getFeedingTrend(
  events: FeedingEvent[],
  days: number,
  now: Date
): FeedingDayTrend[] {
  const result: FeedingDayTrend[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = formatDateKey(day);

    const dayEvents = events.filter(
      (e) => formatDateKey(new Date(e.startTime)) === key
    );

    const breast = dayEvents.filter((e) => e.feedType === 'breast').length;
    const bottleEvents = dayEvents.filter((e) => e.feedType === 'bottle');
    const solidEvents = dayEvents.filter((e) => e.feedType === 'solid');

    const bottleAmounts = bottleEvents
      .map((e) => e.amount)
      .filter((a): a is number => a != null);
    const solidAmounts = solidEvents
      .map((e) => e.amount)
      .filter((a): a is number => a != null);

    result.push({
      date: key,
      label: day.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      totalFeeds: dayEvents.length,
      breast,
      bottle: bottleEvents.length,
      solid: solidEvents.length,
      avgBottleAmount:
        bottleAmounts.length > 0
          ? Math.round(
              bottleAmounts.reduce((s, a) => s + a, 0) / bottleAmounts.length
            )
          : null,
      avgSolidAmount:
        solidAmounts.length > 0
          ? Math.round(
              solidAmounts.reduce((s, a) => s + a, 0) / solidAmounts.length
            )
          : null,
      bottleUnit: (() => {
        const u = bottleEvents.find((e) => e.unit === 'ml' || e.unit === 'oz')?.unit;
        return u === 'ml' || u === 'oz' ? u : null;
      })(),
      solidUnit: solidEvents.length > 0 ? ('g' as const) : null,
    });
  }

  return result;
}

export function getDiaperTrend(
  events: DiaperEvent[],
  days: number,
  now: Date
): DiaperDayTrend[] {
  const result: DiaperDayTrend[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = formatDateKey(day);

    const dayEvents = events.filter(
      (e) => formatDateKey(new Date(e.time)) === key
    );

    result.push({
      date: key,
      label: day.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      total: dayEvents.length,
      wet: dayEvents.filter((e) => e.diaperType === 'wet').length,
      dirty: dayEvents.filter((e) => e.diaperType === 'dirty').length,
      mixed: dayEvents.filter((e) => e.diaperType === 'mixed').length,
    });
  }

  return result;
}
