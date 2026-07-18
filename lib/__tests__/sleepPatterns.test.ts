import {
  getTypicalSleepSchedule,
  getTypicalStartTimeForSlot,
  USUAL_TIMES_LOOKBACK_DAYS,
} from '../sleepPatterns';
import type { SleepEvent, WakeEvent } from '@/types';

const babyId = 'baby-1';

function makeNap(
  dayOffset: number,
  startHour: number,
  startMin: number,
  durationMin: number,
  base = '2025-06-20T00:00:00'
): SleepEvent {
  const start = new Date(base);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(startHour, startMin, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id: `nap-${dayOffset}-${startHour}-${startMin}`,
    babyId,
    type: 'nap',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function makeNight(
  dayOffset: number,
  startHour: number,
  startMin: number,
  durationMin: number,
  base = '2025-06-20T00:00:00'
): SleepEvent {
  const start = new Date(base);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(startHour, startMin, 0, 0);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id: `night-${dayOffset}-${startHour}-${startMin}`,
    babyId,
    type: 'night',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

function makeMorningWake(
  dayOffset: number,
  hour: number,
  min: number,
  base = '2025-06-20T00:00:00'
): WakeEvent {
  const time = new Date(base);
  time.setDate(time.getDate() + dayOffset);
  time.setHours(hour, min, 0, 0);
  return {
    id: `wake-${dayOffset}`,
    babyId,
    wakeType: 'morning',
    time: time.toISOString(),
    endTime: null,
    notes: null,
  };
}

describe('sleepPatterns', () => {
  it('returns null with no samples', () => {
    const now = new Date('2025-06-20T12:00:00');
    const result = getTypicalStartTimeForSlot([], [], 0, now, 3);
    expect(result.typicalTime).toBeNull();
    expect(result.sampleCount).toBe(0);
  });

  it('returns a time with a single sample', () => {
    const now = new Date('2025-06-20T12:00:00');
    const events = [makeNap(-1, 14, 0, 60)];
    const wakes = [makeMorningWake(-1, 7, 0)];
    const result = getTypicalStartTimeForSlot(events, wakes, 0, now, 3);
    expect(result.sampleCount).toBe(1);
    expect(result.typicalTime).not.toBeNull();
    expect(result.typicalTime!.getHours()).toBe(14);
  });

  it('returns median typical start for first nap slot', () => {
    const now = new Date('2025-06-20T12:00:00');
    // First naps at 10:00, 10:30, 11:00 → median 10:30
    const events = [
      makeNap(-1, 10, 0, 60),
      makeNap(-2, 10, 30, 60),
      makeNap(-3, 11, 0, 60),
    ];
    const wakes = [
      makeMorningWake(-1, 7, 0),
      makeMorningWake(-2, 7, 0),
      makeMorningWake(-3, 7, 0),
    ];
    const result = getTypicalStartTimeForSlot(events, wakes, 0, now, 3);
    expect(result.sampleCount).toBe(3);
    expect(result.typicalTime).not.toBeNull();
    expect(result.typicalTime!.getHours()).toBe(10);
    expect(result.typicalTime!.getMinutes()).toBe(30);
  });

  it('uses older imported logs within 120-day lookback for slot helper', () => {
    const now = new Date('2025-06-20T12:00:00');
    const events = [
      makeNap(-30, 13, 0, 60),
      makeNap(-45, 13, 15, 60),
    ];
    const wakes = [makeMorningWake(-30, 7, 0), makeMorningWake(-45, 7, 0)];
    const result = getTypicalStartTimeForSlot(events, wakes, 0, now, 3);
    expect(result.sampleCount).toBe(2);
    expect(result.typicalTime).not.toBeNull();
    expect(result.typicalTime!.getHours()).toBe(13);
  });

  it('returns full schedule for all slots with enough samples', () => {
    const now = new Date('2025-06-20T12:00:00');
    const events: SleepEvent[] = [];
    const wakes: WakeEvent[] = [];

    for (const day of [-1, -2, -3]) {
      wakes.push(makeMorningWake(day, 7, 0));
      events.push(makeNap(day, 10, 0, 60)); // 1st
      events.push(makeNap(day, 13, 0, 60)); // 2nd
      events.push(makeNap(day, 16, 30, 45)); // 3rd
      events.push(makeNight(day, 19, 0, 600)); // bedtime
    }

    const schedule = getTypicalSleepSchedule(events, wakes, now);
    expect(schedule).toHaveLength(4);
    expect(schedule.map((s) => s.slotLabel)).toEqual([
      '1st nap',
      '2nd nap',
      '3rd nap',
      'bedtime',
    ]);
    expect(schedule[0]!.typicalTime.getHours()).toBe(10);
    expect(schedule[1]!.typicalTime.getHours()).toBe(13);
    expect(schedule[2]!.typicalTime.getHours()).toBe(16);
    expect(schedule[2]!.typicalTime.getMinutes()).toBe(30);
    expect(schedule[3]!.typicalTime.getHours()).toBe(19);
  });

  it('includes evening naps beyond 4 when logged as naps', () => {
    const now = new Date('2025-06-20T12:00:00');
    const events: SleepEvent[] = [];
    const wakes: WakeEvent[] = [];

    for (const day of [-1, -2, -3]) {
      wakes.push(makeMorningWake(day, 7, 0));
      events.push(makeNap(day, 9, 0, 45));
      events.push(makeNap(day, 11, 30, 45));
      events.push(makeNap(day, 14, 0, 45));
      events.push(makeNap(day, 16, 0, 40));
      events.push(makeNap(day, 18, 0, 35)); // evening nap ~18:00
      events.push(makeNight(day, 20, 30, 600));
    }

    const schedule = getTypicalSleepSchedule(events, wakes, now, 4);
    expect(schedule.map((s) => s.slotLabel)).toEqual([
      '1st nap',
      '2nd nap',
      '3rd nap',
      '4th nap',
      '5th nap',
      'bedtime',
    ]);
    expect(schedule[4]!.typicalTime.getHours()).toBe(18);
    expect(schedule[5]!.typicalTime.getHours()).toBe(20);
    expect(schedule[5]!.typicalTime.getMinutes()).toBe(30);
  });

  it(`usual schedule defaults to ${USUAL_TIMES_LOOKBACK_DAYS}-day lookback`, () => {
    const now = new Date('2025-06-20T12:00:00');
    // Outside 14-day window — should not appear in usual times
    const events = [makeNap(-30, 13, 0, 60)];
    const wakes = [makeMorningWake(-30, 7, 0)];
    const schedule = getTypicalSleepSchedule(events, wakes, now);
    expect(schedule).toHaveLength(0);
  });
});
