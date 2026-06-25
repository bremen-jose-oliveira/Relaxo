import { isSameDay, parseDateKey } from '@/lib/dateUtils';

/** Which bar indices get an x-axis label (sparse for 14-day charts). */
export function pickChartLabelIndices(total: number): number[] {
  if (total <= 0) return [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const last = total - 1;
  const mid = Math.round(last / 2);
  const quarter = Math.round(last / 4);
  const threeQuarter = Math.round((last * 3) / 4);

  return [...new Set([0, quarter, mid, threeQuarter, last])].sort((a, b) => a - b);
}

/**
 * Compact x-axis labels aligned to each bar column.
 * Month context lives in the chart date-range subtitle.
 */
export function formatChartXLabel(
  date: Date,
  _now: Date,
  index: number,
  total: number
): string {
  if (!pickChartLabelIndices(total).includes(index)) return '';
  return String(date.getDate());
}

export function formatChartDateRange(startKey: string, endKey: string): string {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startStr = start.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endStr = end.toLocaleDateString([], {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });

  return `${startStr} – ${endStr}`;
}

export function formatDayGroupHeader(dateKey: string, now: Date): string {
  const date = parseDateKey(dateKey);
  if (isSameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export type ChartBarPoint = {
  value: number;
  label: string;
  frontColor: string;
  date: string;
};

export function buildChartBars<T extends { date: string }>(
  rows: T[],
  getValue: (row: T) => number,
  now: Date,
  color: string
): ChartBarPoint[] {
  return rows.map((row, index) => {
    const date = parseDateKey(row.date);
    const isToday = isSameDay(date, now);
    return {
      value: getValue(row),
      label: formatChartXLabel(date, now, index, rows.length),
      frontColor: isToday ? color : color + '99',
      date: row.date,
    };
  });
}
