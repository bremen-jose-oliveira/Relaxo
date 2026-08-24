import {
  compareBusyVsQuietDays,
  shouldExplainDayContext,
  shouldSuggestCalmWindow,
  tagsForDate,
} from '@/lib/dayContext';
import type {
  DayContextTagEvent,
  SleepEvent,
  WakeEvent,
} from '@/types';

function nap(id: string, start: string, end: string): SleepEvent {
  return {
    id,
    babyId: 'b1',
    type: 'nap',
    startTime: start,
    endTime: end,
    extension: null,
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

describe('dayContext', () => {
  it('collects tags for a date', () => {
    const rows: DayContextTagEvent[] = [
      { id: '1', babyId: 'b1', dateKey: '2026-08-07', tag: 'outing' },
      { id: '2', babyId: 'b1', dateKey: '2026-08-07', tag: 'teething' },
      { id: '3', babyId: 'b1', dateKey: '2026-08-06', tag: 'quiet_home' },
    ];
    expect(tagsForDate(rows, '2026-08-07')).toEqual(['outing', 'teething']);
  });

  it('suggests calm window on busy days before ready', () => {
    expect(
      shouldSuggestCalmWindow({
        tags: ['outing'],
        wakeReadiness: 'prepare',
      })
    ).toBe(true);
    expect(
      shouldSuggestCalmWindow({
        tags: ['outing'],
        wakeReadiness: 'ready',
      })
    ).toBe(false);
    expect(
      shouldSuggestCalmWindow({
        tags: ['quiet_home'],
        wakeReadiness: 'prepare',
      })
    ).toBe(false);
  });

  it('explains day context when confidence is low or busy', () => {
    expect(
      shouldExplainDayContext({
        tags: ['teething'],
        confidence: 'high',
      })
    ).toBe(true);
    expect(
      shouldExplainDayContext({
        tags: ['quiet_home'],
        confidence: 'low',
      })
    ).toBe(true);
    expect(
      shouldExplainDayContext({
        tags: [],
        confidence: 'low',
      })
    ).toBe(false);
  });

  it('compares busy vs quieter nap days', () => {
    const now = new Date('2026-08-07T18:00:00');
    const events = [
      nap('busy1', '2026-08-07T10:00:00', '2026-08-07T10:30:00'),
      nap('quiet1', '2026-08-06T10:00:00', '2026-08-06T11:00:00'),
    ];
    const wakes = [
      morningWake('2026-08-07T07:00:00'),
      morningWake('2026-08-06T07:00:00'),
    ];
    const tags: DayContextTagEvent[] = [
      { id: 't1', babyId: 'b1', dateKey: '2026-08-07', tag: 'outing' },
      { id: 't2', babyId: 'b1', dateKey: '2026-08-06', tag: 'quiet_home' },
    ];
    const cmp = compareBusyVsQuietDays(events, [], wakes, tags, now, 7);
    expect(cmp.busyDays).toBe(1);
    expect(cmp.quietDays).toBe(1);
    expect(cmp.busyAvgNapMinutes).toBe(30);
    expect(cmp.quietAvgNapMinutes).toBe(60);
    expect(cmp.napDelta).toBe(-30);
  });
});
