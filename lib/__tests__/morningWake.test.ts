import type { SleepEvent, WakeEvent } from '@/types';
import { hasDayStartedToday, buildMorningWakeAfterBedtime } from '../morningWake';

describe('morningWake', () => {
  const now = new Date('2025-06-25T10:00:00');

  it('detects day started from morning wake', () => {
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
    expect(hasDayStartedToday([], wakes, now)).toBe(true);
  });

  it('detects day started from ended bedtime', () => {
    const events: SleepEvent[] = [
      {
        id: 's1',
        babyId: 'b1',
        type: 'night',
        startTime: '2025-06-24T19:00:00',
        endTime: '2025-06-25T07:00:00',
      },
    ];
    expect(hasDayStartedToday(events, [], now)).toBe(true);
  });

  it('day not started on first use mid-day', () => {
    expect(hasDayStartedToday([], [], now)).toBe(false);
  });

  it('creates morning wake after bedtime when none exists', () => {
    const wake = buildMorningWakeAfterBedtime('b1', '2025-06-25T07:00:00', []);
    expect(wake?.wakeType).toBe('morning');
    expect(wake?.time).toBe('2025-06-25T07:00:00');
  });

  it('skips duplicate morning wake', () => {
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
    expect(buildMorningWakeAfterBedtime('b1', '2025-06-25T07:05:00', wakes)).toBeNull();
  });
});
