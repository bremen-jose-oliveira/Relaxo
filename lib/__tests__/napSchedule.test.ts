import {
  getAgeBasedNapGoal,
  inferNapGoalFromHistory,
  resolveNapGoal,
} from '@/lib/napSchedule';
import type { Baby, SleepEvent, WakeEvent } from '@/types';

const baby: Baby = {
  id: 'b1',
  name: 'Test',
  birthDate: '2025-03-01',
  napGoal: null,
  trackFeedingDuration: false,
  easilyOverstimulated: false,
  highNeed: false,
};

function makeWake(day: string, hour: number): WakeEvent {
  return {
    id: `w-${day}-${hour}`,
    babyId: baby.id,
    time: new Date(`2025-06-${day}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString(),
    endTime: null,
    wakeType: 'morning',
    notes: null,
  };
}

function makeNap(day: string, hour: number, durationMin: number): SleepEvent {
  const start = new Date(`2025-06-${day}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id: `n-${day}-${hour}`,
    babyId: baby.id,
    type: 'nap',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

describe('napSchedule', () => {
  const now = new Date('2025-06-20T14:00:00.000Z');

  describe('getAgeBasedNapGoal', () => {
    it('suggests more naps for younger babies', () => {
      expect(getAgeBasedNapGoal(8)).toBe(4);
      expect(getAgeBasedNapGoal(20)).toBe(3);
      expect(getAgeBasedNapGoal(40)).toBe(2);
    });
  });

  describe('inferNapGoalFromHistory', () => {
    it('returns null with fewer than 3 days of data', () => {
      const events = [makeNap('18', 10, 60), makeNap('19', 10, 60)];
      const wakes = [makeWake('18', 7), makeWake('19', 7), makeWake('20', 7)];
      expect(inferNapGoalFromHistory(events, wakes, now)).toBeNull();
    });

    it('infers 2-nap pattern from recent wake-days', () => {
      const events: SleepEvent[] = [];
      const wakes: WakeEvent[] = [];
      for (const day of ['17', '18', '19']) {
        wakes.push(makeWake(day, 7));
        events.push(makeNap(day, 10, 60));
        events.push(makeNap(day, 14, 60));
        events.push({
          id: `bed-${day}`,
          babyId: baby.id,
          type: 'night',
          startTime: new Date(`2025-06-${day}T20:00:00.000Z`).toISOString(),
          endTime: new Date(`2025-06-${String(Number(day) + 1).padStart(2, '0')}T06:00:00.000Z`).toISOString(),
        });
      }
      wakes.push(makeWake('20', 7));
      const result = inferNapGoalFromHistory(events, wakes, now);
      expect(result?.goal).toBe(2);
    });
  });

  describe('resolveNapGoal', () => {
    it('uses manual routine when set', () => {
      const manual: Baby = { ...baby, napGoal: 2 };
      const resolved = resolveNapGoal(manual, [], [], now);
      expect(resolved).toEqual({ goal: 2, source: 'manual' });
    });

    it('falls back to age when auto and little history', () => {
      const resolved = resolveNapGoal(baby, [], [], now);
      expect(resolved.source).toBe('age');
      expect(resolved.goal).toBeGreaterThanOrEqual(2);
    });
  });
});
