import type { SleepPause } from '@/types';

/** When baby resumed after a pause, the start of the current asleep stretch. */
export function getCurrentSegmentStart(
  sleepStart: Date,
  sleepEventId: string,
  pauses: SleepPause[]
): Date {
  const completed = pauses
    .filter((p) => p.sleepEventId === sleepEventId && p.endTime !== null)
    .sort(
      (a, b) =>
        new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
    );

  if (completed.length > 0) {
    return new Date(completed[0].endTime!);
  }
  return sleepStart;
}

/** Time asleep in the current stretch (since last resume, or since sleep start). */
export function getCurrentSegmentElapsedMs(
  sleepStart: Date,
  now: Date,
  sleepEventId: string,
  pauses: SleepPause[],
  isPaused: boolean
): number {
  if (isPaused) return 0;
  const segmentStart = getCurrentSegmentStart(sleepStart, sleepEventId, pauses);
  return Math.max(0, now.getTime() - segmentStart.getTime());
}

/** Total asleep this session in ms, excluding all pause intervals. */
export function getSleepElapsedMs(
  sleepStart: Date,
  now: Date,
  sleepEventId: string,
  pauses: SleepPause[]
): number {
  let elapsed = now.getTime() - sleepStart.getTime();

  for (const pause of pauses) {
    if (pause.sleepEventId !== sleepEventId) continue;
    const pStart = new Date(pause.startTime).getTime();
    const pEnd = pause.endTime ? new Date(pause.endTime).getTime() : now.getTime();
    if (pEnd > pStart) elapsed -= pEnd - pStart;
  }

  return Math.max(0, elapsed);
}

/** Clock-style display: 1:05:03 or 45:12 */
export function formatElapsedClock(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}
