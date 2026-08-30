import { Platform } from 'react-native';

import type { SleepWidgetInteraction } from '@/lib/sleepWidgetOptimistic';
import type { SleepEvent } from '@/types';

const SLEEP_TARGETS = new Set([
  'start-nap',
  'start-bedtime',
  'end',
  'pause',
  'resume',
  'sync',
]);

function isInteraction(value: string): value is SleepWidgetInteraction {
  return SLEEP_TARGETS.has(value);
}

/**
 * Drain App Group pending widget actions into local SQLite (and sync).
 * Uses any sleepEventId stamped by the widget Intent cloud write so IDs match.
 */
export async function drainWidgetPendingQueue(): Promise<number> {
  if (Platform.OS !== 'ios') return 0;

  let pending: {
    id: string;
    source: string;
    target: string;
    at: number;
    sleepEventId?: string | null;
  }[] = [];

  try {
    const bridge =
      require('@/modules/widget-bridge') as typeof import('@/modules/widget-bridge');
    pending = bridge.getWidgetPendingActions();
  } catch {
    return 0;
  }

  if (!pending.length) return 0;

  const { useAppStore } = await import('@/store/useAppStore');
  const store = useAppStore.getState();
  if (!store.isInitialized) {
    await store.initialize();
  }

  const processedIds: string[] = [];
  let applied = 0;

  // Oldest first.
  const ordered = [...pending].sort((a, b) => a.at - b.at);

  for (const item of ordered) {
    if (!isInteraction(item.target)) {
      processedIds.push(item.id);
      continue;
    }

    try {
      if (
        (item.target === 'start-nap' || item.target === 'start-bedtime') &&
        item.sleepEventId
      ) {
        const appliedRemote = await applyRemoteStartedSleep(item);
        if (appliedRemote) {
          processedIds.push(item.id);
          applied += 1;
          continue;
        }
      }

      if (item.target === 'end' && item.sleepEventId) {
        const ended = await applyRemoteEndedSleep(item.sleepEventId);
        if (ended) {
          processedIds.push(item.id);
          applied += 1;
          continue;
        }
      }

      const { applyWidgetInteraction } = await import('@/lib/sleepWidgetActions');
      const ok = await applyWidgetInteraction(item.target, item.at, {
        fromReconcile: true,
      });
      if (ok) applied += 1;
      processedIds.push(item.id);
    } catch (error) {
      console.warn('[widgetPendingDrain] item failed', item.target, error);
    }
  }

  if (processedIds.length) {
    try {
      const bridge =
        require('@/modules/widget-bridge') as typeof import('@/modules/widget-bridge');
      bridge.clearWidgetPendingActions(processedIds);
    } catch {
      // ignore
    }
  }

  // Always pull-before-push so partner/widget cloud writes heal into SQLite + surfaces.
  try {
    const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
    await flushHouseholdAutoSyncNow();
    const fresh = useAppStore.getState();
    if (fresh.activeBabyId) {
      await fresh.refreshEvents();
    }
    const { publishWidgetBridge } = await import('@/lib/widgetBridge');
    await publishWidgetBridge();
  } catch (error) {
    console.warn('[widgetPendingDrain] heal flush failed', error);
  }

  return applied;
}

async function applyRemoteStartedSleep(item: {
  target: string;
  sleepEventId?: string | null;
  at: number;
}): Promise<boolean> {
  const sleepEventId = item.sleepEventId;
  if (!sleepEventId) return false;

  const { useAppStore } = await import('@/store/useAppStore');
  const { insertSleepEvent, getSleepEvent } = await import('@/db/database');
  const existing = await getSleepEvent(sleepEventId);
  if (existing) return true;

  const store = useAppStore.getState();
  const babyId = store.activeBabyId;
  if (!babyId) return false;
  if (store.events.some((e) => e.endTime == null)) {
    // Already have an open sleep locally — let normal apply no-op path handle.
    return false;
  }

  const event: SleepEvent = {
    id: sleepEventId,
    babyId,
    type: item.target === 'start-bedtime' ? 'night' : 'nap',
    startTime: new Date(item.at > 0 ? item.at : Date.now()).toISOString(),
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
  await store.refreshEvents();
  const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
  await flushHouseholdAutoSyncNow();
  return true;
}

async function applyRemoteEndedSleep(sleepEventId: string): Promise<boolean> {
  const { useAppStore } = await import('@/store/useAppStore');
  const { getSleepEvent, updateSleepEvent } = await import('@/db/database');
  const local = await getSleepEvent(sleepEventId);
  const store = useAppStore.getState();

  if (local && local.endTime == null) {
    await updateSleepEvent({ ...local, endTime: new Date().toISOString() });
    await store.refreshEvents();
    const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
    await flushHouseholdAutoSyncNow();
    return true;
  }

  // Fall back to ending whatever is open locally.
  const ended = await store.endSleep();
  return ended != null;
}
