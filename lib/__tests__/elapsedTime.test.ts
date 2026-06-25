import { getSleepElapsedMs, formatElapsedClock } from '../elapsedTime';
import type { SleepPause } from '@/types';

describe('elapsedTime', () => {
  const pauses: SleepPause[] = [
    {
      id: 'p1',
      sleepEventId: 's1',
      startTime: '2025-06-25T10:30:00',
      endTime: '2025-06-25T10:45:00',
    },
  ];

  it('subtracts completed pauses from elapsed time', () => {
    const start = new Date('2025-06-25T10:00:00');
    const now = new Date('2025-06-25T11:00:00');
    const ms = getSleepElapsedMs(start, now, 's1', pauses);
    expect(ms).toBe(45 * 60 * 1000);
  });

  it('freezes timer during an open pause', () => {
    const openPauses: SleepPause[] = [
      {
        id: 'p2',
        sleepEventId: 's1',
        startTime: '2025-06-25T10:20:00',
        endTime: null,
      },
    ];
    const start = new Date('2025-06-25T10:00:00');
    const atPause = new Date('2025-06-25T10:20:00');
    const later = new Date('2025-06-25T10:40:00');
    const msAtPause = getSleepElapsedMs(start, atPause, 's1', openPauses);
    const msLater = getSleepElapsedMs(start, later, 's1', openPauses);
    expect(msAtPause).toBe(20 * 60 * 1000);
    expect(msLater).toBe(20 * 60 * 1000);
  });

  it('formats clock strings', () => {
    expect(formatElapsedClock(45 * 1000)).toBe('0:45');
    expect(formatElapsedClock((65 * 60 + 5) * 1000)).toBe('1:05:05');
  });
});
