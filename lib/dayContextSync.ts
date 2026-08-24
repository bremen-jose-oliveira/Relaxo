export type DayContextRemoteRow = {
  id: string;
  baby_id: string;
  date_key: string;
  tag: string;
  deleted_at?: string | null;
};

/** Pick one cloud id per baby/date/tag (prefer live, then smallest id). */
export function pickCanonicalDayContextRemoteIds(
  rows: DayContextRemoteRow[]
): Map<string, string> {
  const best = new Map<string, DayContextRemoteRow>();
  for (const row of rows) {
    const key = `${row.baby_id}|${row.date_key}|${row.tag}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, row);
      continue;
    }
    const prevDeleted = prev.deleted_at != null;
    const nextDeleted = row.deleted_at != null;
    if (prevDeleted && !nextDeleted) {
      best.set(key, row);
      continue;
    }
    if (!prevDeleted && nextDeleted) continue;
    if (String(row.id) < String(prev.id)) {
      best.set(key, row);
    }
  }
  const out = new Map<string, string>();
  for (const [key, row] of best) {
    out.set(key, String(row.id));
  }
  return out;
}

export function dayContextUniqKey(
  babyId: string,
  dateKey: string,
  tag: string
): string {
  return `${babyId}|${dateKey}|${tag}`;
}
