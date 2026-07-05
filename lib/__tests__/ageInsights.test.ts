import type { SleepEvent, WakeEvent } from '@/types';
import {
  findPeriodForWeeks,
  findUpcomingPeriod,
  formatWakeWindowLabel,
  getRecentAverageNaps,
  insightKey,
  resolveAgeInsight,
  resolveTemperamentTipKeys,
} from '../ageInsights';

function nap(babyId: string, start: string, end: string): SleepEvent {
  return {
    id: `nap-${start}`,
    babyId,
    type: 'nap',
    startTime: start,
    endTime: end,
  };
}

function morningWake(babyId: string, time: string): WakeEvent {
  return {
    id: `wake-${time}`,
    babyId,
    time,
    endTime: null,
    wakeType: 'morning',
    notes: null,
  };
}

describe('ageInsights', () => {
  const babyId = 'b1';
  const now = new Date('2026-06-20T12:00:00');

  it('maps weeks to the correct period', () => {
    expect(findPeriodForWeeks(1).id).toBe('newborn');
    expect(findPeriodForWeeks(16).id).toBe('fourMonth');
    expect(findPeriodForWeeks(52).id).toBe('twelveMonth');
    expect(findPeriodForWeeks(80).id).toBe('twelveMonth');
  });

  it('finds the next period', () => {
    expect(findUpcomingPeriod(1)?.id).toBe('early');
    expect(findUpcomingPeriod(52)).toBeNull();
  });

  it('formats wake windows for locale', () => {
    expect(formatWakeWindowLabel(45, 90, 'en')).toBe('45 min–1 h 30 min');
    expect(formatWakeWindowLabel(120, 150, 'de')).toContain('Std.');
  });

  it('resolves insight keys for a 16-week-old', () => {
    const birthDate = '2026-02-20';
    const insight = resolveAgeInsight(birthDate, [], [], now, 'en');
    expect(insight).not.toBeNull();
    expect(insight!.weeks).toBe(17);
    expect(insight!.titleKey).toBe(insightKey('fourMonth', 'title'));
    expect(insight!.params.wakeWindow).toBeTruthy();
  });

  it('returns null after the first year', () => {
    const insight = resolveAgeInsight('2024-01-01', [], [], now, 'en');
    expect(insight).toBeNull();
  });

  it('adds a personal note when nap history is available', () => {
    const birthDate = '2026-02-20';
    const events: SleepEvent[] = [];
    const wakes: WakeEvent[] = [];

    for (let i = 0; i < 5; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const y = day.getFullYear();
      const m = String(day.getMonth() + 1).padStart(2, '0');
      const d = String(day.getDate()).padStart(2, '0');
      wakes.push(morningWake(babyId, `${y}-${m}-${d}T07:00:00.000Z`));
      events.push(
        nap(babyId, `${y}-${m}-${d}T10:00:00.000Z`, `${y}-${m}-${d}T10:30:00.000Z`),
        nap(babyId, `${y}-${m}-${d}T13:00:00.000Z`, `${y}-${m}-${d}T14:00:00.000Z`),
        nap(babyId, `${y}-${m}-${d}T16:00:00.000Z`, `${y}-${m}-${d}T16:30:00.000Z`)
      );
    }

    const avg = getRecentAverageNaps(events, wakes, now);
    expect(avg).toBe(3);

    const insight = resolveAgeInsight(birthDate, events, wakes, now, 'en');
    expect(insight?.personalKey).toBe('insights.personalTypical');
    expect(insight?.personalParams?.count).toBe(3);
  });

  it('adds temperament tips when profile flags are set', () => {
    expect(resolveTemperamentTipKeys({ easilyOverstimulated: true, highNeed: false })).toEqual([
      'insights.temperament_overstimulated',
    ]);
    expect(resolveTemperamentTipKeys({ easilyOverstimulated: true, highNeed: true })).toEqual([
      'insights.temperament_both',
    ]);

    const insight = resolveAgeInsight(
      '2026-02-20',
      [],
      [],
      now,
      'en',
      { easilyOverstimulated: true, highNeed: true }
    );
    expect(insight?.temperamentKeys).toEqual(['insights.temperament_both']);
  });
});
