import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus, type NativeEventSubscription, Platform } from 'react-native';
import { addUserInteractionListener } from 'expo-widgets';

import type { SleepWidgetAction, SleepWidgetInteraction } from '@/lib/sleepWidgetOptimistic';
import { publishWidgetBridge } from '@/lib/widgetBridge';
import { drainWidgetPendingQueue } from '@/lib/widgetPendingDrain';

const LAST_PROCESSED_KEY = 'relaxo.sleepWidget.lastProcessedActionAt';

export const SLEEP_WIDGET_SOURCE = 'SleepHomeWidget';
export const SLEEP_LIVE_ACTIVITY_SOURCE = 'SleepLiveActivity';
export const SLEEP_WATCH_SOURCE = 'RelaxoWatch';

const SLEEP_ACTION_TARGETS = new Set<string>([
  'start-nap',
  'start-bedtime',
  'end',
  'pause',
  'resume',
]);

function isSleepWidgetAction(value: string): value is SleepWidgetAction {
  return SLEEP_ACTION_TARGETS.has(value);
}

function isWidgetInteraction(value: string): value is SleepWidgetInteraction {
  return value === 'sync' || isSleepWidgetAction(value);
}

async function getLastProcessedAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PROCESSED_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function setLastProcessedAt(at: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PROCESSED_KEY, String(at));
  } catch {
    // ignore
  }
}

async function runHouseholdSync(): Promise<void> {
  const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
  await flushHouseholdAutoSyncNow();
}

export async function applySleepWidgetAction(
  action: SleepWidgetAction,
  actionAt: number = Date.now()
): Promise<boolean> {
  const last = await getLastProcessedAt();
  if (actionAt > 0 && actionAt <= last) return false;

  const { useAppStore } = await import('@/store/useAppStore');
  const store = useAppStore.getState();
  if (!store.isInitialized) {
    await store.initialize();
  }

  const fresh = useAppStore.getState();
  switch (action) {
    case 'start-nap':
      await fresh.startSleep('nap');
      break;
    case 'start-bedtime':
      await fresh.startSleep('night');
      break;
    case 'end':
      await fresh.endSleep();
      break;
    case 'pause':
      await fresh.pauseSleep();
      break;
    case 'resume':
      await fresh.resumeSleep();
      break;
  }

  await setLastProcessedAt(Math.max(actionAt, Date.now()));
  return true;
}

export async function applyWidgetInteraction(
  target: SleepWidgetInteraction,
  actionAt: number = Date.now(),
  opts?: { fromReconcile?: boolean }
): Promise<boolean> {
  if (target === 'sync') {
    if (opts?.fromReconcile) {
      const last = await getLastProcessedAt();
      if (actionAt > 0 && actionAt <= last) return false;
    }
    const { useAppStore } = await import('@/store/useAppStore');
    if (!useAppStore.getState().isInitialized) {
      await useAppStore.getState().initialize();
    }
    await runHouseholdSync();
    // Ensure Home widget + Watch snapshot refresh after partner pull.
    const store = useAppStore.getState();
    if (store.activeBabyId) {
      await store.refreshEvents();
    }
    await publishWidgetBridge();
    if (actionAt > 0) {
      await setLastProcessedAt(Math.max(actionAt, Date.now()));
    }
    return true;
  }

  return applySleepWidgetAction(target, actionAt);
}

async function reconcilePendingFromWidget(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // 1) Durable App Group queue written by the widget Intent (works when app was killed).
  try {
    await drainWidgetPendingQueue();
  } catch (error) {
    console.warn('[sleepWidgetActions] drain failed', error);
  }

  // 2) Timeline pendingAction fallback (optimistic props).
  try {
    const SleepHomeWidget =
      require('@/widgets/SleepHomeWidget').default as typeof import('@/widgets/SleepHomeWidget').default;
    const timeline = await SleepHomeWidget.getTimeline();
    if (timeline.length) {
      let best: { action: SleepWidgetInteraction; at: number } | null = null;
      for (const entry of timeline) {
        const action = entry.props.pendingAction;
        const at = entry.props.pendingActionAt ?? 0;
        if (!action || !isWidgetInteraction(action) || at <= 0) continue;
        if (!best || at > best.at) best = { action, at };
      }
      if (best) {
        const last = await getLastProcessedAt();
        if (best.at > last) {
          await applyWidgetInteraction(best.action, best.at, { fromReconcile: true });
        }
      }
    }
  } catch (error) {
    console.warn('[sleepWidgetActions] reconcile failed', error);
  }

  // 3) Always pull-heal on foreground (covers empty queue / failed widget Sync).
  try {
    const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
    await flushHouseholdAutoSyncNow();
    const { useAppStore } = await import('@/store/useAppStore');
    const store = useAppStore.getState();
    if (store.activeBabyId) {
      await store.refreshEvents();
    }
    await publishWidgetBridge();
  } catch (error) {
    console.warn('[sleepWidgetActions] foreground heal failed', error);
  }
}

let hooksInstalled = false;
let appSub: NativeEventSubscription | null = null;
let interactionSub: { remove: () => void } | null = null;
let applying = false;

async function handleTarget(target: string, timestamp?: number): Promise<void> {
  if (!isWidgetInteraction(target)) return;
  if (applying) return;
  applying = true;
  try {
    // Prefer the durable App Group queue (includes cloud sleepEventId when available).
    const drained = await drainWidgetPendingQueue();
    if (drained === 0) {
      await applyWidgetInteraction(
        target,
        timestamp && timestamp > 0 ? timestamp : Date.now()
      );
      // applyWidgetInteraction(sync) already flushes; other actions flush via store.
      // Still heal once so pull picks up partner writes stamped while we were killed.
      if (target !== 'sync') {
        const { flushHouseholdAutoSyncNow } = await import('@/lib/autoSync');
        await flushHouseholdAutoSyncNow();
        const { useAppStore } = await import('@/store/useAppStore');
        const store = useAppStore.getState();
        if (store.activeBabyId) {
          await store.refreshEvents();
        }
      }
    }
    await publishWidgetBridge();
  } finally {
    applying = false;
  }
}

/**
 * Listen for widget / Live Activity button taps and reconcile pending actions
 * when the app becomes active (covers the killed-app case).
 */
export function setupSleepWidgetInteractions(): () => void {
  if (Platform.OS !== 'ios') return () => {};
  if (hooksInstalled) return () => {};
  hooksInstalled = true;

  interactionSub = addUserInteractionListener((event) => {
    if (
      event.source !== SLEEP_WIDGET_SOURCE &&
      event.source !== SLEEP_LIVE_ACTIVITY_SOURCE
    ) {
      return;
    }
    void handleTarget(event.target, event.timestamp);
  });

  let watchSub: { remove: () => void } | null = null;
  try {
    const { addWatchActionListener } =
      require('@/modules/widget-bridge') as typeof import('@/modules/widget-bridge');
    watchSub = addWatchActionListener((event) => {
      void handleTarget(event.target, event.timestamp);
    });
  } catch {
    // Native module unavailable (web / missing binary).
  }

  appSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') {
      void reconcilePendingFromWidget();
      void publishWidgetBridge();
    }
  });

  if (AppState.currentState === 'active') {
    void reconcilePendingFromWidget();
    void publishWidgetBridge();
  }

  return () => {
    hooksInstalled = false;
    interactionSub?.remove();
    interactionSub = null;
    watchSub?.remove();
    watchSub = null;
    appSub?.remove();
    appSub = null;
  };
}
