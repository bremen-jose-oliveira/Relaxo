import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const babies = sqliteTable('babies', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  napGoal: integer('nap_goal').notNull().default(0), // 0 = auto, 2–4 = manual routine
});

export const sleepEvents = sqliteTable(
  'sleep_events',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    type: text('type', { enum: ['nap', 'night'] }).notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
  },
  (table) => [
    index('idx_sleep_events_baby').on(table.babyId),
    index('idx_sleep_events_start').on(table.startTime),
  ]
);

export const feedingEvents = sqliteTable(
  'feeding_events',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    feedType: text('feed_type', { enum: ['breast', 'bottle', 'solid'] }).notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    side: text('side', { enum: ['left', 'right', 'both'] }),
    amount: real('amount'),
    unit: text('unit', { enum: ['ml', 'oz', 'g'] }),
    notes: text('notes'),
  },
  (table) => [
    index('idx_feeding_events_baby').on(table.babyId),
    index('idx_feeding_events_start').on(table.startTime),
  ]
);

export const diaperEvents = sqliteTable(
  'diaper_events',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    diaperType: text('diaper_type', { enum: ['wet', 'dirty', 'mixed'] }).notNull(),
    time: text('time').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('idx_diaper_events_baby').on(table.babyId),
    index('idx_diaper_events_time').on(table.time),
  ]
);

export const wakeEvents = sqliteTable(
  'wake_events',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    time: text('time').notNull(),
    endTime: text('end_time'),
    wakeType: text('wake_type', { enum: ['morning', 'night'] })
      .notNull()
      .default('morning'),
    notes: text('notes'),
  },
  (table) => [
    index('idx_wake_events_baby').on(table.babyId),
    index('idx_wake_events_time').on(table.time),
  ]
);

export const sleepPauses = sqliteTable(
  'sleep_pauses',
  {
    id: text('id').primaryKey().notNull(),
    sleepEventId: text('sleep_event_id')
      .notNull()
      .references(() => sleepEvents.id),
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
  },
  (table) => [index('idx_sleep_pauses_event').on(table.sleepEventId)]
);

export type BabyRow = typeof babies.$inferSelect;
export type SleepEventRow = typeof sleepEvents.$inferSelect;
export type FeedingEventRow = typeof feedingEvents.$inferSelect;
export type DiaperEventRow = typeof diaperEvents.$inferSelect;
export type WakeEventRow = typeof wakeEvents.$inferSelect;
export type SleepPauseRow = typeof sleepPauses.$inferSelect;

export type BabyInsert = typeof babies.$inferInsert;
export type SleepEventInsert = typeof sleepEvents.$inferInsert;
export type FeedingEventInsert = typeof feedingEvents.$inferInsert;
export type DiaperEventInsert = typeof diaperEvents.$inferInsert;
export type WakeEventInsert = typeof wakeEvents.$inferInsert;
export type SleepPauseInsert = typeof sleepPauses.$inferInsert;
