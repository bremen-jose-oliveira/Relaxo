import {
  isArtificial24hNightSleep,
  isInstantSleepMarker,
  mergeIntervals,
  sleepIntervalsMinusPauses,
  totalSleepMinutesInRange,
} from '../sleepTotals';
import type { SleepEvent, SleepPause } from '@/types';

describe('sleepTotals', () => {
  it('merges overlapping intervals', () => {
    const merged = mergeIntervals([
      { start: new Date('2025-06-01T20:00:00'), end: new Date('2025-06-02T06:00:00') },
      { start: new Date('2025-06-01T22:00:00'), end: new Date('2025-06-02T05:00:00') },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].end.toISOString()).toBe(new Date('2025-06-02T06:00:00').toISOString());
  });

  it('removes pause intervals from sleep', () => {
    const event: SleepEvent = {
      id: 's1',
      babyId: 'b1',
      type: 'night',
      startTime: '2025-06-01T20:00:00',
      endTime: '2025-06-02T06:00:00',
    };
    const pauses: SleepPause[] = [
      {
        id: 'p1',
        sleepEventId: 's1',
        startTime: '2025-06-01T23:00:00',
        endTime: '2025-06-01T23:30:00',
      },
    ];
    const chunks = sleepIntervalsMinusPauses(event, pauses);
    expect(chunks).toHaveLength(2);
    const total = totalSleepMinutesInRange(
      [event],
      new Map([['s1', pauses]]),
      new Date('2025-06-01T20:00:00'),
      new Date('2025-06-02T06:00:00')
    );
    expect(total).toBe(570);
  });

  it('ignores instant bedtime markers and artificial 24h import rows', () => {
    const instant: SleepEvent = {
      id: 'i1',
      babyId: 'b1',
      type: 'night',
      startTime: '2026-06-22T20:14:00',
      endTime: '2026-06-22T20:14:00',
    };
    const artificial: SleepEvent = {
      id: 'a1',
      babyId: 'b1',
      type: 'night',
      startTime: '2026-06-21T20:14:00',
      endTime: '2026-06-22T20:14:00',
    };
    expect(isInstantSleepMarker(instant)).toBe(true);
    expect(isArtificial24hNightSleep(artificial)).toBe(true);

    const total = totalSleepMinutesInRange(
      [instant, artificial],
      new Map(),
      new Date('2026-06-22T00:00:00'),
      new Date('2026-06-23T00:00:00')
    );
    expect(total).toBe(0);
  });
});
