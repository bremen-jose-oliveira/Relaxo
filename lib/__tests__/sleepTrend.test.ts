import type { SleepEvent, SleepPause } from '@/types';
import { getSleepTrend } from '../predictNextSleep';

function makeSleep(
  id: string,
  start: string,
  end: string,
  type: 'nap' | 'night' = 'nap'
): SleepEvent {
  return { id, babyId: 'b1', type, startTime: start, endTime: end };
}

describe('getSleepTrend', () => {
  const now = new Date('2025-06-25T14:00:00');

  it('counts sleep that starts on the calendar day (not overnight from prior day)', () => {
    const events: SleepEvent[] = [
      makeSleep('night', '2025-06-24T19:00:00', '2025-06-25T07:00:00', 'night'),
      makeSleep('nap1', '2025-06-25T09:00:00', '2025-06-25T10:00:00', 'nap'),
      makeSleep('nap2', '2025-06-25T13:00:00', '2025-06-25T14:00:00', 'nap'),
    ];
    const wakes = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-25T07:00:00',
        endTime: null,
        wakeType: 'morning' as const,
        notes: null,
      },
    ];

    const trend = getSleepTrend(events, wakes, [], 1, now);
    expect(trend).toHaveLength(1);
    // Night sleep started yesterday — only today's naps count on this calendar day
    expect(trend[0].totalMinutes).toBe(120);
    expect(trend[0].napCount).toBe(2);
    expect(trend[0].bedtimeCount).toBe(0);
  });

  it('merges overlapping sleep rows within a calendar day', () => {
    const events: SleepEvent[] = [
      makeSleep('dup-a', '2025-06-25T09:00:00', '2025-06-25T11:00:00', 'nap'),
      makeSleep('dup-b', '2025-06-25T10:00:00', '2025-06-25T11:30:00', 'nap'),
    ];
    const wakes = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-25T07:00:00',
        endTime: null,
        wakeType: 'morning' as const,
        notes: null,
      },
    ];

    const trend = getSleepTrend(events, wakes, [], 1, now);
    expect(trend[0].totalMinutes).toBe(150);
  });

  it('subtracts pauses from sleep duration', () => {
    const events: SleepEvent[] = [
      makeSleep('nap', '2025-06-25T09:00:00', '2025-06-25T11:00:00', 'nap'),
    ];
    const pauses: SleepPause[] = [
      {
        id: 'p1',
        sleepEventId: 'nap',
        startTime: '2025-06-25T09:30:00',
        endTime: '2025-06-25T10:00:00',
      },
    ];
    const wakes = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-25T07:00:00',
        endTime: null,
        wakeType: 'morning' as const,
        notes: null,
      },
    ];

    const trend = getSleepTrend(events, wakes, pauses, 1, now);
    expect(trend[0].totalMinutes).toBe(90);
  });
});
