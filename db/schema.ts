import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const babies = sqliteTable('babies', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  napGoal: integer('nap_goal').notNull().default(0), // 0 = auto, 2–4 = manual routine
  /** 0 = log feed time only (instant); 1 = track start/end duration */
  trackFeedingDuration: integer('track_feeding_duration').notNull().default(0),
  /** 0/1 — used for personalized tips */
  easilyOverstimulated: integer('easily_overstimulated').notNull().default(0),
  highNeed: integer('high_need').notNull().default(0),
});

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey().notNull(),
  locale: text('locale', { enum: ['system', 'en', 'de'] })
    .notNull()
    .default('system'),
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

export const bathEvents = sqliteTable(
  'bath_events',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    time: text('time').notNull(),
    notes: text('notes'),
  },
  (table) => [
    index('idx_bath_events_baby').on(table.babyId),
    index('idx_bath_events_time').on(table.time),
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

export const dailyChores = sqliteTable(
  'daily_chores',
  {
    id: text('id').primaryKey().notNull(),
    babyId: text('baby_id')
      .notNull()
      .references(() => babies.id),
    title: text('title').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    recurrence: text('recurrence', { enum: ['daily', 'once'] })
      .notNull()
      .default('daily'),
  },
  (table) => [index('idx_daily_chores_baby').on(table.babyId)]
);

export const dailyChoreCompletions = sqliteTable(
  'daily_chore_completions',
  {
    id: text('id').primaryKey().notNull(),
    choreId: text('chore_id')
      .notNull()
      .references(() => dailyChores.id),
    dateKey: text('date_key').notNull(),
    completedAt: text('completed_at').notNull(),
  },
  (table) => [
    index('idx_chore_completions_chore').on(table.choreId),
    index('idx_chore_completions_date').on(table.dateKey),
  ]
);

export type BabyRow = typeof babies.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type SleepEventRow = typeof sleepEvents.$inferSelect;
export type FeedingEventRow = typeof feedingEvents.$inferSelect;
export type DiaperEventRow = typeof diaperEvents.$inferSelect;
export type BathEventRow = typeof bathEvents.$inferSelect;
export type WakeEventRow = typeof wakeEvents.$inferSelect;
export type SleepPauseRow = typeof sleepPauses.$inferSelect;

export type BabyInsert = typeof babies.$inferInsert;
export type SleepEventInsert = typeof sleepEvents.$inferInsert;
export type FeedingEventInsert = typeof feedingEvents.$inferInsert;
export type DiaperEventInsert = typeof diaperEvents.$inferInsert;
export type BathEventInsert = typeof bathEvents.$inferInsert;
export type WakeEventInsert = typeof wakeEvents.$inferInsert;
export type SleepPauseInsert = typeof sleepPauses.$inferInsert;
export type DailyChoreRow = typeof dailyChores.$inferSelect;
export type DailyChoreInsert = typeof dailyChores.$inferInsert;
export type DailyChoreCompletionRow = typeof dailyChoreCompletions.$inferSelect;
export type DailyChoreCompletionInsert = typeof dailyChoreCompletions.$inferInsert;
