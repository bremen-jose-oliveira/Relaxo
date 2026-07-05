import { buildTimeline, filterTimelineForDayView } from '@/lib/timeline';
import type { SleepEvent, WakeEvent } from '@/types';

describe('calendar-day timeline', () => {
  const babyId = 'b1';

  it('includes events on the selected calendar day only', () => {
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
    const baths: never[] = [];
    const items = buildTimeline(sleep, feedings, diapers, baths, wakes);
    const anchor = new Date('2025-06-20T12:00:00.000Z');
    const filtered = filterTimelineForDayView(
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
