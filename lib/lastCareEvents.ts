import type { BathEvent, DiaperEvent } from '@/types';
import { addDays, formatDate, formatTime, isSameDay, startOfDay } from '@/lib/dateUtils';

/** Newest bath by time, optionally excluding an event id (e.g. while editing). */
export function getLastBath(
  baths: BathEvent[],
  excludeId?: string | null
): BathEvent | null {
  const sorted = [...baths]
    .filter((b) => !excludeId || b.id !== excludeId)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return sorted[0] ?? null;
}

/** Newest dirty or mixed diaper (wet ignored). */
export function getLastDirtyDiaper(
  diapers: DiaperEvent[],
  excludeId?: string | null
): DiaperEvent | null {
  const sorted = [...diapers]
    .filter(
      (d) =>
        (d.diaperType === 'dirty' || d.diaperType === 'mixed') &&
        (!excludeId || d.id !== excludeId)
    )
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return sorted[0] ?? null;
}

/** Human-friendly “Today · 19:40” / “Yesterday · …” / “Mon, Jan 5 · …”. */
export function formatLastCareWhen(
  isoTime: string,
  labels: { today: string; yesterday: string },
  now: Date = new Date()
): string {
  const d = new Date(isoTime);
  const time = formatTime(d);
  if (isSameDay(d, now)) return `${labels.today} · ${time}`;
  const yesterday = addDays(startOfDay(now), -1);
  if (isSameDay(d, yesterday)) return `${labels.yesterday} · ${time}`;
  return `${formatDate(d)} · ${time}`;
}
