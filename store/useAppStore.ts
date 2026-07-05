import { create } from 'zustand';
import { newId } from '@/lib/newId';
import type { Baby, BathEvent, ChoreRecurrence, DailyChore, DiaperEvent, FeedingEvent, SleepEvent, SleepPause, WakeEvent, AppLocale } from '@/types';
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
  getDiaperEventsForBaby,
  getFeedingEventsForBaby,
  getSleepEventsForBaby,
  getSleepPausesForBaby,
  getWakeEventsForBaby,
  getAppLocale,
  setAppLocale,
  insertBathEvent,
  insertDailyChore,
  insertDiaperEvent,
  insertFeedingEvent,
  insertSleepEvent,
  insertSleepPause,
  insertWakeEvent,
  setDailyChoreCompleted,
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
import { getImportableEvents, type ImportPreview } from '@/lib/importNapper';
import { isOngoingFeeding } from '@/lib/feedingUtils';
import { getOngoingPause, isSleepPaused } from '@/lib/sleepPauses';
import { formatDateKey } from '@/lib/dateUtils';
import {
  cancelSleepReminder,
  scheduleSleepReminder,
  setupNotificationChannel,
} from '@/lib/notifications';

type AppState = {
  babies: Baby[];
  activeBabyId: string | null;
  events: SleepEvent[];
  sleepPauses: SleepPause[];
  feedings: FeedingEvent[];
  diapers: DiaperEvent[];
  baths: BathEvent[];
  wakes: WakeEvent[];
  dailyChores: DailyChore[];
  completedChoreIdsToday: string[];
  prediction: PredictResult | null;
  isLoading: boolean;
  isInitialized: boolean;
  locale: AppLocale;

  initialize: () => Promise<void>;
  setActiveBaby: (id: string) => Promise<void>;
  saveBaby: (baby: Omit<Baby, 'id'> & { id?: string; napGoal?: Baby['napGoal']; trackFeedingDuration?: boolean }) => Promise<Baby>;
  setLocale: (locale: AppLocale) => Promise<void>;
  refreshEvents: () => Promise<void>;
  startSleep: (type: 'nap' | 'night') => Promise<void>;
  endSleep: () => Promise<void>;
  pauseSleep: () => Promise<void>;
  resumeSleep: () => Promise<void>;
  addSleepEvent: (event: Omit<SleepEvent, 'id'>) => Promise<SleepEvent>;
  editSleepEvent: (event: SleepEvent) => Promise<void>;
  removeSleepEvent: (id: string) => Promise<void>;
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
  addDailyChore: (title: string, recurrence?: ChoreRecurrence) => Promise<void>;
  toggleDailyChore: (choreId: string, completed: boolean) => Promise<void>;
  removeDailyChore: (id: string) => Promise<void>;
  recomputePrediction: () => Promise<void>;
  importCareEvents: (preview: ImportPreview) => Promise<{
    sleepAdded: number;
    feedingAdded: number;
    diaperAdded: number;
    bathAdded: number;
    wakeAdded: number;
    duplicatesSkipped: number;
    failedSkipped: number;
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
  dailyChores: [],
  completedChoreIdsToday: [],
  prediction: null,
  isLoading: true,
  isInitialized: false,
  locale: 'system',

  initialize: async () => {
    await setupNotificationChannel();
    const [babies, locale] = await Promise.all([getAllBabies(), getAppLocale()]);
    const activeBabyId = babies[0]?.id ?? null;
    set({ babies, locale, activeBabyId, isLoading: false, isInitialized: true });
    if (activeBabyId) await get().setActiveBaby(activeBabyId);
  },

  setActiveBaby: async (id: string) => {
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
    const isFirst = babies.length === 1;
    set({ babies, activeBabyId: isFirst ? baby.id : get().activeBabyId ?? baby.id });
    if (isFirst || get().activeBabyId === baby.id) {
      await get().setActiveBaby(baby.id);
    }
    return baby;
  },

  setLocale: async (locale) => {
    await setAppLocale(locale);
    set({ locale });
  },

  refreshEvents: async () => {
    const { activeBabyId } = get();
    if (!activeBabyId) return;
    const [events, sleepPauses, feedings, diapers, baths, wakes] = await Promise.all([
      getSleepEventsForBaby(activeBabyId),
      getSleepPausesForBaby(activeBabyId),
      getFeedingEventsForBaby(activeBabyId),
      getDiaperEventsForBaby(activeBabyId),
      getBathEventsForBaby(activeBabyId),
      getWakeEventsForBaby(activeBabyId),
    ]);
    set({ events, sleepPauses, feedings, diapers, baths, wakes });
    await get().recomputePrediction();
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
    };
    await insertSleepEvent(event);
    await get().refreshEvents();
  },

  endSleep: async () => {
    const { activeBabyId, events } = get();
    const ongoing = isCurrentlyAsleep(events);
    if (!ongoing || !activeBabyId) return;
    const openPause = getOngoingPause(get().sleepPauses, ongoing.id);
    if (openPause) {
      await updateSleepPause({ ...openPause, endTime: new Date().toISOString() });
    }
    const endTime = new Date().toISOString();
    await updateSleepEvent({ ...ongoing, endTime });
    await get().refreshEvents();
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
  },

  resumeSleep: async () => {
    const ongoing = isCurrentlyAsleep(get().events);
    const openPause = getOngoingPause(get().sleepPauses, ongoing?.id);
    if (!ongoing || !openPause) return;
    await updateSleepPause({ ...openPause, endTime: new Date().toISOString() });
    await get().refreshEvents();
  },

  addSleepEvent: async (input) => {
    const event: SleepEvent = { ...input, id: newId() };
    await insertSleepEvent(event);
    await get().refreshEvents();
    return event;
  },

  editSleepEvent: async (event) => {
    await updateSleepEvent(event);
    await get().refreshEvents();
  },

  removeSleepEvent: async (id) => {
    await deleteSleepEvent(id);
    await get().refreshEvents();
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
  },

  endBreastFeed: async () => {
    const ongoing = isOngoingFeeding(get().feedings);
    if (!ongoing) return;
    await updateFeedingEvent({ ...ongoing, endTime: new Date().toISOString() });
    await get().refreshEvents();
  },

  addFeeding: async (input) => {
    const event: FeedingEvent = { ...input, id: newId() };
    await insertFeedingEvent(event);
    await get().refreshEvents();
    return event;
  },

  editFeeding: async (event) => {
    await updateFeedingEvent(event);
    await get().refreshEvents();
  },

  removeFeeding: async (id) => {
    await deleteFeedingEvent(id);
    await get().refreshEvents();
  },

  addDiaper: async (input) => {
    const event: DiaperEvent = { ...input, id: newId() };
    await insertDiaperEvent(event);
    await get().refreshEvents();
    return event;
  },

  editDiaper: async (event) => {
    await updateDiaperEvent(event);
    await get().refreshEvents();
  },

  removeDiaper: async (id) => {
    await deleteDiaperEvent(id);
    await get().refreshEvents();
  },

  addBath: async (input) => {
    const event: BathEvent = { ...input, id: newId() };
    await insertBathEvent(event);
    await get().refreshEvents();
    return event;
  },

  editBath: async (event) => {
    await updateBathEvent(event);
    await get().refreshEvents();
  },

  removeBath: async (id) => {
    await deleteBathEvent(id);
    await get().refreshEvents();
  },

  addWake: async (input) => {
    const event: WakeEvent = { ...input, id: newId() };
    await insertWakeEvent(event);
    await get().refreshEvents();
    return event;
  },

  editWake: async (event) => {
    await updateWakeEvent(event);
    await get().refreshEvents();
  },

  removeWake: async (id) => {
    await deleteWakeEvent(id);
    await get().refreshEvents();
  },

  refreshChores: async () => {
    const { activeBabyId } = get();
    if (!activeBabyId) {
      set({ dailyChores: [], completedChoreIdsToday: [] });
      return;
    }
    const dateKey = formatDateKey(new Date());
    const [dailyChores, completions] = await Promise.all([
      getDailyChoresForBaby(activeBabyId),
      getDailyChoreCompletionsForDate(activeBabyId, dateKey),
    ]);
    set({
      dailyChores,
      completedChoreIdsToday: completions.map((c) => c.choreId),
    });
  },

  addDailyChore: async (title, recurrence = 'daily') => {
    const { activeBabyId, dailyChores } = get();
    if (!activeBabyId || !title.trim()) return;
    await insertDailyChore({
      babyId: activeBabyId,
      title: title.trim(),
      sortOrder: dailyChores.length,
      createdAt: new Date().toISOString(),
      recurrence,
    });
    await get().refreshChores();
  },

  toggleDailyChore: async (choreId, completed) => {
    const dateKey = formatDateKey(new Date());
    await setDailyChoreCompleted(choreId, dateKey, completed);
    await get().refreshChores();
  },

  removeDailyChore: async (id) => {
    await deleteDailyChore(id);
    await get().refreshChores();
  },

  recomputePrediction: async () => {
    const { babies, activeBabyId, events, wakes } = get();
    const baby = babies.find((b) => b.id === activeBabyId);
    if (!baby) {
      set({ prediction: null });
      await cancelSleepReminder();
      return;
    }
    if (isCurrentlyAsleep(events)) {
      set({ prediction: null });
      await cancelSleepReminder();
      return;
    }
    const prediction = predictNextSleep(events, wakes, baby, new Date());
    set({ prediction });
    await scheduleSleepReminder(
      prediction.predictedTime,
      prediction.slotLabel,
      baby.name
    );
  },

  importCareEvents: async (preview) => {
    const { activeBabyId } = get();
    if (!activeBabyId) {
      return {
        sleepAdded: 0,
        feedingAdded: 0,
        diaperAdded: 0,
        bathAdded: 0,
        wakeAdded: 0,
        duplicatesSkipped: 0,
        failedSkipped: preview.totalRows,
      };
    }

    const { sleep, feedings, diapers, baths, wakes, sleepPauses } = getImportableEvents(preview);
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
