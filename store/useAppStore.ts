import { create } from 'zustand';
import { newId } from '@/lib/newId';
import type { Baby, DiaperEvent, FeedingEvent, SleepEvent, SleepPause, WakeEvent } from '@/types';
import {
  bulkInsertDiaperEvents,
  bulkInsertFeedingEvents,
  bulkInsertSleepEvents,
  bulkInsertSleepPauses,
  bulkInsertWakeEvents,
  deleteDiaperEvent,
  deleteFeedingEvent,
  deleteSleepEvent,
  deleteWakeEvent,
  getAllBabies,
  getDiaperEventsForBaby,
  getFeedingEventsForBaby,
  getSleepEventsForBaby,
  getSleepPausesForBaby,
  getWakeEventsForBaby,
  insertDiaperEvent,
  insertFeedingEvent,
  insertSleepEvent,
  insertSleepPause,
  insertWakeEvent,
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
import { isOngoingFeeding } from '@/lib/timeline';
import { getOngoingPause, isSleepPaused } from '@/lib/sleepPauses';
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
  wakes: WakeEvent[];
  prediction: PredictResult | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  setActiveBaby: (id: string) => Promise<void>;
  saveBaby: (baby: Omit<Baby, 'id'> & { id?: string; napGoal?: Baby['napGoal'] }) => Promise<Baby>;
  refreshEvents: () => Promise<void>;
  startSleep: (type: 'nap' | 'night') => Promise<void>;
  endSleep: () => Promise<void>;
  pauseSleep: () => Promise<void>;
  resumeSleep: () => Promise<void>;
  startDay: () => Promise<void>;
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
  addWake: (event: Omit<WakeEvent, 'id'>) => Promise<WakeEvent>;
  editWake: (event: WakeEvent) => Promise<void>;
  removeWake: (id: string) => Promise<void>;
  recomputePrediction: () => Promise<void>;
  importCareEvents: (preview: ImportPreview) => Promise<{
    sleepAdded: number;
    feedingAdded: number;
    diaperAdded: number;
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
  wakes: [],
  prediction: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    await setupNotificationChannel();
    const babies = await getAllBabies();
    const activeBabyId = babies[0]?.id ?? null;
    set({ babies, activeBabyId, isLoading: false, isInitialized: true });
    if (activeBabyId) await get().setActiveBaby(activeBabyId);
  },

  setActiveBaby: async (id: string) => {
    set({ activeBabyId: id, isLoading: true });
    const [events, sleepPauses, feedings, diapers, wakes] = await Promise.all([
      getSleepEventsForBaby(id),
      getSleepPausesForBaby(id),
      getFeedingEventsForBaby(id),
      getDiaperEventsForBaby(id),
      getWakeEventsForBaby(id),
    ]);
    set({ events, sleepPauses, feedings, diapers, wakes, isLoading: false });
    await get().recomputePrediction();
  },

  saveBaby: async (input) => {
    const baby: Baby = {
      id: input.id ?? newId(),
      name: input.name,
      birthDate: input.birthDate,
      napGoal: input.napGoal ?? null,
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

  refreshEvents: async () => {
    const { activeBabyId } = get();
    if (!activeBabyId) return;
    const [events, sleepPauses, feedings, diapers, wakes] = await Promise.all([
      getSleepEventsForBaby(activeBabyId),
      getSleepPausesForBaby(activeBabyId),
      getFeedingEventsForBaby(activeBabyId),
      getDiaperEventsForBaby(activeBabyId),
      getWakeEventsForBaby(activeBabyId),
    ]);
    set({ events, sleepPauses, feedings, diapers, wakes });
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
    const ongoing = isCurrentlyAsleep(get().events);
    if (!ongoing) return;
    const openPause = getOngoingPause(get().sleepPauses, ongoing.id);
    if (openPause) {
      await updateSleepPause({ ...openPause, endTime: new Date().toISOString() });
    }
    await updateSleepEvent({ ...ongoing, endTime: new Date().toISOString() });
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

  startDay: async () => {
    const { activeBabyId } = get();
    if (!activeBabyId) return;
    const wake: WakeEvent = {
      id: newId(),
      babyId: activeBabyId,
      time: new Date().toISOString(),
      endTime: null,
      wakeType: 'morning',
      notes: null,
    };
    await insertWakeEvent(wake);
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
        wakeAdded: 0,
        duplicatesSkipped: 0,
        failedSkipped: preview.totalRows,
      };
    }

    const { sleep, feedings, diapers, wakes, sleepPauses } = getImportableEvents(preview);
    const sleepResult = await bulkInsertSleepEvents(sleep, activeBabyId);
    const [feedingResult, diaperResult, wakeResult] = await Promise.all([
      bulkInsertFeedingEvents(feedings, activeBabyId),
      bulkInsertDiaperEvents(diapers, activeBabyId),
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
      wakeAdded: wakeResult.added,
      duplicatesSkipped:
        sleepResult.duplicatesSkipped +
        feedingResult.duplicatesSkipped +
        diaperResult.duplicatesSkipped +
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
