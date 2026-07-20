import type { SleepEvent, SleepPause, WakeEvent } from '@/types';
import {
  compareSleepWeeks,
  evaluateNapLength,
  formatBabyAge,
  getAverageNapForWindows,
  getDaySleepInsights,
  getSleepStats,
  getWakeReadiness,
} from '../sleepInsights';

function nap(
  id: string,
  start: string,
  end: string,
  extension: SleepEvent['extension'] = null
): SleepEvent {
  return {
    id,
    babyId: 'b1',
    type: 'nap',
    startTime: start,
    endTime: end,
    extension,
  };
}

function morningWake(time: string): WakeEvent {
  return {
    id: `w-${time}`,
    babyId: 'b1',
    time,
    endTime: null,
    wakeType: 'morning',
    notes: null,
  };
}

describe('sleepInsights', () => {
  const now = new Date('2026-06-20T18:00:00');

  it('averages nap duration for today / 7d / 30d', () => {
    const events = [
      nap('1', '2026-06-20T10:00:00', '2026-06-20T10:40:00'),
      nap('2', '2026-06-20T14:00:00', '2026-06-20T14:50:00'),
      nap('3', '2026-06-18T10:00:00', '2026-06-18T10:30:00'),
    ];
    const avgs = getAverageNapForWindows(events, [], now);
    expect(avgs.today).toBe(45); // (40+50)/2
    expect(avgs.last7).toBe(40); // (40+50+30)/3
  });

  it('subtracts pauses from nap averages', () => {
    const events = [nap('1', '2026-06-20T10:00:00', '2026-06-20T11:00:00')];
    const pauses: SleepPause[] = [
      {
        id: 'p1',
        sleepEventId: '1',
        startTime: '2026-06-20T10:20:00',
        endTime: '2026-06-20T10:30:00',
      },
    ];
    const avgs = getAverageNapForWindows(events, pauses, now);
    expect(avgs.today).toBe(50);
  });

  it('builds day sleep insights', () => {
    const events = [
      nap('1', '2026-06-20T10:00:00', '2026-06-20T10:45:00'),
      nap('2', '2026-06-20T14:00:00', '2026-06-20T15:00:00'),
    ];
    const wakes = [morningWake('2026-06-20T07:00:00')];
    const insights = getDaySleepInsights(events, [], wakes, now, now);
    expect(insights.napCount).toBe(2);
    expect(insights.daytimeSleepMinutes).toBe(105);
    expect(insights.longestNapMinutes).toBe(60);
    expect(insights.avgWakeWindowMinutes).toBeGreaterThan(0);
  });

  it('evaluates nap length against personal average', () => {
    expect(evaluateNapLength(61, 50)).toBe('longer');
    expect(evaluateNapLength(50, 50)).toBe('around');
    expect(evaluateNapLength(30, 50)).toBe('shorter');
    expect(evaluateNapLength(40, null)).toBeNull();
  });

  it('maps wake readiness bands', () => {
    expect(getWakeReadiness(60, 120)).toBe('rested');
    expect(getWakeReadiness(90, 120)).toBe('prepare');
    expect(getWakeReadiness(120, 120)).toBe('ready');
    expect(getWakeReadiness(150, 120)).toBe('ready');
  });

  it('formats baby age', () => {
    expect(formatBabyAge('2026-01-24', now, 'en')).toBe('4 months, 27 days');
    expect(formatBabyAge('2026-01-24', now, 'de')).toBe('4 Mon., 27 T.');
    expect(formatBabyAge('2026-06-10', now, 'en')).toBe('10 days');
  });

  it('compares this week so far vs the same days last week', () => {
    // Saturday 2026-06-20 → Mon 15–Sat 20 (6 days), not full Sun week
    const events = [
      nap('a', '2026-06-16T10:00:00', '2026-06-16T10:50:00'), // this week Tue
      nap('b', '2026-06-10T10:00:00', '2026-06-10T10:30:00'), // last week Tue
      // Last week Sunday — must NOT be included (outside Mon–Sat window)
      nap('c', '2026-06-14T10:00:00', '2026-06-14T12:00:00'),
    ];
    const cmp = compareSleepWeeks(events, [], [], now);
    expect(cmp.daysCompared).toBe(6);
    expect(cmp.thisWeek.napCount).toBe(1);
    expect(cmp.lastWeek.napCount).toBe(1);
    expect(cmp.avgNapDelta).toBe(20);
    expect(cmp.napCountDelta).toBe(0);
    expect(cmp.thisWeek.daytimeSleepMinutes).toBe(50);
    expect(cmp.lastWeek.daytimeSleepMinutes).toBe(30);
  });

  it('does not treat a partial week as a full-week deficit', () => {
    // Monday only — last week Monday had one nap; this week none yet
    const monday = new Date('2026-06-15T12:00:00');
    const events = [
      nap('last-mon', '2026-06-08T10:00:00', '2026-06-08T11:00:00'),
      nap('last-tue', '2026-06-09T10:00:00', '2026-06-09T11:00:00'),
      nap('last-wed', '2026-06-10T10:00:00', '2026-06-10T11:00:00'),
    ];
    const cmp = compareSleepWeeks(events, [], [], monday);
    expect(cmp.daysCompared).toBe(1);
    expect(cmp.lastWeek.napCount).toBe(1);
    expect(cmp.napCountDelta).toBe(-1);
  });

  it('computes extension success percent', () => {
    const events = [
      nap('1', '2026-06-20T10:00:00', '2026-06-20T10:40:00', 'feeding'),
      nap('2', '2026-06-19T10:00:00', '2026-06-19T10:40:00', 'not_extended'),
      nap('3', '2026-06-18T10:00:00', '2026-06-18T10:40:00', null),
    ];
    const stats = getSleepStats(events, [], [], now, 30);
    expect(stats.extensionSuccessPercent).toBe(50);
    expect(stats.avgNapMinutes).toBe(40);
  });
});
