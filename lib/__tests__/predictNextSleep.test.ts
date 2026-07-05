import {
  predictNextSleep,
  getAgeDefaultMidpoint,
  getPersonalAverageForSlot,
} from '@/lib/predictNextSleep';
import type { Baby, SleepEvent, WakeEvent } from '@/types';

const baby: Baby = {
  id: 'baby-1',
  name: 'Test Baby',
  birthDate: '2025-03-01',
  napGoal: null,
  trackFeedingDuration: false,
  easilyOverstimulated: false,
  highNeed: false,
};

function makeEvent(
  dayOffset: number,
  startHour: number,
  startMin: number,
  durationMin: number,
  type: 'nap' | 'night' = 'nap'
): SleepEvent {
  const start = new Date('2025-06-20T00:00:00');
  start.setDate(start.getDate() + dayOffset);
  start.setHours(startHour, startMin, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id: `evt-${dayOffset}-${startHour}-${startMin}`,
    babyId: baby.id,
    type,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function makeMorningWake(dayOffset: number, hour: number, min: number): WakeEvent {
  const time = new Date('2025-06-20T00:00:00');
  time.setDate(time.getDate() + dayOffset);
  time.setHours(hour, min, 0, 0);
  return {
    id: `wake-${dayOffset}-${hour}`,
    babyId: baby.id,
    time: time.toISOString(),
    endTime: null,
    wakeType: 'morning',
    notes: null,
  };
}

describe('predictNextSleep', () => {
  const now = new Date('2025-06-20T14:00:00');
  const noWakes: WakeEvent[] = [];

  describe('cold start (no data)', () => {
    it('falls back to age-based default wake window', () => {
      const result = predictNextSleep([], noWakes, baby, now);
      const weeks = 16;
      const expectedMidpoint = getAgeDefaultMidpoint(weeks);

      expect(result.confidence).toBe('low');
      expect(result.personalWeight).toBe(0);
      expect(result.slot).toBe(0);
      expect(result.slotLabel).toBe('1st nap');

      const expectedTime = new Date(now.getTime() + expectedMidpoint * 60 * 1000);
      expect(Math.abs(result.predictedTime.getTime() - expectedTime.getTime())).toBeLessThan(
        1000
      );
    });
  });

  describe('partial personal data (blends)', () => {
    it('blends personal average with age default at medium confidence', () => {
      const events: SleepEvent[] = [];
      const wakes: WakeEvent[] = [];

      for (let day = -1; day >= -2; day--) {
        wakes.push(makeMorningWake(day, 7, 0));
        events.push(makeEvent(day, 8, 30, 90));
        events.push(makeEvent(day, 11, 0, 60));
        events.push(makeEvent(day, 14, 0, 60));
        events.push(makeEvent(day, 19, 0, 600, 'night'));
      }

      wakes.push(makeMorningWake(0, 7, 0));
      events.push({
        id: 'today-wake',
        babyId: baby.id,
        type: 'night',
        startTime: new Date('2025-06-19T19:00:00').toISOString(),
        endTime: new Date('2025-06-20T07:00:00').toISOString(),
      });

      const result = predictNextSleep(events, wakes, baby, now);
      expect(result.slot).toBe(0);
      expect(result.personalWeight).toBe(0.4);
      expect(result.confidence).toBe('medium');
    });
  });

  describe('well-established pattern', () => {
    it('uses mostly personal average at high confidence', () => {
      const events: SleepEvent[] = [];
      const wakes: WakeEvent[] = [];

      for (let day = -1; day >= -7; day--) {
        wakes.push(makeMorningWake(day, 7, 0));
        const napStart = new Date('2025-06-20T00:00:00');
        napStart.setDate(napStart.getDate() + day);
        napStart.setHours(8, 40, 0, 0);
        const napEnd = new Date(napStart.getTime() + 90 * 60 * 1000);
        events.push({
          id: `nap1-${day}`,
          babyId: baby.id,
          type: 'nap',
          startTime: napStart.toISOString(),
          endTime: napEnd.toISOString(),
        });
      }

      wakes.push(makeMorningWake(0, 7, 0));
      events.push({
        id: 'today-wake',
        babyId: baby.id,
        type: 'night',
        startTime: new Date('2025-06-19T19:00:00').toISOString(),
        endTime: new Date('2025-06-20T07:00:00').toISOString(),
      });

      const wakeTime = new Date('2025-06-20T07:00:00');
      const testNow = new Date('2025-06-20T07:30:00');

      const result = predictNextSleep(events, wakes, baby, testNow);
      const { average, sampleCount } = getPersonalAverageForSlot(events, wakes, 0, testNow, 3);

      expect(sampleCount).toBeGreaterThanOrEqual(5);
      expect(result.personalWeight).toBe(1);
      expect(result.confidence).toBe('high');

      const expectedMinutes = average ?? 0;
      const expectedTime = new Date(wakeTime.getTime() + expectedMinutes * 60 * 1000);
      expect(
        Math.abs(result.predictedTime.getTime() - expectedTime.getTime())
      ).toBeLessThan(60 * 1000);
    });
  });

  describe('slot detection', () => {
    it('detects 2nd nap slot after one nap today', () => {
      const wakes = [makeMorningWake(0, 7, 0)];
      const events: SleepEvent[] = [
        {
          id: 'night',
          babyId: baby.id,
          type: 'night',
          startTime: new Date('2025-06-19T19:00:00').toISOString(),
          endTime: new Date('2025-06-20T07:00:00').toISOString(),
        },
        {
          id: 'nap1',
          babyId: baby.id,
          type: 'nap',
          startTime: new Date('2025-06-20T09:00:00').toISOString(),
          endTime: new Date('2025-06-20T10:30:00').toISOString(),
        },
      ];

      const result = predictNextSleep(events, wakes, baby, now);
      expect(result.slot).toBe(1);
      expect(result.slotLabel).toBe('2nd nap');
    });

    it('detects bedtime slot after 3 naps since morning wake', () => {
      const wakes = [makeMorningWake(0, 6, 30)];
      const events: SleepEvent[] = [
        makeEvent(0, 7, 0, 60, 'nap'),
        makeEvent(0, 9, 0, 90, 'nap'),
        makeEvent(0, 12, 0, 60, 'nap'),
        makeEvent(0, 14, 30, 90, 'nap'),
      ];

      const result = predictNextSleep(events, wakes, baby, now);
      expect(result.slot).toBe(3);
      expect(result.slotLabel).toBe('bedtime');
    });

    it('uses nap goal from profile — bedtime after 2 naps when goal is 2', () => {
      const twoNapBaby: Baby = { ...baby, napGoal: 2 };
      const wakes = [makeMorningWake(0, 7, 0)];
      const events: SleepEvent[] = [
        makeEvent(0, 9, 0, 60, 'nap'),
        makeEvent(0, 12, 0, 60, 'nap'),
      ];
      const result = predictNextSleep(events, wakes, twoNapBaby, now);
      expect(result.slot).toBe(2);
      expect(result.slotLabel).toBe('bedtime');
    });

    it('anchors first nap to morning wake, not midnight', () => {
      const wakes = [makeMorningWake(0, 8, 0)];
      const testNow = new Date('2025-06-20T09:00:00');
      const result = predictNextSleep([], wakes, baby, testNow);
      const wakeTime = new Date('2025-06-20T08:00:00');
      const expectedMidpoint = getAgeDefaultMidpoint(16);
      const expectedTime = new Date(wakeTime.getTime() + expectedMidpoint * 60 * 1000);
      expect(Math.abs(result.predictedTime.getTime() - expectedTime.getTime())).toBeLessThan(
        60 * 1000
      );
    });
  });
});
