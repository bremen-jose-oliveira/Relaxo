import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { getSyncState, setSyncState, clearSyncState } from '@/db/syncState';
import {
  getAllBabies,
  getBathEventsForBaby,
  getDailyChoresForBaby,
  getDayContextTagsForBaby,
  getDiaperEventsForBaby,
  getFeedingEventsForBaby,
  getSleepEventsForBaby,
  getSleepPausesForBaby,
  getWakeEventsForBaby,
  upsertBaby,
} from '@/db/database';
import { getCurrentUser } from '@/lib/auth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  Baby,
  BathEvent,
  DailyChore,
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
  dayContextTags,
} = schema;

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

/** Ensure the signed-in user has a household; create one if needed. */
export async function ensureHousehold(): Promise<
  { householdId: string; inviteCode: string } | { error: string }
> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return { error: 'Not signed in.' };

  const local = await getSyncState();
  if (local.householdId && local.inviteCode) {
    return { householdId: local.householdId, inviteCode: local.inviteCode };
  }

  const { data: memberships, error: memErr } = await supabase
    .from('household_members')
    .select('household_id, households(id, invite_code)')
    .eq('user_id', user.id)
    .limit(1);

  if (memErr) return { error: memErr.message };

  if (memberships && memberships.length > 0) {
    const row = memberships[0] as {
      household_id: string;
      households:
        | { id: string; invite_code: string }
        | { id: string; invite_code: string }[]
        | null;
    };
    const hh = Array.isArray(row.households) ? row.households[0] : row.households;
    if (hh) {
      await setSyncState({ householdId: hh.id, inviteCode: hh.invite_code });
      return { householdId: hh.id, inviteCode: hh.invite_code };
    }
  }

  const inviteCode = makeInviteCode();
  const { data: household, error: hhErr } = await supabase
    .from('households')
    .insert({
      name: 'Family',
      invite_code: inviteCode,
      created_by: user.id,
    })
    .select('id, invite_code')
    .single();

  if (hhErr || !household) {
    return { error: hhErr?.message ?? 'Could not create household.' };
  }

  const { error: joinErr } = await supabase.from('household_members').insert({
    household_id: household.id,
    user_id: user.id,
    role: 'owner',
  });

  if (joinErr) return { error: joinErr.message };

  await setSyncState({
    householdId: household.id,
    inviteCode: household.invite_code,
  });

  return { householdId: household.id, inviteCode: household.invite_code };
}

export async function joinHouseholdByInviteCode(
  code: string
): Promise<{ householdId: string; inviteCode: string } | { error: string }> {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!supabase || !user) return { error: 'Not signed in.' };

  const normalized = code.trim().toUpperCase();
  if (normalized.length < 6) return { error: 'Invalid invite code.' };

  const { data: household, error } = await supabase
    .from('households')
    .select('id, invite_code')
    .eq('invite_code', normalized)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!household) return { error: 'No household found for that code.' };

  const { error: joinErr } = await supabase.from('household_members').upsert({
    household_id: household.id,
    user_id: user.id,
    role: 'member',
  });

  if (joinErr) return { error: joinErr.message };

  await setSyncState({
    householdId: household.id,
    inviteCode: household.invite_code,
  });

  return { householdId: household.id, inviteCode: household.invite_code };
}

async function upsertRemote(
  table: string,
  rows: Record<string, unknown>[]
): Promise<{ error?: string; count: number }> {
  if (rows.length === 0) return { count: 0 };
  const supabase = getSupabase()!;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) return { error: error.message, count: 0 };
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
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Record<string, unknown>[] };
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

/**
 * Full household sync: push local → cloud, then pull cloud → local.
 * Upsert by primary key (last sync wins for overlapping edits).
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

  try {
    const babies = await getAllBabies();
    const babyPush = await upsertRemote(
      'babies',
      babies.map((b) => ({
        id: b.id,
        household_id: householdId,
        name: b.name,
        birth_date: b.birthDate,
        nap_goal: b.napGoal ?? 0,
        track_feeding_duration: b.trackFeedingDuration ? 1 : 0,
        easily_overstimulated: b.easilyOverstimulated ? 1 : 0,
        high_need: b.highNeed ? 1 : 0,
        updated_at: now,
        deleted_at: null,
      }))
    );
    if (babyPush.error) return { ok: false, error: babyPush.error };
    pushed += babyPush.count;

    for (const baby of babies) {
      const [sleep, pauses, feedings, diapers, baths, wakes, chores, tags] = await Promise.all([
        getSleepEventsForBaby(baby.id),
        getSleepPausesForBaby(baby.id),
        getFeedingEventsForBaby(baby.id),
        getDiaperEventsForBaby(baby.id),
        getBathEventsForBaby(baby.id),
        getWakeEventsForBaby(baby.id),
        getDailyChoresForBaby(baby.id),
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
        const result = await upsertRemote(batch.table, batch.rows);
        if (result.error) return { ok: false, error: result.error };
        pushed += result.count;
      }
    }

    const remoteBabies = await pullTable('babies', householdId);
    if (remoteBabies.error) return { ok: false, error: remoteBabies.error };

    for (const row of remoteBabies.rows) {
      const baby: Baby = {
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
      await upsertBaby(baby);
      pulled += 1;
    }

    const sleepRemote = await pullTable('sleep_events', householdId);
    if (sleepRemote.error) return { ok: false, error: sleepRemote.error };
    for (const row of sleepRemote.rows) {
      const event: SleepEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        type: row.type as SleepEvent['type'],
        startTime: String(row.start_time),
        endTime: row.end_time ? String(row.end_time) : null,
        extension: (row.extension as NapExtension | null) ?? null,
      };
      await upsertById(sleepEvents, event.id, {
        id: event.id,
        babyId: event.babyId,
        type: event.type,
        startTime: event.startTime,
        endTime: event.endTime,
        extension: event.extension ?? null,
      });
      pulled += 1;
    }

    const pauseRemote = await pullTable('sleep_pauses', householdId);
    if (pauseRemote.error) return { ok: false, error: pauseRemote.error };
    for (const row of pauseRemote.rows) {
      const pause: SleepPause = {
        id: String(row.id),
        sleepEventId: String(row.sleep_event_id),
        startTime: String(row.start_time),
        endTime: row.end_time ? String(row.end_time) : null,
      };
      await upsertById(sleepPauses, pause.id, pause);
      pulled += 1;
    }

    const feedRemote = await pullTable('feeding_events', householdId);
    if (feedRemote.error) return { ok: false, error: feedRemote.error };
    for (const row of feedRemote.rows) {
      const event: FeedingEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        feedType: row.feed_type as FeedingEvent['feedType'],
        startTime: String(row.start_time),
        endTime: row.end_time ? String(row.end_time) : null,
        side: (row.side as FeedingEvent['side']) ?? null,
        amount: row.amount != null ? Number(row.amount) : null,
        unit: (row.unit as FeedingEvent['unit']) ?? null,
        notes: row.notes ? String(row.notes) : null,
      };
      await upsertById(feedingEvents, event.id, event);
      pulled += 1;
    }

    const diaperRemote = await pullTable('diaper_events', householdId);
    if (diaperRemote.error) return { ok: false, error: diaperRemote.error };
    for (const row of diaperRemote.rows) {
      const event: DiaperEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        diaperType: row.diaper_type as DiaperEvent['diaperType'],
        time: String(row.time),
        notes: row.notes ? String(row.notes) : null,
      };
      await upsertById(diaperEvents, event.id, event);
      pulled += 1;
    }

    const bathRemote = await pullTable('bath_events', householdId);
    if (bathRemote.error) return { ok: false, error: bathRemote.error };
    for (const row of bathRemote.rows) {
      const event: BathEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        time: String(row.time),
        notes: row.notes ? String(row.notes) : null,
      };
      await upsertById(bathEvents, event.id, event);
      pulled += 1;
    }

    const wakeRemote = await pullTable('wake_events', householdId);
    if (wakeRemote.error) return { ok: false, error: wakeRemote.error };
    for (const row of wakeRemote.rows) {
      const event: WakeEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        time: String(row.time),
        endTime: row.end_time ? String(row.end_time) : null,
        wakeType: (row.wake_type as WakeEvent['wakeType']) ?? 'morning',
        notes: row.notes ? String(row.notes) : null,
      };
      await upsertById(wakeEvents, event.id, event);
      pulled += 1;
    }

    const choreRemote = await pullTable('daily_chores', householdId);
    if (choreRemote.error) return { ok: false, error: choreRemote.error };
    for (const row of choreRemote.rows) {
      const chore: DailyChore = {
        id: String(row.id),
        babyId: String(row.baby_id),
        title: String(row.title),
        sortOrder: Number(row.sort_order) || 0,
        createdAt: String(row.created_at),
        recurrence: (row.recurrence as DailyChore['recurrence']) ?? 'daily',
      };
      await upsertById(dailyChores, chore.id, chore);
      pulled += 1;
    }

    const tagRemote = await pullTable('day_context_tags', householdId);
    if (tagRemote.error) return { ok: false, error: tagRemote.error };
    for (const row of tagRemote.rows) {
      const tag: DayContextTagEvent = {
        id: String(row.id),
        babyId: String(row.baby_id),
        dateKey: String(row.date_key),
        tag: row.tag as DayContextTag,
      };
      await upsertById(dayContextTags, tag.id, {
        id: tag.id,
        babyId: tag.babyId,
        dateKey: tag.dateKey,
        tag: tag.tag,
      });
      pulled += 1;
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
