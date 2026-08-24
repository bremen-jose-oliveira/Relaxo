/**
 * Local-first cloud sync: after every SQLite write that matters for the
 * household, push/pull immediately so the cloud (and partner phones) stay current.
 *
 * Also pulls when the app becomes active and on a light interval while open,
 * so partner updates show up without tapping “Sync now”.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';

import { useAuthStore } from '@/store/useAuthStore';

/** Tiny coalesce so double-taps in the same frame share one sync. */
const COALESCE_MS = 100;
/** While the app is open, pull partner changes on this cadence. */
const PULL_INTERVAL_MS = 45_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pullInterval: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
/** Local writes still need a sync attempt (survives auth-not-ready skips). */
let pending = false;
/** Partner pull requested (foreground / interval) — not a local dirty flag. */
let pullRequested = false;
/** Another write arrived while a sync was in flight. */
let queued = false;
let hooksInstalled = false;
let appSub: NativeEventSubscription | null = null;
let unsubAuth: (() => void) | null = null;

export type ScheduleAutoSyncOptions = {
  /** Skip the coalesce delay (sleep end / Live Activity). */
  urgent?: boolean;
};

async function ensureHouseholdReady(): Promise<boolean> {
  const auth = useAuthStore.getState();
  if (!auth.configured || !auth.user) return false;

  if (auth.householdId) return true;

  await auth.refreshSyncMeta();
  return Boolean(useAuthStore.getState().householdId);
}

function armFlushTimer(opts?: ScheduleAutoSyncOptions): void {
  const delay = opts?.urgent ? 0 : COALESCE_MS;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushHouseholdAutoSync();
  }, delay);
}

/**
 * Queue a household sync after a local write. No-ops until signed in + household,
 * but keeps `pending` so it retries when auth/meta becomes ready.
 */
export function scheduleHouseholdAutoSync(opts?: ScheduleAutoSyncOptions): void {
  pending = true;
  queued = true;
  armFlushTimer(opts);
}

/**
 * Pull partner updates (and push any local dirty rows). Does not mark a local write.
 */
export function scheduleHouseholdPullSync(opts?: ScheduleAutoSyncOptions): void {
  pullRequested = true;
  armFlushTimer(opts);
}

/** Cancel coalesce and run sync now (awaitable). Use after ending a nap/sleep. */
export async function flushHouseholdAutoSyncNow(): Promise<void> {
  pending = true;
  queued = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await flushHouseholdAutoSync();
}

async function flushHouseholdAutoSync(): Promise<void> {
  if (inFlight) {
    queued = true;
    return;
  }

  if (!pending && !pullRequested && !queued) {
    return;
  }

  const { configured, user, isSyncing, syncNow, isReady } = useAuthStore.getState();

  // Auth still booting — keep flags; hooks retry when ready.
  if (!isReady) {
    return;
  }

  if (!configured || !user) {
    pending = false;
    pullRequested = false;
    queued = false;
    return;
  }

  const ready = await ensureHouseholdReady();
  if (!ready) {
    // Signed in but no household yet — keep local pending; drop pure pulls.
    if (!pending) pullRequested = false;
    return;
  }

  if (isSyncing) {
    queued = true;
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        void flushHouseholdAutoSync();
      }, COALESCE_MS);
    }
    return;
  }

  inFlight = true;
  queued = false;
  const wasPull = pullRequested;
  try {
    const result = await syncNow({ silent: true });
    if (result.ok) {
      pending = false;
      pullRequested = false;
      const { useAppStore } = await import('@/store/useAppStore');
      const { getAllBabies } = await import('@/db/database');
      const store = useAppStore.getState();
      const babies = await getAllBabies();
      const activeStillThere =
        store.activeBabyId && babies.some((b) => b.id === store.activeBabyId);
      useAppStore.setState({ babies });
      if (!activeStillThere && babies[0]) {
        await store.setActiveBaby(babies[0].id);
      } else {
        await store.refreshEvents();
        await store.refreshChores();
      }
    } else if (wasPull && !pending) {
      // Interval will ask again; don't sticky-loop failed pulls.
      pullRequested = false;
    }
  } catch {
    if (wasPull && !pending) {
      pullRequested = false;
    }
  } finally {
    inFlight = false;
    if (queued) {
      scheduleHouseholdAutoSync({ urgent: true });
    }
  }
}

function startPeriodicPull(): void {
  stopPeriodicPull();
  pullInterval = setInterval(() => {
    scheduleHouseholdPullSync({ urgent: true });
  }, PULL_INTERVAL_MS);
}

function stopPeriodicPull(): void {
  if (pullInterval) {
    clearInterval(pullInterval);
    pullInterval = null;
  }
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === 'active') {
    startPeriodicPull();
    // Always pull when coming back — partner may have logged while we were away.
    scheduleHouseholdPullSync({ urgent: true });
    return;
  }

  if (next === 'background' || next === 'inactive') {
    stopPeriodicPull();
    // Flush local writes before suspension; skip empty partner-only pulls.
    if (pending || queued) {
      void flushHouseholdAutoSync();
    }
  }
}

/**
 * Pull on foreground + while open; retry pending local sync when auth/household
 * becomes available.
 */
export function installHouseholdAutoSyncHooks(): () => void {
  if (hooksInstalled) {
    return () => {};
  }
  hooksInstalled = true;

  appSub = AppState.addEventListener('change', onAppStateChange);

  if (AppState.currentState === 'active') {
    startPeriodicPull();
    scheduleHouseholdPullSync({ urgent: true });
  }

  unsubAuth = useAuthStore.subscribe((state, prev) => {
    const becameReady = state.isReady && !prev.isReady;
    const gotUser = Boolean(state.user) && !prev.user;
    const gotHousehold = Boolean(state.householdId) && !prev.householdId;
    if (becameReady || gotUser || gotHousehold) {
      if (pending || queued) {
        void flushHouseholdAutoSync();
      } else if (state.user && state.householdId) {
        scheduleHouseholdPullSync({ urgent: true });
      }
    }
  });

  return () => {
    hooksInstalled = false;
    stopPeriodicPull();
    appSub?.remove();
    appSub = null;
    unsubAuth?.();
    unsubAuth = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
