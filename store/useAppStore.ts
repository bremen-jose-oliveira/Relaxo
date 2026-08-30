import { create } from 'zustand';
import { newId } from '@/lib/newId';
import type { Baby, BathEvent, ChoreRecurrence, DailyChore, DayContextTag, DayContextTagEvent, DiaperEvent, FeedingEvent, NapExtension, SleepEvent, SleepOnsetMethod, SleepPause, SleepPlace, SleepSettleAid, SleepSettleQuality, SleepWakeManner, SleepWakeMood, WakeEvent, AppLocale } from '@/types';
import { deriveOnsetMethodFromSettle } from '@/lib/sleepSettle';
import {
  bulkInsertBathEvents,
  bulkInsertDiaperEvents,
  bulkInsertFeedingEvents,
  bulkInsertSleepEvents,
  bulkInsertSleepPauses,
  bulkInsertWakeEvents,
  deleteBathEvent,
  deleteDailyChore,
  deleteDiaperEvent,
  deleteFeedingEvent,
  deleteSleepEvent,
  deleteWakeEvent,
  getAllBabies,
  getBathEventsForBaby,
  getDailyChoreCompletionsForDate,
  getDailyChoresForBaby,
  getDayContextTagsForBaby,
  getDiaperEventsForBaby,
  getFeedingEventsForBaby,
  getSleepEventsForBaby,
  getSleepPausesForBaby,
  getWakeEventsForBaby,
  getAppLocale,
  setAppLocale,
  getActiveBabyId,
  setActiveBabyId,
  getOnboardingCompleted,
  setOnboardingCompleted,
  deleteBaby,
  insertBathEvent,
  insertDailyChore,
  insertDiaperEvent,
  insertFeedingEvent,
  insertSleepEvent,
  insertSleepPause,
  insertWakeEvent,
  setDailyChoreCompleted,
  toggleDayContextTag,
  updateBathEvent,
  updateDiaperEvent,
  updateFeedingEvent,
  updateSleepEvent,
  updateSleepPause,
  updateWakeEvent,
  upsertBaby,
} from '@/db/database';
import {
  isCurrentlyAsleep,
  predictNextSleep,
  type PredictResult,
} from '@/lib/predictNextSleep';
import { getMorningWakeForDay } from '@/lib/dayAnchor';
import { getImportableEvents, getPreviewBabyId, inferBirthDateFromImport, type ImportPreview } from '@/lib/importNapper';
import { isOngoingFeeding } from '@/lib/feedingUtils';
import { getOngoingPause, isSleepPaused } from '@/lib/sleepPauses';
import { formatDateKey } from '@/lib/dateUtils';
import {
  cancelSleepReminder,
  scheduleSleepReminder,
  setupNotificationChannel,
} from '@/lib/notifications';
import {
  DEFAULT_TASK_REMINDER_MINUTES,
  cancelAllTaskNotifications,
  snoozeTaskReminder,
  snoozeTaskUntilTonight,
  syncTaskReminders,
} from '@/lib/taskReminders';
import { flushHouseholdAutoSyncNow, scheduleHouseholdAutoSync } from '@/lib/autoSync';
import { syncSleepHomeWidget } from '@/lib/sleepHomeWidget';
import { syncSleepLiveActivity } from '@/lib/sleepLiveActivity';

/** Queue a background cloud sync when in a household (no-op otherwise). */
function queueCloudSync() {
  scheduleHouseholdAutoSync();
}

/** Sleep start/end/pause: push immediately so the partner phone updates right away. */
async function flushCloudSync() {
  await flushHouseholdAutoSyncNow();
}

function syncSleepSurfacesFromStore(state: {
  events: SleepEvent[];
  sleepPauses: SleepPause[];
  wakes: WakeEvent[];
  prediction: PredictResult | null;
  locale: AppLocale;
  babies: Baby[];
  activeBabyId: string | null;
}) {
  const ongoing = isCurrentlyAsleep(state.events);
  const baby = state.babies.find((b) => b.id === state.activeBabyId) ?? null;

  syncSleepHomeWidget({
    ongoing,
    pauses: state.sleepPauses,
    events: state.events,
    wakes: state.wakes,
    prediction: state.prediction,
    baby,
    locale: state.locale,
    babyName: baby?.name ?? null,
  });

  if (!ongoing) {
    syncSleepLiveActivity(null);
    return;
  }
  syncSleepLiveActivity({
    ongoing,
    pauses: state.sleepPauses,
    locale: state.locale,
  });
}

type AppState = {
  babies: Baby[];
  activeBabyId: string | null;
  events: SleepEvent[];
  sleepPauses: SleepPause[];
  feedings: FeedingEvent[];
  diapers: DiaperEvent[];
  baths: BathEvent[];
  wakes: WakeEvent[];
  dayContextTags: DayContextTagEvent[];
  dailyChores: DailyChore[];
  completedChoreIdsToday: string[];
  prediction: PredictResult | null;
  isLoading: boolean;
  isInitialized: boolean;
  locale: AppLocale;
  onboardingCompleted: boolean;

  initialize: () => Promise<void>;
  setOnboardingCompleted: (done: boolean) => Promise<void>;
  wipeLocalData: () => Promise<void>;
  setActiveBaby: (id: string) => Promise<void>;
  saveBaby: (baby: Omit<Baby, 'id'> & { id?: string; napGoal?: Baby['napGoal']; trackFeedingDuration?: boolean }) => Promise<Baby>;
  removeBaby: (id: string) => Promise<{ ok: boolean; error?: string }>;
  setLocale: (locale: AppLocale) => Promise<void>;
  refreshEvents: () => Promise<void>;
  startSleep: (type: 'nap' | 'night') => Promise<void>;
  endSleep: () => Promise<SleepEvent | null>;
  setSleepExtension: (eventId: string, extension: NapExtension) => Promise<void>;
  setSleepContext: (
    eventId: string,
    context: {
      onsetMethod?: SleepOnsetMethod | null;
      settleMinutes?: number | null;
      settleQuality?: SleepSettleQuality | null;
      settleAid?: SleepSettleAid | null;
      sleepPlace?: SleepPlace | null;
      wakeManner?: SleepWakeManner | null;
      wakeMood?: SleepWakeMood | null;
    }
  ) => Promise<void>;
  pauseSleep: () => Promise<void>;
  resumeSleep: () => Promise<void>;
  addSleepEvent: (event: Omit<SleepEvent, 'id'>) => Promise<SleepEvent>;
  editSleepEvent: (event: SleepEvent) => Promise<void>;
  removeSleepEvent: (id: string) => Promise<void>;
  toggleDayTag: (dateKey: string, tag: DayContextTag) => Promise<void>;
  startBreastFeed: (side: FeedingEvent['side']) => Promise<void>;
  endBreastFeed: () => Promise<void>;
  addFeeding: (event: Omit<FeedingEvent, 'id'>) => Promise<FeedingEvent>;
  editFeeding: (event: FeedingEvent) => Promise<void>;
  removeFeeding: (id: string) => Promise<void>;
  addDiaper: (event: Omit<DiaperEvent, 'id'>) => Promise<DiaperEvent>;
  editDiaper: (event: DiaperEvent) => Promise<void>;
  removeDiaper: (id: string) => Promise<void>;
  addBath: (event: Omit<BathEvent, 'id'>) => Promise<BathEvent>;
  editBath: (event: BathEvent) => Promise<void>;
  removeBath: (id: string) => Promise<void>;
  addWake: (event: Omit<WakeEvent, 'id'>) => Promise<WakeEvent>;
  editWake: (event: WakeEvent) => Promise<void>;
  removeWake: (id: string) => Promise<void>;
  refreshChores: () => Promise<void>;
  addDailyChore: (
    title: string,
    recurrence?: ChoreRecurrence,
    reminderMinutes?: number | null
  ) => Promise<void>;
  toggleDailyChore: (choreId: string, completed: boolean) => Promise<void>;
  removeDailyChore: (id: string) => Promise<void>;
  snoozeDailyChore: (choreId: string, minutes: number) => Promise<void>;
  snoozeDailyChoreTonight: (choreId: string) => Promise<void>;
  recomputePrediction: () => Promise<void>;
  importCareEvents: (
    preview: ImportPreview,
    options?: { babyName?: string }
  ) => Promise<{
    sleepAdded: number;
    feedingAdded: number;
    diaperAdded: number;
    bathAdded: number;
    wakeAdded: number;
    duplicatesSkipped: number;
    failedSkipped: number;
    createdBaby: boolean;
  }>;
};

export const useAppStore = create<AppState>((set, get) => ({
  babies: [],
  activeBabyId: null,
  events: [],
  sleepPauses: [],
  feedings: [],
  diapers: [],
  baths: [],
  wakes: [],
  dayContextTags: [],
  dailyChores: [],
  completedChoreIdsToday: [],
  prediction: null,
  isLoading: true,
  isInitialized: false,
  locale: 'system',
  onboardingCompleted: false,

  initialize: async () => {
    await setupNotificationChannel();
    const [babies, locale, savedActiveId, onboardingCompleted] = await Promise.all([
      getAllBabies(),
      getAppLocale(),
      getActiveBabyId(),
      getOnboardingCompleted(),
    ]);
    const activeBabyId =
      (savedActiveId && babies.some((b) => b.id === savedActiveId)
        ? savedActiveId
        : null) ??
      babies[0]?.id ??
      null;
    set({
      babies,
      locale,
      activeBabyId,
      onboardingCompleted,
      isLoading: false,
      isInitialized: true,
    });
    if (activeBabyId) {
      await setActiveBabyId(activeBabyId);
      await get().setActiveBaby(activeBabyId);
    } else {
      await setActiveBabyId(null);
    }
  },

  setOnboardingCompleted: async (done) => {
    await setOnboardingCompleted(done);
    set({ onboardingCompleted: done });
  },

  wipeLocalData: async () => {
    const chores = get().dailyChores;
    for (const chore of chores) {
      await cancelAllTaskNotifications(chore.id);
    }
    await cancelSleepReminder();
    const { wipeLocalDataOnly } = await import('@/lib/deleteAccount');
    await wipeLocalDataOnly();
    set({
      babies: [],
      activeBabyId: null,
      events: [],
      sleepPauses: [],
      feedings: [],
      diapers: [],
      baths: [],
      wakes: [],
      dayContextTags: [],
      dailyChores: [],
      completedChoreIdsToday: [],
      prediction: null,
      onboardingCompleted: true,
    });
    syncSleepLiveActivity(null);
    try {
      const { publishWidgetBridge } = await import('@/lib/widgetBridge');
      await publishWidgetBridge();
    } catch {
      // ignore
    }
  },

  setActiveBaby: async (id: string) => {
    await setActiveBabyId(id);
    set({ activeBabyId: id, isLoading: true });
    const [events, sleepPauses, feedings, diapers, baths, wakes] = await Promise.all([
      getSleepEventsForBaby(id),
      getSleepPausesForBaby(id),
      getFeedingEventsForBaby(id),
      getDiaperEventsForBaby(id),
      getBathEventsForBaby(id),
      getWakeEventsForBaby(id),
    ]);
    set({ events, sleepPauses, feedings, diapers, baths, wakes, isLoading: false });
    await Promise.all([get().recomputePrediction(), get().refreshChores()]);
    syncSleepSurfacesFromStore(get());
    try {
      const { publishWidgetBridge } = await import('@/lib/widgetBridge');
      await publishWidgetBridge();
    } catch {
      // ignore on Android / tests
    }
  },

  saveBaby: async (input) => {
    const baby: Baby = {
      id: input.id ?? newId(),
      name: input.name,
      birthDate: input.birthDate,
      napGoal: input.napGoal ?? null,
      trackFeedingDuration: input.trackFeedingDuration ?? false,
      easilyOverstimulated: input.easilyOverstimulated ?? false,
      highNeed: input.highNeed ?? false,
    };
    await upsertBaby(baby);
    const babies = await getAllBabies();
    const shouldActivate =
      !get().activeBabyId || get().activeBabyId === baby.id || !input.id;
    set({
      babies,
      activeBabyId: shouldActivate ? baby.id : get().activeBabyId,
    });
    if (shouldActivate) {
      await get().setActiveBaby(baby.id);
    }
    queueCloudSync();
    return baby;
  },

  removeBaby: async (id: string) => {
    const { softDeleteBabyRemote } = await import('@/lib/sync');
    const remote = await softDeleteBabyRemote(id);
    if (!remote.ok && remote.error && remote.error !== 'no_household') {
      return { ok: false, error: remote.error };
    }
    await deleteBaby(id);
    const babies = await getAllBabies();
    const nextId = babies[0]?.id ?? null;
    set({
      babies,
      activeBabyId: nextId,
      events: [],
      sleepPauses: [],
      feedings: [],
      diapers: [],
      baths: [],
      wakes: [],
      dayContextTags: [],
      dailyChores: [],
      completedChoreIdsToday: [],
      prediction: null,
    });
    syncSleepSurfacesFromStore(get());
    await setActiveBabyId(nextId);
    if (nextId) {
      await get().setActiveBaby(nextId);
    }
    queueCloudSync();
    return { ok: true };
  },

  setLocale: async (locale) => {
    await setAppLocale(locale);
    set({ locale });
    syncSleepSurfacesFromStore(get());
  },

  refreshEvents: async () => {
    const { activeBabyId } = get();
    if (!activeBabyId) return;
    const [events, sleepPauses, feedings, diapers, baths, wakes, dayContextTags] = await Promise.all([
      getSleepEventsForBaby(activeBabyId),
      getSleepPausesForBaby(activeBabyId),
      getFeedingEventsForBaby(activeBabyId),
      getDiaperEventsForBaby(activeBabyId),
      getBathEventsForBaby(activeBabyId),
      getWakeEventsForBaby(activeBabyId),
      getDayContextTagsForBaby(activeBabyId),
    ]);
    set({ events, sleepPauses, feedings, diapers, baths, wakes, dayContextTags });
    await get().recomputePrediction();
    syncSleepSurfacesFromStore(get());
  },

  startSleep: async (type) => {
    const { activeBabyId, events } = get();
    if (!activeBabyId || isCurrentlyAsleep(events)) return;
    const event: SleepEvent = {
      id: newId(),
      babyId: activeBabyId,
      type,
      startTime: new Date().toISOString(),
      endTime: null,
      extension: null,
      onsetMethod: null,
      settleMinutes: null,
      settleQuality: null,
      settleAid: null,
      sleepPlace: null,
      wakeManner: null,
      wakeMood: null,
    };
    await insertSleepEvent(event);
    await get().refreshEvents();
    await flushCloudSync();
  },

  endSleep: async () => {
    const { activeBabyId, events } = get();
    const ongoing = isCurrentlyAsleep(events);
    if (!ongoing || !activeBabyId) return null;
    const openPause = getOngoingPause(get().sleepPauses, ongoing.id);
    if (openPause) {
      await updateSleepPause({ ...openPause, endTime: new Date().toISOString() });
    }
    const endTime = new Date().toISOString();
    const ended: SleepEvent = { ...ongoing, endTime };
    await updateSleepEvent(ended);
    await get().refreshEvents();
    await flushCloudSync();
    return ended;
  },

  setSleepExtension: async (eventId, extension) => {
    const event = get().events.find((e) => e.id === eventId);
    if (!event) return;
    await updateSleepEvent({ ...event, extension });
    await get().refreshEvents();
    await flushCloudSync();
  },

  setSleepContext: async (eventId, context) => {
    const event = get().events.find((e) => e.id === eventId);
    if (!event) return;
    const settleMinutes =
      context.settleMinutes !== undefined
        ? context.settleMinutes
        : event.settleMinutes ?? null;
    const settleQuality =
      context.settleQuality !== undefined
        ? context.settleQuality
        : event.settleQuality ?? null;
    const settleAid =
      context.settleAid !== undefined ? context.settleAid : event.settleAid ?? null;
    const sleepPlace =
      context.sleepPlace !== undefined ? context.sleepPlace : event.sleepPlace ?? null;
    const onsetMethod =
      context.onsetMethod !== undefined
        ? context.onsetMethod
        : deriveOnsetMethodFromSettle({
            settleAid,
            sleepPlace,
            onsetMethod: event.onsetMethod ?? null,
          });
    await updateSleepEvent({
      ...event,
      onsetMethod,
      settleMinutes,
      settleQuality,
      settleAid,
      sleepPlace,
      wakeManner:
        context.wakeManner !== undefined ? context.wakeManner : event.wakeManner ?? null,
      wakeMood: context.wakeMood !== undefined ? context.wakeMood : event.wakeMood ?? null,
    });
    await get().refreshEvents();
    await flushCloudSync();
  },

  pauseSleep: async () => {
    const ongoing = isCurrentlyAsleep(get().events);
    if (!ongoing || isSleepPaused(ongoing, get().sleepPauses)) return;
    const pause: SleepPause = {
      id: newId(),
      sleepEventId: ongoing.id,
      startTime: new Date().toISOString(),
      endTime: null,
    };
    await insertSleepPause(pause);
    await get().refreshEvents();
    await flushCloudSync();
  },

  resumeSleep: async () => {
    const ongoing = isCurrentlyAsleep(get().events);
    const openPause = getOngoingPause(get().sleepPauses, ongoing?.id);
    if (!ongoing || !openPause) return;
    await updateSleepPause({ ...openPause, endTime: new Date().toISOString() });
    await get().refreshEvents();
    await flushCloudSync();
  },

  addSleepEvent: async (input) => {
    const event: SleepEvent = { ...input, id: newId() };
    await insertSleepEvent(event);
    await get().refreshEvents();
    queueCloudSync();
    return event;
  },

  editSleepEvent: async (event) => {
    const previous = get().events.find((e) => e.id === event.id);
    await updateSleepEvent(event);
    await get().refreshEvents();
    // Reopening ("still asleep") must push before the next pull, or the cloud
    // endTime wins and the edit looks like it did nothing.
    if (previous?.endTime && !event.endTime) {
      await flushCloudSync();
    } else {
      queueCloudSync();
    }
  },

  removeSleepEvent: async (id) => {
    const { softDeleteSleepEventRemote } = await import('@/lib/sync');
    await softDeleteSleepEventRemote(id);
    await deleteSleepEvent(id);
    await get().refreshEvents();
    queueCloudSync();
  },

  toggleDayTag: async (dateKey, tag) => {
    const { activeBabyId, dayContextTags } = get();
    if (!activeBabyId) return;
    const existing = dayContextTags.find(
      (row) => row.dateKey === dateKey && row.tag === tag
    );
    if (existing) {
      const { queueRemoteDelete } = await import('@/lib/sync');
      await queueRemoteDelete('day_context_tags', [existing.id]);
    }
    await toggleDayContextTag(activeBabyId, dateKey, tag);
    const nextTags = await getDayContextTagsForBaby(activeBabyId);
    set({ dayContextTags: nextTags });
    queueCloudSync();
  },

  startBreastFeed: async (side) => {
    const { activeBabyId, feedings } = get();
    if (!activeBabyId || isOngoingFeeding(feedings)) return;
    const event: FeedingEvent = {
      id: newId(),
      babyId: activeBabyId,
      feedType: 'breast',
      startTime: new Date().toISOString(),
      endTime: null,
      side,
      amount: null,
      unit: null,
      notes: null,
    };
    await insertFeedingEvent(event);
    await get().refreshEvents();
    queueCloudSync();
  },

  endBreastFeed: async () => {
    const ongoing = isOngoingFeeding(get().feedings);
    if (!ongoing) return;
    await updateFeedingEvent({ ...ongoing, endTime: new Date().toISOString() });
    await get().refreshEvents();
    await flushCloudSync();
  },

  addFeeding: async (input) => {
    const event: FeedingEvent = { ...input, id: newId() };
    await insertFeedingEvent(event);
    await get().refreshEvents();
    queueCloudSync();
    return event;
  },

  editFeeding: async (event) => {
    await updateFeedingEvent(event);
    await get().refreshEvents();
    queueCloudSync();
  },

  removeFeeding: async (id) => {
    const { queueRemoteDelete } = await import('@/lib/sync');
    await queueRemoteDelete('feeding_events', [id]);
    await deleteFeedingEvent(id);
    await get().refreshEvents();
    queueCloudSync();
  },

  addDiaper: async (input) => {
    const event: DiaperEvent = { ...input, id: newId() };
    await insertDiaperEvent(event);
    await get().refreshEvents();
    queueCloudSync();
    return event;
  },

  editDiaper: async (event) => {
    await updateDiaperEvent(event);
    await get().refreshEvents();
    queueCloudSync();
  },

  removeDiaper: async (id) => {
    const { queueRemoteDelete } = await import('@/lib/sync');
    await queueRemoteDelete('diaper_events', [id]);
    await deleteDiaperEvent(id);
    await get().refreshEvents();
    queueCloudSync();
  },

  addBath: async (input) => {
    const event: BathEvent = { ...input, id: newId() };
    await insertBathEvent(event);
    await get().refreshEvents();
    queueCloudSync();
    return event;
  },

  editBath: async (event) => {
    await updateBathEvent(event);
    await get().refreshEvents();
    queueCloudSync();
  },

  removeBath: async (id) => {
    const { queueRemoteDelete } = await import('@/lib/sync');
    await queueRemoteDelete('bath_events', [id]);
    await deleteBathEvent(id);
    await get().refreshEvents();
    queueCloudSync();
  },

  addWake: async (input) => {
    const event: WakeEvent = { ...input, id: newId() };
    await insertWakeEvent(event);
    await get().refreshEvents();
    queueCloudSync();
    return event;
  },

  editWake: async (event) => {
    await updateWakeEvent(event);
    await get().refreshEvents();
    queueCloudSync();
  },

  removeWake: async (id) => {
    const { queueRemoteDelete } = await import('@/lib/sync');
    await queueRemoteDelete('wake_events', [id]);
    await deleteWakeEvent(id);
    await get().refreshEvents();
    queueCloudSync();
  },

  refreshChores: async () => {
    const { activeBabyId, babies } = get();
    if (!activeBabyId) {
      set({ dailyChores: [], completedChoreIdsToday: [] });
      return;
    }
    const dateKey = formatDateKey(new Date());
    const [dailyChores, completions] = await Promise.all([
      getDailyChoresForBaby(activeBabyId),
      getDailyChoreCompletionsForDate(activeBabyId, dateKey),
    ]);
    const completedChoreIdsToday = completions.map((c) => c.choreId);
    set({
      dailyChores,
      completedChoreIdsToday,
    });
    const baby = babies.find((b) => b.id === activeBabyId);
    await syncTaskReminders(
      dailyChores,
      completedChoreIdsToday,
      baby?.name ?? ''
    );
  },

  addDailyChore: async (title, recurrence = 'daily', reminderMinutes) => {
    const { activeBabyId, dailyChores } = get();
    if (!activeBabyId || !title.trim()) return;
    const resolvedReminder =
      reminderMinutes === undefined
        ? DEFAULT_TASK_REMINDER_MINUTES
        : reminderMinutes;
    await insertDailyChore({
      babyId: activeBabyId,
      title: title.trim(),
      sortOrder: dailyChores.length,
      createdAt: new Date().toISOString(),
      recurrence,
      reminderMinutes: resolvedReminder,
    });
    await get().refreshChores();
    queueCloudSync();
  },

  toggleDailyChore: async (choreId, completed) => {
    const dateKey = formatDateKey(new Date());
    const result = await setDailyChoreCompleted(choreId, dateKey, completed);
    const { queueRemoteDelete } = await import('@/lib/sync');
    if (result.removedChoreId) {
      await queueRemoteDelete('daily_chores', [result.removedChoreId]);
    }
    if (result.removedCompletionId) {
      await queueRemoteDelete('daily_chore_completions', [result.removedCompletionId]);
    }
    await get().refreshChores();
    queueCloudSync();
  },

  removeDailyChore: async (id) => {
    const { queueRemoteDelete } = await import('@/lib/sync');
    await queueRemoteDelete('daily_chores', [id]);
    await cancelAllTaskNotifications(id);
    await deleteDailyChore(id);
    await get().refreshChores();
    queueCloudSync();
  },

  snoozeDailyChore: async (choreId, minutes) => {
    const { dailyChores, babies, activeBabyId } = get();
    const chore = dailyChores.find((c) => c.id === choreId);
    if (!chore) return;
    const baby = babies.find((b) => b.id === activeBabyId);
    await snoozeTaskReminder(chore, baby?.name ?? '', minutes);
  },

  snoozeDailyChoreTonight: async (choreId) => {
    const { dailyChores, babies, activeBabyId } = get();
    const chore = dailyChores.find((c) => c.id === choreId);
    if (!chore) return;
    const baby = babies.find((b) => b.id === activeBabyId);
    await snoozeTaskUntilTonight(chore, baby?.name ?? '');
  },

  recomputePrediction: async () => {
    const { babies, activeBabyId, events, wakes } = get();
    const baby = babies.find((b) => b.id === activeBabyId);
    if (!baby) {
      set({ prediction: null });
      await cancelSleepReminder();
      syncSleepSurfacesFromStore(get());
      return;
    }
    if (isCurrentlyAsleep(events)) {
      set({ prediction: null });
      await cancelSleepReminder();
      syncSleepSurfacesFromStore(get());
      return;
    }
    const prediction = predictNextSleep(events, wakes, baby, new Date());
    set({ prediction });
    await scheduleSleepReminder(
      prediction.predictedTime,
      prediction.slotLabel,
      baby.name
    );
    syncSleepSurfacesFromStore(get());
  },

  importCareEvents: async (preview, options) => {
    let { activeBabyId } = get();
    let createdBaby = false;

    if (!activeBabyId) {
      const previewBabyId = getPreviewBabyId(preview) ?? newId();
      const fromCsv = preview.babyProfile ?? { name: null, birthDate: null };
      const birthDate =
        fromCsv.birthDate ??
        inferBirthDateFromImport(preview) ??
        formatDateKey(new Date());
      const babyName =
        fromCsv.name?.trim() || options?.babyName?.trim() || 'Baby';
      const baby = await get().saveBaby({
        id: previewBabyId,
        name: babyName,
        birthDate,
        napGoal: null,
        trackFeedingDuration: false,
        easilyOverstimulated: false,
        highNeed: false,
      });
      activeBabyId = baby.id;
      createdBaby = true;
    }

    const { sleep, feedings, diapers, baths, wakes, sleepPauses } =
      getImportableEvents(preview);
    const sleepResult = await bulkInsertSleepEvents(sleep, activeBabyId);
    const [feedingResult, diaperResult, bathResult, wakeResult] = await Promise.all([
      bulkInsertFeedingEvents(feedings, activeBabyId),
      bulkInsertDiaperEvents(diapers, activeBabyId),
      bulkInsertBathEvents(baths, activeBabyId),
      bulkInsertWakeEvents(wakes, activeBabyId),
    ]);

    if (sleepPauses.length > 0 && sleepResult.inserted.length > 0) {
      const pausesToInsert: Omit<SleepPause, 'id'>[] = [];
      for (const item of sleepPauses) {
        const match = sleepResult.inserted.find(
          (e) =>
            e.babyId === activeBabyId &&
            Math.abs(
              new Date(e.startTime).getTime() - new Date(item.sleepStartTime).getTime()
            ) <= 60 * 1000
        );
        if (!match) continue;
        for (const p of item.pauses) {
          pausesToInsert.push({
            sleepEventId: match.id,
            startTime: p.startTime,
            endTime: p.endTime,
          });
        }
      }
      if (pausesToInsert.length > 0) {
        await bulkInsertSleepPauses(pausesToInsert);
      }
    }

    await get().refreshEvents();
    queueCloudSync();

    return {
      sleepAdded: sleepResult.added,
      feedingAdded: feedingResult.added,
      diaperAdded: diaperResult.added,
      bathAdded: bathResult.added,
      wakeAdded: wakeResult.added,
      duplicatesSkipped:
        sleepResult.duplicatesSkipped +
        feedingResult.duplicatesSkipped +
        diaperResult.duplicatesSkipped +
        bathResult.duplicatesSkipped +
        wakeResult.duplicatesSkipped,
      failedSkipped: preview.skippedFailed + preview.skippedOpenOld + preview.skippedUnrecognized,
      createdBaby,
    };
  },
}));

export function useActiveBaby(): Baby | null {
  const babies = useAppStore((s) => s.babies);
  const activeBabyId = useAppStore((s) => s.activeBabyId);
  return babies.find((b) => b.id === activeBabyId) ?? null;
}

export function useOngoingSleep(): SleepEvent | null {
  return isCurrentlyAsleep(useAppStore((s) => s.events));
}

export function useIsSleepPaused(): boolean {
  const ongoing = useOngoingSleep();
  const pauses = useAppStore((s) => s.sleepPauses);
  return isSleepPaused(ongoing, pauses);
}

export function useMorningWakeToday(): WakeEvent | null {
  const wakes = useAppStore((s) => s.wakes);
  return getMorningWakeForDay(wakes, new Date());
}

export function useOngoingFeeding(): FeedingEvent | null {
  return isOngoingFeeding(useAppStore((s) => s.feedings));
}
