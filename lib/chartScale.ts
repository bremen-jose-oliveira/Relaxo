/** Pick a readable Y-axis max with a little headroom above the data peak. */
export function computeNiceMax(dataMax: number, min = 1): number {
  const peak = Math.max(min, dataMax);
  const raw = peak * 1.15;
  if (raw <= 4) return 4;
  if (raw <= 6) return 6;
  if (raw <= 8) return 8;
  if (raw <= 10) return 10;
  if (raw <= 12) return 12;
  return Math.ceil(raw / 4) * 4;
}

/** Sleep per calendar day cannot exceed 24h. */
export function computeSleepMaxHours(dataMaxHours: number): number {
  const peak = Math.min(24, Math.max(dataMaxHours, 2));
  const targets = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24];
  return targets.find((t) => t >= peak * 1.05) ?? 24;
}

export function computeSleepMaxMinutes(dataMaxMinutes: number): number {
  const peak = Math.min(1440, Math.max(dataMaxMinutes, 60));
  const hourBlocks = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24];
  const hours = hourBlocks.find((h) => h * 60 >= peak * 1.05) ?? 24;
  return hours * 60;
}

export function clampSleepMinutes(minutes: number): number {
  return Math.min(1440, Math.max(0, minutes));
}

export function sleepMinutesToChartValue(
  minutes: number,
  unit: 'hours' | 'minutes'
): number {
  const clamped = clampSleepMinutes(minutes);
  if (unit === 'hours') {
    return Math.round((clamped / 60) * 10) / 10;
  }
  return clamped;
}
