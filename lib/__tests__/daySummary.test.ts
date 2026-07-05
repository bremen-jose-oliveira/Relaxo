import type { BathEvent, DiaperEvent, FeedingEvent, SleepEvent, SleepPause, WakeEvent } from '@/types';
import { getWakeDaySummary } from '../daySummary';
import { getSleepMetrics24h } from '../predictNextSleep';

function makeSleep(
  id: string,
  start: string,
  end: string,
  type: 'nap' | 'night' = 'nap'
): SleepEvent {
  return { id, babyId: 'b1', type, startTime: start, endTime: end };
}

describe('daySummary', () => {
  const now = new Date('2025-06-25T14:00:00');

  it('totals sleep for wake day without double-counting overlaps', () => {
    const events: SleepEvent[] = [
      makeSleep('a', '2025-06-25T09:00:00', '2025-06-25T11:00:00'),
      makeSleep('b', '2025-06-25T10:00:00', '2025-06-25T11:30:00'),
    ];
    const wakes: WakeEvent[] = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-25T07:00:00',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
    ];

    const summary = getWakeDaySummary(events, [], [], [], [], wakes, now, now);
    expect(summary.totalSleepMinutes).toBe(150);
    expect(summary.napCount).toBe(2);
  });

  it('counts care events inside calendar-day bounds', () => {
    const feedings: FeedingEvent[] = [
      {
        id: 'f1',
        babyId: 'b1',
        feedType: 'breast',
        startTime: '2025-06-25T08:00:00',
        endTime: '2025-06-25T08:20:00',
        side: 'left',
        amount: null,
        unit: null,
        notes: null,
      },
    ];
    const diapers: DiaperEvent[] = [
      {
        id: 'd1',
        babyId: 'b1',
        diaperType: 'wet',
        time: '2025-06-25T09:30:00',
        notes: null,
      },
    ];
    const baths: BathEvent[] = [
      {
        id: 'ba1',
        babyId: 'b1',
        time: '2025-06-25T12:00:00',
        notes: null,
      },
    ];
    const wakes: WakeEvent[] = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-25T07:00:00',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
    ];

    const summary = getWakeDaySummary([], [], feedings, diapers, baths, wakes, now, now);
    expect(summary.feedCount).toBe(1);
    expect(summary.diaperCount).toBe(1);
    expect(summary.bathCount).toBe(1);
  });

  it('does not count previous-night overlap on a calendar day (avoids 24h cap)', () => {
    const events: SleepEvent[] = [
      makeSleep('night', '2026-06-21T20:14:00', '2026-06-22T20:14:00', 'night'),
      makeSleep('nap1', '2026-06-22T17:00:00', '2026-06-22T17:37:00'),
      makeSleep('nap2', '2026-06-22T18:30:00', '2026-06-22T19:10:00'),
      makeSleep('bed', '2026-06-22T20:14:00', '2026-06-22T20:14:00', 'night'),
    ];
    const anchor = new Date('2026-06-22T12:00:00');
    const summary = getWakeDaySummary(
      events,
      [],
      [],
      [],
      [],
      [],
      anchor,
      new Date('2026-07-05')
    );
    expect(summary.napCount).toBe(2);
    expect(summary.bedtimeCount).toBe(1);
    expect(summary.totalSleepMinutes).toBe(77);
  });
});

describe('getSleepMetrics24h', () => {
  const now = new Date('2025-06-25T14:00:00');

  it('does not exceed 24h when sleep intervals overlap', () => {
    const events: SleepEvent[] = [
      makeSleep('a', '2025-06-24T20:00:00', '2025-06-25T08:00:00', 'night'),
      makeSleep('b', '2025-06-25T07:30:00', '2025-06-25T09:00:00', 'nap'),
    ];

    const metrics = getSleepMetrics24h(events, [], now);
    expect(metrics.total24hMinutes).toBeLessThanOrEqual(1440);
    expect(metrics.total24hMinutes).toBeGreaterThan(0);
  });
});
