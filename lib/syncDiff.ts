/** Pure helpers for comparing local vs remote sync payloads. */

/** Drop sync bookkeeping fields before content comparison. */
export function stripSyncMeta(row: Record<string, unknown>): Record<string, unknown> {
  const { updated_at, deleted_at, ...rest } = row;
  return rest;
}

function syncValuesEqual(av: unknown, bv: unknown): boolean {
  const a = av === undefined ? null : av;
  const b = bv === undefined ? null : bv;
  if (a === b) return true;
  if (a == null && b == null) return true;
  // Optional text fields often flip between null and "".
  if ((a == null && b === '') || (b == null && a === '')) return true;
  if (a == null || b == null) return false;

  if (typeof a === 'number' || typeof b === 'number') {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn) && an === bn) return true;
  }

  if (typeof a === 'boolean' || typeof b === 'boolean') {
    const isBoolish = (v: unknown) =>
      v === true || v === false || v === 0 || v === 1 || v === '0' || v === '1';
    if (isBoolish(a) && isBoolish(b)) {
      const norm = (v: unknown) => v === true || v === 1 || v === '1';
      return norm(a) === norm(b);
    }
  }

  return String(a) === String(b);
}

/** True when two row payloads have the same care-data content. */
export function payloadsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (!syncValuesEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Skip applying a remote row only when we still have unpushed local edits AND
 * the cloud row has not changed since our last successful sync.
 *
 * Do not force-apply a remote endTime over a dirty local null endTime — that
 * breaks "still asleep" reopen before push.
 */
export function shouldKeepLocalOverRemote(opts: {
  hasLocal: boolean;
  localDiffersFromRemote: boolean;
  remoteUpdatedAt: string | null | undefined;
  lastSyncedAt: string | null;
  forceRemote?: boolean;
}): boolean {
  if (!opts.hasLocal) return false;
  if (opts.forceRemote) return false;
  if (!opts.localDiffersFromRemote) return false;

  const remoteMs = opts.remoteUpdatedAt ? Date.parse(String(opts.remoteUpdatedAt)) : NaN;
  const syncedMs = opts.lastSyncedAt ? Date.parse(opts.lastSyncedAt) : NaN;

  // Cloud changed after our last sync → partner wrote — take remote.
  if (Number.isFinite(remoteMs) && Number.isFinite(syncedMs) && remoteMs > syncedMs) {
    return false;
  }

  // Never synced, or missing timestamps → prefer remote so partners converge.
  if (!Number.isFinite(syncedMs) || !Number.isFinite(remoteMs)) {
    return false;
  }

  // Remote unchanged since last sync, but local differs → keep unpushed edits.
  return true;
}

/**
 * Local already ended the sleep/feed; remote is still open.
 * Never reopen from a remote `updated_at` bump on an open row.
 */
export function shouldKeepLocalEndOverRemoteOpen(opts: {
  localEndTime: string | null | undefined;
  remoteEndTime: string | null | undefined;
}): boolean {
  const localEnded = opts.localEndTime != null && String(opts.localEndTime).length > 0;
  const remoteOpen = opts.remoteEndTime == null || String(opts.remoteEndTime).length === 0;
  return localEnded && remoteOpen;
}

/**
 * Keep only rows that are new or differ from the last remote snapshot.
 * Rows with no snapshot are treated as needing a push.
 */
export function filterChangedPushRows(
  rows: Record<string, unknown>[],
  snapshots: Map<string, Record<string, unknown>>,
  keyForRow: (row: Record<string, unknown>) => string
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const remote = snapshots.get(keyForRow(row));
    if (!remote) return true;
    return !payloadsEqual(stripSyncMeta(row), remote);
  });
}

/**
 * Sleep/feed push filter: include intentional reopens (local `end_time` null
 * while the last remote snapshot still has an end).
 *
 * Partner/widget ends that are newer than `lastSyncedAt` are applied on pull
 * via `shouldKeepLocalOverRemote`, so they never reach push as local-open +
 * remote-closed. Blocking open-over-closed here used to strand "still asleep".
 */
export function filterTimedEventPushRows(
  rows: Record<string, unknown>[],
  snapshots: Map<string, Record<string, unknown>>,
  keyForRow: (row: Record<string, unknown>) => string
): Record<string, unknown>[] {
  return filterChangedPushRows(rows, snapshots, keyForRow);
}

/** PostgREST / Supabase default max rows per request. */
export const SYNC_PULL_PAGE_SIZE = 1000;

export type SyncPullPage = {
  rows: Record<string, unknown>[];
  errorMessage?: string;
};

/**
 * Fetch every matching remote row by walking `.range` pages.
 * `fetchPage(from, to)` should request inclusive indices (PostgREST `.range`).
 */
export async function pullAllPages(
  fetchPage: (from: number, to: number) => Promise<SyncPullPage>,
  pageSize: number = SYNC_PULL_PAGE_SIZE
): Promise<{ rows: Record<string, unknown>[]; errorMessage?: string }> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const page = await fetchPage(from, to);
    if (page.errorMessage) {
      return { rows: [], errorMessage: page.errorMessage };
    }
    rows.push(...page.rows);
    if (page.rows.length < pageSize) break;
    from += pageSize;
  }

  return { rows };
}
