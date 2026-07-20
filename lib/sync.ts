import { newId } from '@/lib/newId';
import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { getSyncState, setSyncState, clearSyncState } from '@/db/syncState';
import {
  getAllBabies,
  getBaby,
  deleteBaby,
  deleteBathEvent,
  deleteDailyChore,
  deleteDailyChoreCompletion,
  deleteDayContextTag,
  deleteDiaperEvent,
  deleteFeedingEvent,
  deleteSleepEvent,
  deleteSleepPause,
  deleteWakeEvent,
  getBathEventsForBaby,
  getDailyChoreCompletionsForBaby,
  getDailyChoresForBaby,
  getDayContextTagsForBaby,
  getDiaperEventsForBaby,
  getFeedingEventsForBaby,
  getSleepEventsForBaby,
  getSleepPausesForBaby,
  getWakeEventsForBaby,
  upsertBaby,
  upsertDailyChoreCompletion,
} from '@/db/database';
import { getCurrentUser } from '@/lib/auth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Baby,
  BathEvent,
  DailyChore,
  DailyChoreCompletion,
  DayContextTag,
  DayContextTagEvent,
  DiaperEvent,
  FeedingEvent,
  NapExtension,
  SleepEvent,
  SleepPause,
  WakeEvent,
} from '@/types';

const {
  sleepEvents,
  sleepPauses,
  feedingEvents,
  diaperEvents,
  bathEvents,
  wakeEvents,
  dailyChores,
  dailyChoreCompletions,
  dayContextTags,
  pendingSyncDeletes,
} = schema;

/** Tables that sync with soft-delete tombstones on Supabase. */
export type SyncTable =
  | 'babies'
  | 'sleep_events'
  | 'sleep_pauses'
  | 'feeding_events'
  | 'diaper_events'
  | 'bath_events'
  | 'wake_events'
  | 'daily_chores'
  | 'daily_chore_completions'
  | 'day_context_tags';

const EVENT_SYNC_TABLES: SyncTable[] = [
  'sleep_events',
  'sleep_pauses',
  'feeding_events',
  'diaper_events',
  'bath_events',
  'wake_events',
  'daily_chores',
  'daily_chore_completions',
  'day_context_tags',
];

function makeInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export type SyncResult = {
  ok: boolean;
  error?: string;
  householdId?: string;
  inviteCode?: string;
  pushed?: number;
  pulled?: number;
};

/** Load an existing household for this user. Never creates one. */
export async function resolveExistingHousehold(): Promise<
  | { householdId: string; inviteCode: string; name: string | null }
  | { error: string }
  | null
> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return { error: 'Not signed in.' };

  const local = await getSyncState();
  if (local.householdId && local.inviteCode) {
    const member = await verifyHouseholdMembership(local.householdId);
    if (member) {
      return {
        householdId: local.householdId,
        inviteCode: local.inviteCode,
        name: local.householdName,
      };
    }
    // Stale local household (e.g. join never completed) — clear and re-resolve from server.
    await setSyncState({
      householdId: null,
      inviteCode: null,
      householdName: null,
    });
  }

  const { data: memberships, error: memErr } = await supabase
    .from('household_members')
    .select('household_id, households(id, invite_code, name)')
    .eq('user_id', user.id)
    .limit(1);

  if (memErr) return { error: memErr.message };

  if (memberships && memberships.length > 0) {
    const row = memberships[0] as {
      household_id: string;
      households:
        | { id: string; invite_code: string; name: string | null }
        | { id: string; invite_code: string; name: string | null }[]
        | null;
    };
    const hh = Array.isArray(row.households) ? row.households[0] : row.households;
    if (hh) {
      await setSyncState({
        householdId: hh.id,
        inviteCode: hh.invite_code,
        householdName: hh.name ?? null,
      });
      return {
        householdId: hh.id,
        inviteCode: hh.invite_code,
        name: hh.name ?? null,
      };
    }
  }

  return null;
}

async function verifyHouseholdMembership(householdId: string): Promise<boolean> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return false;

  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * For sync: require an existing household (local or remote membership).
 * Does not auto-create — user must Create household or Join with code.
 */
export async function ensureHousehold(): Promise<
  { householdId: string; inviteCode: string; name: string | null } | { error: string }
> {
  const resolved = await resolveExistingHousehold();
  if (resolved === null) {
    return { error: 'Create or join a household first.' };
  }
  if ('error' in resolved) return resolved;
  return resolved;
}

/** Explicitly create a named household for the signed-in user. */
export async function createHousehold(name: string): Promise<
  { householdId: string; inviteCode: string; name: string } | { error: string }
> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return { error: 'Not signed in.' };

  const trimmed = name.trim();
  if (!trimmed) return { error: 'Enter a household name.' };

  const existing = await resolveExistingHousehold();
  if (existing && !('error' in existing)) {
    return {
      householdId: existing.householdId,
      inviteCode: existing.inviteCode,
      name: existing.name?.trim() || trimmed,
    };
  }
  if (existing && 'error' in existing) return existing;

  const inviteCode = makeInviteCode();
  const householdId = newId();

  const { error: hhErr } = await supabase.from('households').insert({
    id: householdId,
    name: trimmed,
    invite_code: inviteCode,
    created_by: user.id,
  });

  if (hhErr) {
    return { error: hhErr.message };
  }

  const { error: joinErr } = await supabase.from('household_members').insert({
    household_id: householdId,
    user_id: user.id,
    role: 'owner',
  });

  if (joinErr) return { error: joinErr.message };

  await setSyncState({
    householdId,
    inviteCode,
    householdName: trimmed,
  });

  return { householdId, inviteCode, name: trimmed };
}

export async function joinHouseholdByInviteCode(
  code: string
): Promise<{ householdId: string; inviteCode: string; name: string | null } | { error: string }> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return { error: 'Not signed in.' };

  const normalized = code.trim().toUpperCase();
  if (normalized.length < 6) return { error: 'Invalid invite code.' };

  // SECURITY DEFINER RPC — direct SELECT on households is blocked by RLS for non-members.
  const { data, error } = await supabase.rpc('join_household_by_invite', {
    p_code: normalized,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/join_household_by_invite|Could not find the function|PGRST202/i.test(msg)) {
      return {
        error:
          'Join is not set up on the server yet. In Supabase SQL Editor, run supabase/0014_join_household_by_invite.sql, then try again.',
      };
    }
    return { error: msg || 'Could not join household.' };
  }

  if (!data || typeof data !== 'object') {
    return { error: 'No household found for that code.' };
  }

  const household = data as {
    id?: string;
    invite_code?: string;
    name?: string | null;
  };

  if (!household.id || !household.invite_code) {
    return { error: 'No household found for that code.' };
  }

  await setSyncState({
    householdId: household.id,
    inviteCode: household.invite_code,
    householdName: household.name ?? null,
  });

  return {
    householdId: household.id,
    inviteCode: household.invite_code,
    name: household.name ?? null,
  };
}

async function upsertRemote(
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ error?: string; count: number }> {
  if (rows.length === 0) return { count: 0 };
  const supabase = getSupabase()!;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) {
    return {
      error: formatAuthSyncError(formatRemoteError(table, error.message)),
      count: 0,
    };
  }
  return { count: rows.length };
}

async function pullTable(
  table: string,
  householdId: string
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (error) {
    return { rows: [], error: formatRemoteError(table, error.message) };
  }
  return { rows: (data ?? []) as Record<string, unknown>[] };
}

async function pullTableOptional(
  table: string,
  householdId: string
): Promise<{ rows: Record<string, unknown>[]; error?: string; skipped?: boolean }> {
  const result = await pullTable(table, householdId);
  if (result.error && isRemoteSchemaMissingError(result.error)) {
    return { rows: [], skipped: true };
  }
  return result;
}

function formatRemoteError(table: string, message: string): string {
  // PostgREST uses "schema cache" for missing tables AND missing columns — don't
  // tell people the whole table is gone when only a column/RPC is missing.
  if (/Could not find the ['"]?[\w]+['"]? column/i.test(message)) {
    return (
      `${table}: a column is missing on Supabase. In SQL Editor run ` +
      `0011_sleep_insights.sql and 0012_task_reminders.sql, then retry. (${message})`
    );
  }
  if (/Could not find the table/i.test(message)) {
    return (
      `${table}: table missing on Supabase. Run supabase/schema.sql in SQL Editor, then retry. (${message})`
    );
  }
  return `${table}: ${message}`;
}

function isMissingRemoteTableError(error?: string): boolean {
  if (!error) return false;
  return /Could not find the table|relation .* does not exist/i.test(error);
}

function isRemoteSchemaMissingError(error?: string): boolean {
  if (!error) return false;
  return (
    isMissingRemoteTableError(error) ||
    /Could not find the ['"]?[\w]+['"]? column/i.test(error)
  );
}

function formatAuthSyncError(message: string): string {
  if (/row-level security|permission denied|JWT|not authenticated/i.test(message)) {
    return (
      'Cloud access denied. Sign out, sign in again, then re-join the household with the invite code. ' +
      `(${message})`
    );
  }
  return message;
}

function hasUnpushedLocalChanges(
  table: string,
  id: string,
  localPayload: Record<string, unknown>,
  snapshots: Map<string, Record<string, unknown>>
): boolean {
  const snapshot = snapshots.get(snapKey(table, id));
  if (!snapshot) return false;
  return !payloadsEqual(localPayload, snapshot);
}

function sleepLocalPayload(
  local: Record<string, unknown>,
  householdId: string
): Record<string, unknown> {
  return {
    id: String(local.id),
    household_id: householdId,
    baby_id: String(local.babyId),
    type: local.type,
    start_time: String(local.startTime),
    end_time: local.endTime ? String(local.endTime) : null,
    extension: local.extension ?? null,
  };
}

function feedingLocalPayload(
  local: Record<string, unknown>,
  householdId: string
): Record<string, unknown> {
  return {
    id: String(local.id),
    household_id: householdId,
    baby_id: String(local.babyId),
    feed_type: local.feedType,
    start_time: String(local.startTime),
    end_time: local.endTime ? String(local.endTime) : null,
    side: local.side ?? null,
    amount: local.amount ?? null,
    unit: local.unit ?? null,
    notes: local.notes ?? null,
  };
}

/** Don't push a stale open sleep/feed over a partner's ended row on cloud. */
function filterTimedEventPushRows(
  table: 'sleep_events' | 'feeding_events',
  rows: Record<string, unknown>[],
  snapshots: Map<string, Record<string, unknown>>
): Record<string, unknown>[] {
  return filterChangedPushRows(table, rows, snapshots).filter((row) => {
    const snapshot = snapshots.get(snapKey(table, String(row.id)));
    if (snapshot?.end_time && !row.end_time) return false;
    return true;
  });
}

async function getLocalRow(
  table: any,
  id: string
): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
  return rows[0] ? (rows[0] as Record<string, unknown>) : null;
}

function snapKey(table: string, id: string): string {
  return `${table}:${id}`;
}

function stripSyncMeta(row: Record<string, unknown>): Record<string, unknown> {
  const { updated_at, deleted_at, ...rest } = row;
  return rest;
}

function payloadsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key] ?? null;
    const bv = b[key] ?? null;
    if (av === bv) continue;
    if (av == null && bv == null) continue;
    if (String(av) === String(bv)) continue;
    return false;
  }
  return true;
}

function rememberRemoteRows(
  snapshots: Map<string, Record<string, unknown>>,
  table: string,
  rows: Record<string, unknown>[],
  householdId: string,
  toPayload: (row: Record<string, unknown>, householdId: string) => Record<string, unknown>
): void {
  for (const row of rows) {
    snapshots.set(
      snapKey(table, String(row.id)),
      toPayload(row, householdId)
    );
  }
}

function filterChangedPushRows(
  table: string,
  rows: Record<string, unknown>[],
  snapshots: Map<string, Record<string, unknown>>
): Record<string, unknown>[] {
  return rows.filter((row) => {
    const remote = snapshots.get(snapKey(table, String(row.id)));
    if (!remote) return true;
    return !payloadsEqual(stripSyncMeta(row), remote);
  });
}

async function localRowExists(table: SyncTable, id: string): Promise<boolean> {
  switch (table) {
    case 'babies':
      return (await getBaby(id)) != null;
    case 'sleep_events':
      return (await getLocalRow(sleepEvents, id)) != null;
    case 'sleep_pauses':
      return (await getLocalRow(sleepPauses, id)) != null;
    case 'feeding_events':
      return (await getLocalRow(feedingEvents, id)) != null;
    case 'diaper_events':
      return (await getLocalRow(diaperEvents, id)) != null;
    case 'bath_events':
      return (await getLocalRow(bathEvents, id)) != null;
    case 'wake_events':
      return (await getLocalRow(wakeEvents, id)) != null;
    case 'daily_chores':
      return (await getLocalRow(dailyChores, id)) != null;
    case 'daily_chore_completions':
      return (await getLocalRow(dailyChoreCompletions, id)) != null;
    case 'day_context_tags':
      return (await getLocalRow(dayContextTags, id)) != null;
  }
}

async function upsertById(
  // Generic across Drizzle table shapes
  table: any,
  id: string,
  values: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (existing.length > 0) {
    await db.update(table).set(values).where(eq(table.id, id));
  } else {
    await db.insert(table).values(values);
  }
}

async function hardDeleteLocal(table: SyncTable, id: string): Promise<void> {
  switch (table) {
    case 'babies':
      await deleteBaby(id);
      return;
    case 'sleep_events':
      await deleteSleepEvent(id);
      return;
    case 'sleep_pauses':
      await deleteSleepPause(id);
      return;
    case 'feeding_events':
      await deleteFeedingEvent(id);
      return;
    case 'diaper_events':
      await deleteDiaperEvent(id);
      return;
    case 'bath_events':
      await deleteBathEvent(id);
      return;
    case 'wake_events':
      await deleteWakeEvent(id);
      return;
    case 'daily_chores':
      await deleteDailyChore(id);
      return;
    case 'daily_chore_completions':
      await deleteDailyChoreCompletion(id);
      return;
    case 'day_context_tags':
      await deleteDayContextTag(id);
      return;
  }
}

/**
 * Soft-delete rows on Supabase. No-op when not signed in / no household.
 * Call before hard-deleting locally so the partner's next sync removes them.
 */
export async function softDeleteRemote(
  table: SyncTable,
  ids: string[]
): Promise<{ ok: boolean; error?: string }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { ok: true };
  if (!isSupabaseConfigured()) return { ok: true };

  const user = await getCurrentUser();
  if (!user) return { ok: true };

  const ensured = await ensureHousehold();
  if ('error' in ensured) {
    if (ensured.error === 'Create or join a household first.') {
      return { ok: true, error: 'no_household' };
    }
    return { ok: false, error: ensured.error };
  }

  const now = new Date().toISOString();
  const supabase = getSupabase()!;
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: now, updated_at: now })
    .in('id', unique)
    .eq('household_id', ensured.householdId);

  if (error) return { ok: false, error: formatRemoteError(table, error.message) };
  return { ok: true };
}

async function getLocalBabyIdSet(): Promise<Set<string>> {
  const babies = await getAllBabies();
  return new Set(babies.map((b) => b.id));
}

function pendingDeleteKey(table: SyncTable, rowId: string): string {
  return `${table}:${rowId}`;
}

async function enqueuePendingDeletes(table: SyncTable, ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  try {
    const db = await getDb();
    const now = new Date().toISOString();
    for (const rowId of unique) {
      await db
        .insert(pendingSyncDeletes)
        .values({
          id: pendingDeleteKey(table, rowId),
          tableName: table,
          rowId,
          createdAt: now,
        })
        .onConflictDoNothing();
    }
  } catch {
    // Local queue table may not exist until app migration 0015 runs — skip.
  }
}

async function clearPendingDeletes(table: SyncTable, ids: string[]): Promise<void> {
  const keys = ids.map((id) => pendingDeleteKey(table, id));
  if (keys.length === 0) return;
  try {
    const db = await getDb();
    await db.delete(pendingSyncDeletes).where(inArray(pendingSyncDeletes.id, keys));
  } catch {
    // ignore
  }
}

/**
 * Remember a delete for cloud, try to soft-delete now, keep pending if offline.
 * Always safe to call before the local hard-delete.
 */
export async function queueRemoteDelete(
  table: SyncTable,
  ids: string[]
): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  await enqueuePendingDeletes(table, unique);
  const result = await softDeleteRemote(table, unique);
  if (result.ok || result.error === 'no_household') {
    await clearPendingDeletes(table, unique);
  }
}

/**
 * Soft-delete a sleep event and its pauses on Supabase (immediate + pending).
 */
export async function softDeleteSleepEventRemote(
  sleepEventId: string
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const pauseRows = await db
    .select({ id: sleepPauses.id })
    .from(sleepPauses)
    .where(eq(sleepPauses.sleepEventId, sleepEventId));
  const pauseIds = pauseRows.map((p) => p.id);

  await enqueuePendingDeletes('sleep_pauses', pauseIds);
  await enqueuePendingDeletes('sleep_events', [sleepEventId]);

  if (!isSupabaseConfigured()) {
    return { ok: true };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: true };

  const ensured = await ensureHousehold();
  if ('error' in ensured) {
    if (ensured.error === 'Create or join a household first.') {
      await clearPendingDeletes('sleep_pauses', pauseIds);
      await clearPendingDeletes('sleep_events', [sleepEventId]);
      return { ok: true, error: 'no_household' };
    }
    return { ok: false, error: ensured.error };
  }

  const now = new Date().toISOString();
  const supabase = getSupabase()!;
  const { error: pauseErr } = await supabase
    .from('sleep_pauses')
    .update({ deleted_at: now, updated_at: now })
    .eq('sleep_event_id', sleepEventId)
    .eq('household_id', ensured.householdId);
  if (pauseErr) {
    return { ok: false, error: formatRemoteError('sleep_pauses', pauseErr.message) };
  }

  const sleepResult = await softDeleteRemote('sleep_events', [sleepEventId]);
  if (sleepResult.ok) {
    await clearPendingDeletes('sleep_pauses', pauseIds);
    await clearPendingDeletes('sleep_events', [sleepEventId]);
  }
  return sleepResult;
}

/**
 * Soft-delete a baby on Supabase (deleted_at). No-op if not in a household.
 */
export async function softDeleteBabyRemote(
  babyId: string
): Promise<{ ok: boolean; error?: string }> {
  await enqueuePendingDeletes('babies', [babyId]);
  const result = await softDeleteRemote('babies', [babyId]);
  if (result.ok || result.error === 'no_household') {
    await clearPendingDeletes('babies', [babyId]);
  }
  return result;
}

/** Flush any deletes that were recorded while offline. */
async function flushPendingRemoteDeletes(): Promise<void> {
  try {
    const db = await getDb();
    const rows = await db.select().from(pendingSyncDeletes);
    if (rows.length === 0) return;

    const byTable = new Map<SyncTable, string[]>();
    for (const row of rows) {
      const table = row.tableName as SyncTable;
      const list = byTable.get(table) ?? [];
      list.push(row.rowId);
      byTable.set(table, list);
    }

    const ensured = await ensureHousehold();
    if ('error' in ensured) return;
    const now = new Date().toISOString();
    const supabase = getSupabase();
    if (!supabase) return;

    const sleepIds = byTable.get('sleep_events') ?? [];
    for (const sleepId of sleepIds) {
      await supabase
        .from('sleep_pauses')
        .update({ deleted_at: now, updated_at: now })
        .eq('sleep_event_id', sleepId)
        .eq('household_id', ensured.householdId);
    }

    for (const [table, ids] of byTable) {
      const result = await softDeleteRemote(table, ids);
      if (result.ok || result.error === 'no_household') {
        await clearPendingDeletes(table, ids);
      }
    }
  } catch {
    // pending_sync_deletes is phone-local only; ignore if migration not applied yet.
  }
}

/** Remove local rows that were soft-deleted on the server. */
async function reconcileDeletedRemote(
  table: SyncTable,
  householdId: string
): Promise<number> {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('household_id', householdId)
    .not('deleted_at', 'is', null);
  if (error) {
    if (isMissingRemoteTableError(formatRemoteError(table, error.message))) return 0;
    return 0;
  }
  if (!data) return 0;

  let removed = 0;
  for (const row of data) {
    const id = String(row.id);
    if (!(await localRowExists(table, id))) continue;
    await hardDeleteLocal(table, id);
    removed += 1;
  }
  return removed;
}

function babyPayload(
  row: Record<string, unknown> | Baby,
  householdId: string
): Record<string, unknown> {
  if ('birthDate' in row && typeof row.birthDate === 'string') {
    const baby = row as Baby;
    return {
      id: baby.id,
      household_id: householdId,
      name: baby.name,
      birth_date: baby.birthDate,
      nap_goal: baby.napGoal ?? 0,
      track_feeding_duration: baby.trackFeedingDuration ? 1 : 0,
      easily_overstimulated: baby.easilyOverstimulated ? 1 : 0,
      high_need: baby.highNeed ? 1 : 0,
    };
  }
  const remote = row as Record<string, unknown>;
  return {
    id: String(remote.id),
    household_id: householdId,
    name: String(remote.name),
    birth_date: String(remote.birth_date),
    nap_goal: Number(remote.nap_goal) || 0,
    track_feeding_duration: Number(remote.track_feeding_duration) === 1 ? 1 : 0,
    easily_overstimulated: Number(remote.easily_overstimulated) === 1 ? 1 : 0,
    high_need: Number(remote.high_need) === 1 ? 1 : 0,
  };
}

function mapBabyRow(row: Record<string, unknown>): Baby {

  return {
    id: String(row.id),
    name: String(row.name),
    birthDate: String(row.birth_date),
    napGoal:
      row.nap_goal === 2 || row.nap_goal === 3 || row.nap_goal === 4
        ? (row.nap_goal as 2 | 3 | 4)
        : null,
    trackFeedingDuration: Number(row.track_feeding_duration) === 1,
    easilyOverstimulated: Number(row.easily_overstimulated) === 1,
    highNeed: Number(row.high_need) === 1,
  };
}

async function applyRemoteBabies(rows: Record<string, unknown>[]): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const baby = mapBabyRow(row);
    const existing = await getBaby(baby.id);
    if (
      existing &&
      existing.name === baby.name &&
      existing.birthDate === baby.birthDate &&
      existing.napGoal === baby.napGoal &&
      existing.trackFeedingDuration === baby.trackFeedingDuration &&
      existing.easilyOverstimulated === baby.easilyOverstimulated &&
      existing.highNeed === baby.highNeed
    ) {
      continue;
    }
    await upsertBaby(baby);
    n += 1;
  }
  return n;
}

function sleepMatches(
  local: Record<string, unknown> | null,
  event: SleepEvent
): boolean {
  if (!local) return false;
  return (
    local.babyId === event.babyId &&
    local.type === event.type &&
    local.startTime === event.startTime &&
    (local.endTime ?? null) === (event.endTime ?? null) &&
    (local.extension ?? null) === (event.extension ?? null)
  );
}

async function applyRemoteSleep(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(sleepEvents, id);
    const remoteEnd = row.end_time ? String(row.end_time) : null;
    const localEnd = local?.endTime ? String(local.endTime) : null;

    if (local && snapshots.has(snapKey('sleep_events', id))) {
      const dirty = hasUnpushedLocalChanges(
        'sleep_events',
        id,
        sleepLocalPayload(local, householdId),
        snapshots
      );
      if (dirty && !(remoteEnd && !localEnd)) continue;
    }

    const event: SleepEvent = {
      id,
      babyId: String(row.baby_id),
      type: row.type as SleepEvent['type'],
      startTime: String(row.start_time),
      endTime: remoteEnd,
      extension: (row.extension as NapExtension | null) ?? null,
    };
    if (sleepMatches(local, event)) continue;
    await upsertById(sleepEvents, event.id, {
      id: event.id,
      babyId: event.babyId,
      type: event.type,
      startTime: event.startTime,
      endTime: event.endTime,
      extension: event.extension ?? null,
    });
    n += 1;
  }
  return n;
}

function pauseMatches(
  local: Record<string, unknown> | null,
  pause: SleepPause
): boolean {
  if (!local) return false;
  return (
    local.sleepEventId === pause.sleepEventId &&
    local.startTime === pause.startTime &&
    (local.endTime ?? null) === (pause.endTime ?? null)
  );
}

async function applyRemotePauses(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(sleepPauses, id);
    const remoteEnd = row.end_time ? String(row.end_time) : null;
    const localEnd = local?.endTime ? String(local.endTime) : null;

    if (local && snapshots.has(snapKey('sleep_pauses', id))) {
      const localPayload = {
        id: String(local.id),
        household_id: householdId,
        sleep_event_id: String(local.sleepEventId),
        start_time: String(local.startTime),
        end_time: localEnd,
      };
      const dirty = hasUnpushedLocalChanges('sleep_pauses', id, localPayload, snapshots);
      if (dirty && !(remoteEnd && !localEnd)) continue;
    }

    const pause: SleepPause = {
      id,
      sleepEventId: String(row.sleep_event_id),
      startTime: String(row.start_time),
      endTime: remoteEnd,
    };
    if (pauseMatches(local, pause)) continue;
    await upsertById(sleepPauses, pause.id, pause);
    n += 1;
  }
  return n;
}

function feedingMatches(
  local: Record<string, unknown> | null,
  event: FeedingEvent
): boolean {
  if (!local) return false;
  return (
    local.babyId === event.babyId &&
    local.feedType === event.feedType &&
    local.startTime === event.startTime &&
    (local.endTime ?? null) === (event.endTime ?? null) &&
    (local.side ?? null) === (event.side ?? null) &&
    (local.amount ?? null) === (event.amount ?? null) &&
    (local.unit ?? null) === (event.unit ?? null) &&
    (local.notes ?? null) === (event.notes ?? null)
  );
}

async function applyRemoteFeedings(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(feedingEvents, id);
    const remoteEnd = row.end_time ? String(row.end_time) : null;
    const localEnd = local?.endTime ? String(local.endTime) : null;

    if (local && snapshots.has(snapKey('feeding_events', id))) {
      const dirty = hasUnpushedLocalChanges(
        'feeding_events',
        id,
        feedingLocalPayload(local, householdId),
        snapshots
      );
      if (dirty && !(remoteEnd && !localEnd)) continue;
    }

    const event: FeedingEvent = {
      id,
      babyId: String(row.baby_id),
      feedType: row.feed_type as FeedingEvent['feedType'],
      startTime: String(row.start_time),
      endTime: remoteEnd,
      side: (row.side as FeedingEvent['side']) ?? null,
      amount: row.amount != null ? Number(row.amount) : null,
      unit: (row.unit as FeedingEvent['unit']) ?? null,
      notes: row.notes ? String(row.notes) : null,
    };
    if (feedingMatches(local, event)) continue;
    await upsertById(feedingEvents, event.id, event);
    n += 1;
  }
  return n;
}

async function applyRemoteDiapers(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(diaperEvents, id);
    if (local && snapshots.has(snapKey('diaper_events', id))) {
      const dirty = hasUnpushedLocalChanges(
        'diaper_events',
        id,
        {
          id: String(local.id),
          household_id: householdId,
          baby_id: String(local.babyId),
          diaper_type: local.diaperType,
          time: String(local.time),
          notes: local.notes ?? null,
        },
        snapshots
      );
      if (dirty) continue;
    }

    const event: DiaperEvent = {
      id,
      babyId: String(row.baby_id),
      diaperType: row.diaper_type as DiaperEvent['diaperType'],
      time: String(row.time),
      notes: row.notes ? String(row.notes) : null,
    };
    if (
      local &&
      local.babyId === event.babyId &&
      local.diaperType === event.diaperType &&
      local.time === event.time &&
      (local.notes ?? null) === (event.notes ?? null)
    ) {
      continue;
    }
    await upsertById(diaperEvents, event.id, event);
    n += 1;
  }
  return n;
}

async function applyRemoteBaths(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(bathEvents, id);
    if (local && snapshots.has(snapKey('bath_events', id))) {
      const dirty = hasUnpushedLocalChanges(
        'bath_events',
        id,
        {
          id: String(local.id),
          household_id: householdId,
          baby_id: String(local.babyId),
          time: String(local.time),
          notes: local.notes ?? null,
        },
        snapshots
      );
      if (dirty) continue;
    }

    const event: BathEvent = {
      id,
      babyId: String(row.baby_id),
      time: String(row.time),
      notes: row.notes ? String(row.notes) : null,
    };
    if (
      local &&
      local.babyId === event.babyId &&
      local.time === event.time &&
      (local.notes ?? null) === (event.notes ?? null)
    ) {
      continue;
    }
    await upsertById(bathEvents, event.id, event);
    n += 1;
  }
  return n;
}

async function applyRemoteWakes(
  rows: Record<string, unknown>[],
  householdId: string,
  snapshots: Map<string, Record<string, unknown>>
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(wakeEvents, id);
    if (local && snapshots.has(snapKey('wake_events', id))) {
      const dirty = hasUnpushedLocalChanges(
        'wake_events',
        id,
        {
          id: String(local.id),
          household_id: householdId,
          baby_id: String(local.babyId),
          time: String(local.time),
          end_time: local.endTime ? String(local.endTime) : null,
          wake_type: local.wakeType,
          notes: local.notes ?? null,
        },
        snapshots
      );
      if (dirty) continue;
    }

    const event: WakeEvent = {
      id,
      babyId: String(row.baby_id),
      time: String(row.time),
      endTime: row.end_time ? String(row.end_time) : null,
      wakeType: (row.wake_type as WakeEvent['wakeType']) ?? 'morning',
      notes: row.notes ? String(row.notes) : null,
    };
    if (
      local &&
      local.babyId === event.babyId &&
      local.time === event.time &&
      (local.endTime ?? null) === (event.endTime ?? null) &&
      local.wakeType === event.wakeType &&
      (local.notes ?? null) === (event.notes ?? null)
    ) {
      continue;
    }
    await upsertById(wakeEvents, event.id, event);
    n += 1;
  }
  return n;
}

async function applyRemoteChores(rows: Record<string, unknown>[]): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(dailyChores, id);
    const chore: DailyChore = {
      id,
      babyId: String(row.baby_id),
      title: String(row.title),
      sortOrder: Number(row.sort_order) || 0,
      createdAt: String(row.created_at),
      recurrence: (row.recurrence as DailyChore['recurrence']) ?? 'daily',
      reminderMinutes:
        typeof row.reminder_minutes === 'number' ? row.reminder_minutes : null,
    };
    if (
      local &&
      local.babyId === chore.babyId &&
      local.title === chore.title &&
      local.sortOrder === chore.sortOrder &&
      local.createdAt === chore.createdAt &&
      local.recurrence === chore.recurrence &&
      (local.reminderMinutes ?? null) === (chore.reminderMinutes ?? null)
    ) {
      continue;
    }
    await upsertById(dailyChores, chore.id, chore);
    n += 1;
  }
  return n;
}

async function applyRemoteChoreCompletions(
  rows: Record<string, unknown>[]
): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(dailyChoreCompletions, id);
    const completion: DailyChoreCompletion = {
      id,
      choreId: String(row.chore_id),
      dateKey: String(row.date_key),
      completedAt: String(row.completed_at),
    };
    if (
      local &&
      local.choreId === completion.choreId &&
      local.dateKey === completion.dateKey &&
      local.completedAt === completion.completedAt
    ) {
      continue;
    }
    await upsertDailyChoreCompletion(completion);
    n += 1;
  }
  return n;
}

async function applyRemoteTags(rows: Record<string, unknown>[]): Promise<number> {
  let n = 0;
  for (const row of rows) {
    const id = String(row.id);
    const local = await getLocalRow(dayContextTags, id);
    const tag: DayContextTagEvent = {
      id,
      babyId: String(row.baby_id),
      dateKey: String(row.date_key),
      tag: row.tag as DayContextTag,
    };
    if (
      local &&
      local.babyId === tag.babyId &&
      local.dateKey === tag.dateKey &&
      local.tag === tag.tag
    ) {
      continue;
    }
    await upsertById(dayContextTags, tag.id, {
      id: tag.id,
      babyId: tag.babyId,
      dateKey: tag.dateKey,
      tag: tag.tag,
    });
    n += 1;
  }
  return n;
}

/**
 * Full household sync (local-first):
 * 1. Apply remote soft-deletes locally (so partner deletes stick)
 * 2. Pull live remote rows into SQLite (so ended sleeps update before we push)
 * 3. Push current local rows to cloud
 *
 * This stops a stale open sleep on phone B from overwriting an ended sleep from phone A.
 */
export async function syncHouseholdData(): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase is not configured.' };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const ensured = await ensureHousehold();
  if ('error' in ensured) return { ok: false, error: ensured.error };

  const { householdId, inviteCode } = ensured;
  const now = new Date().toISOString();
  let pushed = 0;
  let pulled = 0;
  const remoteSnapshots = new Map<string, Record<string, unknown>>();

  try {
    // ── 0. Offline deletes → cloud tombstones
    await flushPendingRemoteDeletes();

    // ── 1. Tombstones: remove locally whatever was soft-deleted remotely
    for (const table of ['babies', ...EVENT_SYNC_TABLES] as SyncTable[]) {
      pulled += await reconcileDeletedRemote(table, householdId);
    }

    // ── 2. Pull live cloud → local (partner updates win before we push)
    const remoteBabies = await pullTable('babies', householdId);
    if (remoteBabies.error) return { ok: false, error: remoteBabies.error };
    rememberRemoteRows(remoteSnapshots, 'babies', remoteBabies.rows, householdId, babyPayload);
    pulled += await applyRemoteBabies(remoteBabies.rows);

    const babyIds = await getLocalBabyIdSet();

    const sleepRemote = await pullTable('sleep_events', householdId);
    if (sleepRemote.error) return { ok: false, error: sleepRemote.error };
    rememberRemoteRows(remoteSnapshots, 'sleep_events', sleepRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      baby_id: String(row.baby_id),
      type: row.type,
      start_time: String(row.start_time),
      end_time: row.end_time ? String(row.end_time) : null,
      extension: row.extension ?? null,
    }));
    pulled += await applyRemoteSleep(
      sleepRemote.rows.filter((row) => babyIds.has(String(row.baby_id))),
      householdId,
      remoteSnapshots
    );

    const localSleepIds = new Set<string>();
    for (const babyId of babyIds) {
      const events = await getSleepEventsForBaby(babyId);
      for (const event of events) localSleepIds.add(event.id);
    }

    const pauseRemote = await pullTable('sleep_pauses', householdId);
    if (pauseRemote.error) return { ok: false, error: pauseRemote.error };
    rememberRemoteRows(remoteSnapshots, 'sleep_pauses', pauseRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      sleep_event_id: String(row.sleep_event_id),
      start_time: String(row.start_time),
      end_time: row.end_time ? String(row.end_time) : null,
    }));
    pulled += await applyRemotePauses(
      pauseRemote.rows.filter((row) => localSleepIds.has(String(row.sleep_event_id))),
      householdId,
      remoteSnapshots
    );

    const feedRemote = await pullTable('feeding_events', householdId);
    if (feedRemote.error) return { ok: false, error: feedRemote.error };
    rememberRemoteRows(remoteSnapshots, 'feeding_events', feedRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      baby_id: String(row.baby_id),
      feed_type: row.feed_type,
      start_time: String(row.start_time),
      end_time: row.end_time ? String(row.end_time) : null,
      side: row.side ?? null,
      amount: row.amount ?? null,
      unit: row.unit ?? null,
      notes: row.notes ?? null,
    }));
    pulled += await applyRemoteFeedings(
      feedRemote.rows.filter((row) => babyIds.has(String(row.baby_id))),
      householdId,
      remoteSnapshots
    );

    const diaperRemote = await pullTable('diaper_events', householdId);
    if (diaperRemote.error) return { ok: false, error: diaperRemote.error };
    rememberRemoteRows(remoteSnapshots, 'diaper_events', diaperRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      baby_id: String(row.baby_id),
      diaper_type: row.diaper_type,
      time: String(row.time),
      notes: row.notes ?? null,
    }));
    pulled += await applyRemoteDiapers(
      diaperRemote.rows.filter((row) => babyIds.has(String(row.baby_id))),
      householdId,
      remoteSnapshots
    );

    const bathRemote = await pullTable('bath_events', householdId);
    if (bathRemote.error) return { ok: false, error: bathRemote.error };
    rememberRemoteRows(remoteSnapshots, 'bath_events', bathRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      baby_id: String(row.baby_id),
      time: String(row.time),
      notes: row.notes ?? null,
    }));
    pulled += await applyRemoteBaths(
      bathRemote.rows.filter((row) => babyIds.has(String(row.baby_id))),
      householdId,
      remoteSnapshots
    );

    const wakeRemote = await pullTable('wake_events', householdId);
    if (wakeRemote.error) return { ok: false, error: wakeRemote.error };
    rememberRemoteRows(remoteSnapshots, 'wake_events', wakeRemote.rows, householdId, (row, hid) => ({
      id: String(row.id),
      household_id: hid,
      baby_id: String(row.baby_id),
      time: String(row.time),
      end_time: row.end_time ? String(row.end_time) : null,
      wake_type: row.wake_type ?? 'morning',
      notes: row.notes ?? null,
    }));
    pulled += await applyRemoteWakes(
      wakeRemote.rows.filter((row) => babyIds.has(String(row.baby_id))),
      householdId,
      remoteSnapshots
    );

    const choreRemote = await pullTableOptional('daily_chores', householdId);
    if (choreRemote.error) return { ok: false, error: choreRemote.error };
    if (!choreRemote.skipped) {
      rememberRemoteRows(remoteSnapshots, 'daily_chores', choreRemote.rows, householdId, (row, hid) => ({
        id: String(row.id),
        household_id: hid,
        baby_id: String(row.baby_id),
        title: String(row.title),
        sort_order: Number(row.sort_order) || 0,
        created_at: String(row.created_at),
        recurrence: row.recurrence ?? 'daily',
        reminder_minutes: typeof row.reminder_minutes === 'number' ? row.reminder_minutes : null,
      }));
      pulled += await applyRemoteChores(
        choreRemote.rows.filter((row) => babyIds.has(String(row.baby_id)))
      );
    }

    const choreCompletionRemote = await pullTableOptional(
      'daily_chore_completions',
      householdId
    );
    if (choreCompletionRemote.error) {
      return { ok: false, error: choreCompletionRemote.error };
    }
    if (!choreCompletionRemote.skipped) {
      rememberRemoteRows(
        remoteSnapshots,
        'daily_chore_completions',
        choreCompletionRemote.rows,
        householdId,
        (row, hid) => ({
          id: String(row.id),
          household_id: hid,
          chore_id: String(row.chore_id),
          date_key: String(row.date_key),
          completed_at: String(row.completed_at),
        })
      );
      pulled += await applyRemoteChoreCompletions(choreCompletionRemote.rows);
    }

    const tagRemote = await pullTableOptional('day_context_tags', householdId);
    if (tagRemote.error) return { ok: false, error: tagRemote.error };
    if (!tagRemote.skipped) {
      rememberRemoteRows(remoteSnapshots, 'day_context_tags', tagRemote.rows, householdId, (row, hid) => ({
        id: String(row.id),
        household_id: hid,
        baby_id: String(row.baby_id),
        date_key: String(row.date_key),
        tag: row.tag,
      }));
      pulled += await applyRemoteTags(
        tagRemote.rows.filter((row) => babyIds.has(String(row.baby_id)))
      );
    }

    // ── 3. Push only rows that differ from what we pulled from cloud
    const babies = await getAllBabies();
    const babyRows = babies.map((b) => ({
      ...babyPayload(b, householdId),
      updated_at: now,
      deleted_at: null,
    }));
    const babyChanged = filterChangedPushRows('babies', babyRows, remoteSnapshots);
    if (babyChanged.length > 0) {
      const babyPush = await upsertRemote('babies', babyChanged);
      if (babyPush.error) return { ok: false, error: babyPush.error };
      pushed += babyPush.count;
    }

    for (const baby of babies) {
      const [sleep, pauses, feedings, diapers, baths, wakes, chores, completions, tags] =
        await Promise.all([
          getSleepEventsForBaby(baby.id),
          getSleepPausesForBaby(baby.id),
          getFeedingEventsForBaby(baby.id),
          getDiaperEventsForBaby(baby.id),
          getBathEventsForBaby(baby.id),
          getWakeEventsForBaby(baby.id),
          getDailyChoresForBaby(baby.id),
          getDailyChoreCompletionsForBaby(baby.id),
          getDayContextTagsForBaby(baby.id),
        ]);

      const batches: { table: string; rows: Record<string, unknown>[] }[] = [
        {
          table: 'sleep_events',
          rows: sleep.map((e) => ({
            id: e.id,
            household_id: householdId,
            baby_id: e.babyId,
            type: e.type,
            start_time: e.startTime,
            end_time: e.endTime,
            extension: e.extension ?? null,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'sleep_pauses',
          rows: pauses.map((p) => ({
            id: p.id,
            household_id: householdId,
            sleep_event_id: p.sleepEventId,
            start_time: p.startTime,
            end_time: p.endTime,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'feeding_events',
          rows: feedings.map((e) => ({
            id: e.id,
            household_id: householdId,
            baby_id: e.babyId,
            feed_type: e.feedType,
            start_time: e.startTime,
            end_time: e.endTime,
            side: e.side,
            amount: e.amount,
            unit: e.unit,
            notes: e.notes,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'diaper_events',
          rows: diapers.map((e) => ({
            id: e.id,
            household_id: householdId,
            baby_id: e.babyId,
            diaper_type: e.diaperType,
            time: e.time,
            notes: e.notes,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'bath_events',
          rows: baths.map((e) => ({
            id: e.id,
            household_id: householdId,
            baby_id: e.babyId,
            time: e.time,
            notes: e.notes,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'wake_events',
          rows: wakes.map((e) => ({
            id: e.id,
            household_id: householdId,
            baby_id: e.babyId,
            time: e.time,
            end_time: e.endTime,
            wake_type: e.wakeType,
            notes: e.notes,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'daily_chores',
          rows: chores.map((c) => ({
            id: c.id,
            household_id: householdId,
            baby_id: c.babyId,
            title: c.title,
            sort_order: c.sortOrder,
            created_at: c.createdAt,
            recurrence: c.recurrence,
            reminder_minutes: c.reminderMinutes,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'daily_chore_completions',
          rows: completions.map((c) => ({
            id: c.id,
            household_id: householdId,
            chore_id: c.choreId,
            date_key: c.dateKey,
            completed_at: c.completedAt,
            updated_at: now,
            deleted_at: null,
          })),
        },
        {
          table: 'day_context_tags',
          rows: tags.map((t) => ({
            id: t.id,
            household_id: householdId,
            baby_id: t.babyId,
            date_key: t.dateKey,
            tag: t.tag,
            updated_at: now,
            deleted_at: null,
          })),
        },
      ];

      for (const batch of batches) {
        let changed: Record<string, unknown>[];
        if (batch.table === 'sleep_events') {
          changed = filterTimedEventPushRows('sleep_events', batch.rows, remoteSnapshots);
        } else if (batch.table === 'feeding_events') {
          changed = filterTimedEventPushRows('feeding_events', batch.rows, remoteSnapshots);
        } else {
          changed = filterChangedPushRows(batch.table, batch.rows, remoteSnapshots);
        }
        if (changed.length === 0) continue;
        const result = await upsertRemote(batch.table, changed);
        if (result.error) {
          if (
            batch.table === 'daily_chore_completions' &&
            isMissingRemoteTableError(result.error)
          ) {
            continue;
          }
          return { ok: false, error: result.error };
        }
        pushed += result.count;
      }
    }

    await setSyncState({ lastSyncedAt: now, householdId, inviteCode });
    return { ok: true, householdId, inviteCode, pushed, pulled };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Sync failed.',
    };
  }
}

export async function disconnectCloudSync(): Promise<void> {
  await clearSyncState();
}

export { clearSyncState };
