import { getDb, schema } from "@/db/client";
import { shouldRemoveChoreOnComplete } from "@/lib/choreRecurrence";
import { newId } from "@/lib/newId";
import type {
  AppLocale,
  Baby,
  BathEvent,
  ChoreRecurrence,
  DailyChore,
  DailyChoreCompletion,
  DiaperEvent,
  FeedingEvent,
  SleepEvent,
  SleepPause,
  WakeEvent,
} from "@/types";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

const {
  babies,
  sleepEvents,
  sleepPauses,
  feedingEvents,
  diaperEvents,
  bathEvents,
  wakeEvents,
  appSettings,
  dailyChores,
  dailyChoreCompletions,
} = schema;

// Local-only persistence. No multi-device sync in v1.
// Supabase or similar could be added later for cross-device sync.

const DEDUP_TOLERANCE_MS = 60 * 1000;

import { NAP_GOAL_AUTO_DB } from "@/lib/napSchedule";

function toBaby(row: typeof babies.$inferSelect): Baby {
  const raw = row.napGoal ?? NAP_GOAL_AUTO_DB;
  const napGoal =
    raw === NAP_GOAL_AUTO_DB
      ? null
      : ((raw === 2 || raw === 3 || raw === 4 ? raw : null) as Baby["napGoal"]);
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birthDate,
    napGoal: napGoal ?? null,
    trackFeedingDuration: (row.trackFeedingDuration ?? 0) === 1,
    easilyOverstimulated: (row.easilyOverstimulated ?? 0) === 1,
    highNeed: (row.highNeed ?? 0) === 1,
  };
}

export type BulkInsertResult = {
  added: number;
  duplicatesSkipped: number;
};

function toSleepEvent(row: typeof sleepEvents.$inferSelect): SleepEvent {
  return {
    id: row.id,
    babyId: row.babyId,
    type: row.type,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
  };
}

function toFeedingEvent(row: typeof feedingEvents.$inferSelect): FeedingEvent {
  return {
    id: row.id,
    babyId: row.babyId,
    feedType: row.feedType,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
    side: row.side ?? null,
    amount: row.amount ?? null,
    unit: row.unit ?? null,
    notes: row.notes ?? null,
  };
}

function toDiaperEvent(row: typeof diaperEvents.$inferSelect): DiaperEvent {
  return {
    id: row.id,
    babyId: row.babyId,
    diaperType: row.diaperType,
    time: row.time,
    notes: row.notes ?? null,
  };
}

function toBathEvent(row: typeof bathEvents.$inferSelect): BathEvent {
  return {
    id: row.id,
    babyId: row.babyId,
    time: row.time,
    notes: row.notes ?? null,
  };
}

function toWakeEvent(row: typeof wakeEvents.$inferSelect): WakeEvent {
  return {
    id: row.id,
    babyId: row.babyId,
    time: row.time,
    endTime: row.endTime ?? null,
    wakeType: row.wakeType ?? "morning",
    notes: row.notes ?? null,
  };
}

function toSleepPause(row: typeof sleepPauses.$inferSelect): SleepPause {
  return {
    id: row.id,
    sleepEventId: row.sleepEventId,
    startTime: row.startTime,
    endTime: row.endTime ?? null,
  };
}

// ─── Baby CRUD ───────────────────────────────────────────────────────────────

export async function getAllBabies(): Promise<Baby[]> {
  const db = await getDb();
  const rows = await db.select().from(babies).orderBy(asc(babies.name));
  return rows.map(toBaby);
}

export async function getBaby(id: string): Promise<Baby | null> {
  const db = await getDb();
  const rows = await db.select().from(babies).where(eq(babies.id, id)).limit(1);
  return rows[0] ? toBaby(rows[0]) : null;
}

export async function upsertBaby(baby: Baby): Promise<void> {
  const db = await getDb();
  const napGoalDb = baby.napGoal ?? NAP_GOAL_AUTO_DB;
  await db
    .insert(babies)
    .values({
      id: baby.id,
      name: baby.name,
      birthDate: baby.birthDate,
      napGoal: napGoalDb,
      trackFeedingDuration: baby.trackFeedingDuration ? 1 : 0,
      easilyOverstimulated: baby.easilyOverstimulated ? 1 : 0,
      highNeed: baby.highNeed ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: babies.id,
      set: {
        name: baby.name,
        birthDate: baby.birthDate,
        napGoal: napGoalDb,
        trackFeedingDuration: baby.trackFeedingDuration ? 1 : 0,
        easilyOverstimulated: baby.easilyOverstimulated ? 1 : 0,
        highNeed: baby.highNeed ? 1 : 0,
      },
    });
}

const DEFAULT_SETTINGS_ID = "default";

export async function getAppLocale(): Promise<AppLocale> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, DEFAULT_SETTINGS_ID))
    .limit(1);
  const locale = rows[0]?.locale;
  if (locale === "en" || locale === "de" || locale === "system") return locale;
  return "system";
}

export async function setAppLocale(locale: AppLocale): Promise<void> {
  const db = await getDb();
  await db
    .insert(appSettings)
    .values({ id: DEFAULT_SETTINGS_ID, locale })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { locale },
    });
}

export async function deleteBaby(id: string): Promise<void> {
  const db = await getDb();
  const babySleepIds = await db
    .select({ id: sleepEvents.id })
    .from(sleepEvents)
    .where(eq(sleepEvents.babyId, id));
  const sleepIds = babySleepIds.map((r) => r.id);
  if (sleepIds.length > 0) {
    await db
      .delete(sleepPauses)
      .where(inArray(sleepPauses.sleepEventId, sleepIds));
  }
  await db.delete(sleepEvents).where(eq(sleepEvents.babyId, id));
  await db.delete(feedingEvents).where(eq(feedingEvents.babyId, id));
  await db.delete(diaperEvents).where(eq(diaperEvents.babyId, id));
  await db.delete(bathEvents).where(eq(bathEvents.babyId, id));
  await db.delete(wakeEvents).where(eq(wakeEvents.babyId, id));
  await db.delete(babies).where(eq(babies.id, id));
}

// ─── SleepEvent CRUD ─────────────────────────────────────────────────────────

export async function getSleepEventsForBaby(
  babyId: string,
): Promise<SleepEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(sleepEvents)
    .where(eq(sleepEvents.babyId, babyId))
    .orderBy(desc(sleepEvents.startTime));
  return rows.map(toSleepEvent);
}

export async function getSleepEvent(id: string): Promise<SleepEvent | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(sleepEvents)
    .where(eq(sleepEvents.id, id))
    .limit(1);
  return rows[0] ? toSleepEvent(rows[0]) : null;
}

export async function insertSleepEvent(event: SleepEvent): Promise<void> {
  const db = await getDb();
  await db.insert(sleepEvents).values(event);
}

export async function updateSleepEvent(event: SleepEvent): Promise<void> {
  const db = await getDb();
  await db
    .update(sleepEvents)
    .set({
      type: event.type,
      startTime: event.startTime,
      endTime: event.endTime,
    })
    .where(eq(sleepEvents.id, event.id));
}

export async function deleteSleepEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(sleepPauses).where(eq(sleepPauses.sleepEventId, id));
  await db.delete(sleepEvents).where(eq(sleepEvents.id, id));
}

function isDuplicateEvent(
  candidate: Omit<SleepEvent, "id">,
  existing: SleepEvent,
): boolean {
  if (
    existing.babyId !== candidate.babyId ||
    existing.type !== candidate.type
  ) {
    return false;
  }
  const existingStart = new Date(existing.startTime).getTime();
  const candidateStart = new Date(candidate.startTime).getTime();
  return Math.abs(existingStart - candidateStart) <= DEDUP_TOLERANCE_MS;
}

export type BulkInsertSleepResult = BulkInsertResult & {
  inserted: SleepEvent[];
};

/** Bulk insert with dedup: same babyId + type + startTime within ~1 minute. */
export async function bulkInsertSleepEvents(
  events: Omit<SleepEvent, "id">[],
  babyId: string,
): Promise<BulkInsertSleepResult> {
  const db = await getDb();
  const existing = await getSleepEventsForBaby(babyId);

  let added = 0;
  let duplicatesSkipped = 0;
  const inserted: SleepEvent[] = [];

  for (const event of events) {
    if (existing.some((e) => isDuplicateEvent(event, e))) {
      duplicatesSkipped++;
      continue;
    }

    const id = newId();
    const row: SleepEvent = { id, ...event };
    await db.insert(sleepEvents).values(row);
    existing.push(row);
    inserted.push(row);
    added++;
  }

  return { added, duplicatesSkipped, inserted };
}

// ─── SleepPause CRUD ─────────────────────────────────────────────────────────

export async function getSleepPausesForBaby(
  babyId: string,
): Promise<SleepPause[]> {
  const db = await getDb();
  const babySleepIds = await db
    .select({ id: sleepEvents.id })
    .from(sleepEvents)
    .where(eq(sleepEvents.babyId, babyId));
  const sleepIds = babySleepIds.map((r) => r.id);
  if (sleepIds.length === 0) return [];

  const rows = await db
    .select()
    .from(sleepPauses)
    .where(inArray(sleepPauses.sleepEventId, sleepIds))
    .orderBy(asc(sleepPauses.startTime));
  return rows.map(toSleepPause);
}

export async function insertSleepPause(pause: SleepPause): Promise<void> {
  const db = await getDb();
  await db.insert(sleepPauses).values(pause);
}

export async function updateSleepPause(pause: SleepPause): Promise<void> {
  const db = await getDb();
  await db
    .update(sleepPauses)
    .set({
      startTime: pause.startTime,
      endTime: pause.endTime,
    })
    .where(eq(sleepPauses.id, pause.id));
}

export async function bulkInsertSleepPauses(
  pauses: Omit<SleepPause, "id">[],
): Promise<number> {
  const db = await getDb();
  let added = 0;
  for (const pause of pauses) {
    await db.insert(sleepPauses).values({ id: newId(), ...pause });
    added++;
  }
  return added;
}

// ─── FeedingEvent CRUD ───────────────────────────────────────────────────────

export async function getFeedingEventsForBaby(
  babyId: string,
): Promise<FeedingEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(feedingEvents)
    .where(eq(feedingEvents.babyId, babyId))
    .orderBy(desc(feedingEvents.startTime));
  return rows.map(toFeedingEvent);
}

export async function insertFeedingEvent(event: FeedingEvent): Promise<void> {
  const db = await getDb();
  await db.insert(feedingEvents).values(event);
}

export async function updateFeedingEvent(event: FeedingEvent): Promise<void> {
  const db = await getDb();
  await db
    .update(feedingEvents)
    .set({
      feedType: event.feedType,
      startTime: event.startTime,
      endTime: event.endTime,
      side: event.side,
      amount: event.amount,
      unit: event.unit,
      notes: event.notes,
    })
    .where(eq(feedingEvents.id, event.id));
}

export async function deleteFeedingEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(feedingEvents).where(eq(feedingEvents.id, id));
}

function isDuplicateFeeding(
  candidate: Omit<FeedingEvent, "id">,
  existing: FeedingEvent,
): boolean {
  if (
    existing.babyId !== candidate.babyId ||
    existing.feedType !== candidate.feedType
  ) {
    return false;
  }
  const existingStart = new Date(existing.startTime).getTime();
  const candidateStart = new Date(candidate.startTime).getTime();
  return Math.abs(existingStart - candidateStart) <= DEDUP_TOLERANCE_MS;
}

export async function bulkInsertFeedingEvents(
  events: Omit<FeedingEvent, "id">[],
  babyId: string,
): Promise<BulkInsertResult> {
  const db = await getDb();
  const existing = await getFeedingEventsForBaby(babyId);

  let added = 0;
  let duplicatesSkipped = 0;

  for (const event of events) {
    if (existing.some((e) => isDuplicateFeeding(event, e))) {
      duplicatesSkipped++;
      continue;
    }
    const id = newId();
    await db.insert(feedingEvents).values({ id, ...event });
    existing.push({ id, ...event });
    added++;
  }

  return { added, duplicatesSkipped };
}

// ─── DiaperEvent CRUD ────────────────────────────────────────────────────────

export async function getDiaperEventsForBaby(
  babyId: string,
): Promise<DiaperEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(diaperEvents)
    .where(eq(diaperEvents.babyId, babyId))
    .orderBy(desc(diaperEvents.time));
  return rows.map(toDiaperEvent);
}

export async function insertDiaperEvent(event: DiaperEvent): Promise<void> {
  const db = await getDb();
  await db.insert(diaperEvents).values(event);
}

export async function updateDiaperEvent(event: DiaperEvent): Promise<void> {
  const db = await getDb();
  await db
    .update(diaperEvents)
    .set({
      diaperType: event.diaperType,
      time: event.time,
      notes: event.notes,
    })
    .where(eq(diaperEvents.id, event.id));
}

export async function deleteDiaperEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(diaperEvents).where(eq(diaperEvents.id, id));
}

function isDuplicateDiaper(
  candidate: Omit<DiaperEvent, "id">,
  existing: DiaperEvent,
): boolean {
  if (
    existing.babyId !== candidate.babyId ||
    existing.diaperType !== candidate.diaperType
  ) {
    return false;
  }
  const existingTime = new Date(existing.time).getTime();
  const candidateTime = new Date(candidate.time).getTime();
  return Math.abs(existingTime - candidateTime) <= DEDUP_TOLERANCE_MS;
}

export async function bulkInsertDiaperEvents(
  events: Omit<DiaperEvent, "id">[],
  babyId: string,
): Promise<BulkInsertResult> {
  const db = await getDb();
  const existing = await getDiaperEventsForBaby(babyId);

  let added = 0;
  let duplicatesSkipped = 0;

  for (const event of events) {
    if (existing.some((e) => isDuplicateDiaper(event, e))) {
      duplicatesSkipped++;
      continue;
    }
    const id = newId();
    await db.insert(diaperEvents).values({ id, ...event });
    existing.push({ id, ...event });
    added++;
  }

  return { added, duplicatesSkipped };
}

// ─── BathEvent CRUD ──────────────────────────────────────────────────────────

export async function getBathEventsForBaby(
  babyId: string,
): Promise<BathEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(bathEvents)
    .where(eq(bathEvents.babyId, babyId))
    .orderBy(desc(bathEvents.time));
  return rows.map(toBathEvent);
}

export async function insertBathEvent(event: BathEvent): Promise<void> {
  const db = await getDb();
  await db.insert(bathEvents).values(event);
}

export async function updateBathEvent(event: BathEvent): Promise<void> {
  const db = await getDb();
  await db
    .update(bathEvents)
    .set({
      time: event.time,
      notes: event.notes,
    })
    .where(eq(bathEvents.id, event.id));
}

export async function deleteBathEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(bathEvents).where(eq(bathEvents.id, id));
}

function isDuplicateBath(
  candidate: Omit<BathEvent, "id">,
  existing: BathEvent,
): boolean {
  if (existing.babyId !== candidate.babyId) return false;
  const existingTime = new Date(existing.time).getTime();
  const candidateTime = new Date(candidate.time).getTime();
  return Math.abs(existingTime - candidateTime) <= DEDUP_TOLERANCE_MS;
}

export async function bulkInsertBathEvents(
  events: Omit<BathEvent, "id">[],
  babyId: string,
): Promise<BulkInsertResult> {
  const db = await getDb();
  const existing = await getBathEventsForBaby(babyId);

  let added = 0;
  let duplicatesSkipped = 0;

  for (const event of events) {
    if (existing.some((e) => isDuplicateBath(event, e))) {
      duplicatesSkipped++;
      continue;
    }
    const id = newId();
    await db.insert(bathEvents).values({ id, ...event });
    existing.push({ id, ...event });
    added++;
  }

  return { added, duplicatesSkipped };
}

// ─── WakeEvent CRUD ──────────────────────────────────────────────────────────

export async function getWakeEventsForBaby(
  babyId: string,
): Promise<WakeEvent[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(wakeEvents)
    .where(eq(wakeEvents.babyId, babyId))
    .orderBy(desc(wakeEvents.time));
  return rows.map(toWakeEvent);
}

export async function insertWakeEvent(event: WakeEvent): Promise<void> {
  const db = await getDb();
  await db.insert(wakeEvents).values(event);
}

export async function updateWakeEvent(event: WakeEvent): Promise<void> {
  const db = await getDb();
  await db
    .update(wakeEvents)
    .set({
      time: event.time,
      endTime: event.endTime,
      wakeType: event.wakeType,
      notes: event.notes,
    })
    .where(eq(wakeEvents.id, event.id));
}

export async function deleteWakeEvent(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(wakeEvents).where(eq(wakeEvents.id, id));
}

function isDuplicateWake(
  candidate: Omit<WakeEvent, "id">,
  existing: WakeEvent,
): boolean {
  if (existing.babyId !== candidate.babyId) return false;
  const existingTime = new Date(existing.time).getTime();
  const candidateTime = new Date(candidate.time).getTime();
  return Math.abs(existingTime - candidateTime) <= DEDUP_TOLERANCE_MS;
}

export async function bulkInsertWakeEvents(
  events: Omit<WakeEvent, "id">[],
  babyId: string,
): Promise<BulkInsertResult> {
  const db = await getDb();
  const existing = await getWakeEventsForBaby(babyId);

  let added = 0;
  let duplicatesSkipped = 0;

  for (const event of events) {
    if (existing.some((e) => isDuplicateWake(event, e))) {
      duplicatesSkipped++;
      continue;
    }
    const id = newId();
    await db.insert(wakeEvents).values({ id, ...event });
    existing.push({ id, ...event });
    added++;
  }

  return { added, duplicatesSkipped };
}

// ─── Daily chores ────────────────────────────────────────────────────────────

function toDailyChore(row: typeof dailyChores.$inferSelect): DailyChore {
  const recurrence: ChoreRecurrence =
    row.recurrence === "once" ? "once" : "daily";
  return {
    id: row.id,
    babyId: row.babyId,
    title: row.title,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    recurrence,
  };
}

async function getDailyChoreById(id: string): Promise<DailyChore | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(dailyChores)
    .where(eq(dailyChores.id, id))
    .limit(1);
  return rows[0] ? toDailyChore(rows[0]) : null;
}

function toDailyChoreCompletion(
  row: typeof dailyChoreCompletions.$inferSelect,
): DailyChoreCompletion {
  return {
    id: row.id,
    choreId: row.choreId,
    dateKey: row.dateKey,
    completedAt: row.completedAt,
  };
}

export async function getDailyChoresForBaby(
  babyId: string,
): Promise<DailyChore[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(dailyChores)
    .where(eq(dailyChores.babyId, babyId))
    .orderBy(asc(dailyChores.sortOrder), asc(dailyChores.createdAt));
  return rows.map(toDailyChore);
}

export async function getDailyChoreCompletionsForDate(
  babyId: string,
  dateKey: string,
): Promise<DailyChoreCompletion[]> {
  const db = await getDb();
  const chores = await getDailyChoresForBaby(babyId);
  if (chores.length === 0) return [];

  const choreIds = chores.map((c) => c.id);
  const rows = await db
    .select()
    .from(dailyChoreCompletions)
    .where(
      and(
        inArray(dailyChoreCompletions.choreId, choreIds),
        eq(dailyChoreCompletions.dateKey, dateKey),
      ),
    );
  return rows.map(toDailyChoreCompletion);
}

export async function insertDailyChore(
  chore: Omit<DailyChore, "id"> & { id?: string },
): Promise<DailyChore> {
  const db = await getDb();
  const row: DailyChore = {
    id: chore.id ?? newId(),
    babyId: chore.babyId,
    title: chore.title,
    sortOrder: chore.sortOrder,
    createdAt: chore.createdAt,
    recurrence: chore.recurrence ?? "daily",
  };
  await db.insert(dailyChores).values(row);
  return row;
}

export async function deleteDailyChore(id: string): Promise<void> {
  const db = await getDb();
  await db
    .delete(dailyChoreCompletions)
    .where(eq(dailyChoreCompletions.choreId, id));
  await db.delete(dailyChores).where(eq(dailyChores.id, id));
}

export async function setDailyChoreCompleted(
  choreId: string,
  dateKey: string,
  completed: boolean,
): Promise<void> {
  const chore = await getDailyChoreById(choreId);
  if (!chore) return;

  if (shouldRemoveChoreOnComplete(chore.recurrence, completed)) {
    await deleteDailyChore(choreId);
    return;
  }

  if (chore.recurrence === "once") {
    return;
  }

  const db = await getDb();
  if (!completed) {
    await db
      .delete(dailyChoreCompletions)
      .where(
        and(
          eq(dailyChoreCompletions.choreId, choreId),
          eq(dailyChoreCompletions.dateKey, dateKey),
        ),
      );
    return;
  }

  const existing = await db
    .select()
    .from(dailyChoreCompletions)
    .where(
      and(
        eq(dailyChoreCompletions.choreId, choreId),
        eq(dailyChoreCompletions.dateKey, dateKey),
      ),
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(dailyChoreCompletions).values({
    id: newId(),
    choreId,
    dateKey,
    completedAt: new Date().toISOString(),
  });
}
