import type { SleepEvent, WakeEvent } from '@/types';
import { getDayViewBounds, isWakeDayAnchored } from '../dayAnchor';

describe('day view bounds', () => {
  it('uses calendar day when no wake anchors (typical import gap)', () => {
    const feedings = [{ startTime: '2025-06-10T12:00:00' }];
    const events: SleepEvent[] = [];
    const wakes: WakeEvent[] = [];

    expect(isWakeDayAnchored(events, wakes, new Date('2025-06-10'))).toBe(false);

    const bounds = getDayViewBounds(events, wakes, new Date('2025-06-10'));
    expect(bounds.mode).toBe('calendar');
    expect(bounds.start.getHours()).toBe(0);
    expect(bounds.end.getDate()).toBe(11);

    const t = new Date('2025-06-10T12:00:00').getTime();
    expect(t).toBeGreaterThanOrEqual(bounds.start.getTime());
    expect(t).toBeLessThan(bounds.end.getTime());
    void feedings;
  });

  it('uses calendar day even when imported morning wakes exist', () => {
    const events: SleepEvent[] = [];
    const wakes: WakeEvent[] = [
      {
        id: 'w1',
        babyId: 'b1',
        time: '2025-06-10T07:00:00',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
      {
        id: 'w2',
        babyId: 'b1',
        time: '2025-06-11T07:00:00',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
    ];

    const bounds = getDayViewBounds(events, wakes, new Date('2025-06-10'));
    expect(bounds.mode).toBe('calendar');
    expect(bounds.start.getHours()).toBe(0);
    expect(bounds.start.getMinutes()).toBe(0);
    expect(bounds.end.getDate()).toBe(11);
    expect(bounds.end.getHours()).toBe(0);
  });
});
