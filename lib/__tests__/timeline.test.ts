import { buildTimeline, filterTimelineForWakeDay } from '@/lib/timeline';
import type { SleepEvent, WakeEvent } from '@/types';

describe('wake-day timeline', () => {
  const babyId = 'b1';

  it('includes overnight events before next morning wake', () => {
    const wakes: WakeEvent[] = [
      {
        id: 'w1',
        babyId,
        time: '2025-06-20T07:00:00.000Z',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
      {
        id: 'w2',
        babyId,
        time: '2025-06-21T07:00:00.000Z',
        endTime: null,
        wakeType: 'morning',
        notes: null,
      },
    ];
    const sleep: SleepEvent[] = [
      {
        id: 's1',
        babyId,
        type: 'night',
        startTime: '2025-06-20T19:00:00.000Z',
        endTime: '2025-06-21T06:30:00.000Z',
      },
    ];
    const feedings: never[] = [];
    const diapers: never[] = [];
    const items = buildTimeline(sleep, feedings, diapers, wakes);
    const anchor = new Date('2025-06-20T12:00:00.000Z');
    const filtered = filterTimelineForWakeDay(
      items,
      sleep,
      wakes,
      anchor,
      new Date('2025-06-21T12:00:00.000Z')
    );
    expect(filtered.some((i) => i.kind === 'sleep' && i.id === 's1')).toBe(true);
    expect(filtered.some((i) => i.kind === 'wake' && i.id === 'w1')).toBe(true);
    expect(filtered.some((i) => i.kind === 'wake' && i.id === 'w2')).toBe(false);
  });
});
