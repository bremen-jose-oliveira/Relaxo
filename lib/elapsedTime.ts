import type { SleepPause } from '@/types';

/** Elapsed sleep time in ms, excluding pause intervals (timer freezes while paused). */
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
