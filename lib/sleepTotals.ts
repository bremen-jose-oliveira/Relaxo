import type { SleepEvent, SleepPause } from '@/types';
import { minutesBetween } from '@/lib/dateUtils';

export type TimeInterval = { start: Date; end: Date };

export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeInterval[] = [{ start: sorted[0].start, end: sorted[0].end }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
}

function subtractPause(interval: TimeInterval, pauseStart: Date, pauseEnd: Date): TimeInterval[] {
  if (pauseEnd <= interval.start || pauseStart >= interval.end) return [interval];

  const pieces: TimeInterval[] = [];
  if (pauseStart > interval.start) {
    pieces.push({ start: interval.start, end: new Date(Math.min(pauseStart.getTime(), interval.end.getTime())) });
  }
  if (pauseEnd < interval.end) {
    pieces.push({ start: new Date(Math.max(pauseEnd.getTime(), interval.start.getTime())), end: interval.end });
  }
  return pieces.filter((p) => p.end > p.start);
}

/** Sleep event split into awake/sleep chunks with pauses removed. */
export function sleepIntervalsMinusPauses(
  event: SleepEvent,
  pauses: SleepPause[]
): TimeInterval[] {
  if (!event.endTime) return [];

  let intervals: TimeInterval[] = [
    { start: new Date(event.startTime), end: new Date(event.endTime) },
  ];

  for (const pause of pauses) {
    if (!pause.endTime) continue;
    const pStart = new Date(pause.startTime);
    const pEnd = new Date(pause.endTime);
    intervals = intervals.flatMap((interval) => subtractPause(interval, pStart, pEnd));
  }

  return intervals;
}

export function clipInterval(interval: TimeInterval, rangeStart: Date, rangeEnd: Date): TimeInterval | null {
  const start = new Date(Math.max(interval.start.getTime(), rangeStart.getTime()));
  const end = new Date(Math.min(interval.end.getTime(), rangeEnd.getTime()));
  if (end <= start) return null;
  return { start, end };
}

export function totalMinutesFromIntervals(intervals: TimeInterval[]): number {
  return Math.round(
    intervals.reduce((sum, interval) => sum + minutesBetween(interval.start, interval.end), 0)
  );
}

export function totalSleepMinutesInRange(
  events: SleepEvent[],
  pausesByEventId: Map<string, SleepPause[]>,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const clipped: TimeInterval[] = [];

  for (const event of events) {
    if (!event.endTime) continue;
    const eventPauses = pausesByEventId.get(event.id) ?? [];
    const chunks = sleepIntervalsMinusPauses(event, eventPauses);
    for (const chunk of chunks) {
      const piece = clipInterval(chunk, rangeStart, rangeEnd);
      if (piece) clipped.push(piece);
    }
  }

  return totalMinutesFromIntervals(mergeIntervals(clipped));
}

export function groupPausesByEventId(pauses: SleepPause[]): Map<string, SleepPause[]> {
  const map = new Map<string, SleepPause[]>();
  for (const pause of pauses) {
    const list = map.get(pause.sleepEventId) ?? [];
    list.push(pause);
    map.set(pause.sleepEventId, list);
  }
  return map;
}
