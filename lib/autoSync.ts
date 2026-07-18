/**
 * Local-first cloud sync: after SQLite writes, debounce a background
 * push/pull when the user is in a household. Offline writes stay local;
 * sync retries on the next change or manual Sync now.
 */
import { useAuthStore } from '@/store/useAuthStore';

const DEBOUNCE_MS = 2500;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let queued = false;

export function scheduleHouseholdAutoSync(): void {
  const { configured, user, householdId } = useAuthStore.getState();
  if (!configured || !user || !householdId) return;

  queued = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushHouseholdAutoSync();
  }, DEBOUNCE_MS);
}

async function flushHouseholdAutoSync(): Promise<void> {
  if (inFlight) {
    queued = true;
    return;
  }

  const { configured, user, householdId, isSyncing, syncNow } =
    useAuthStore.getState();
  if (!configured || !user || !householdId) {
    queued = false;
    return;
  }

  if (isSyncing) {
    queued = true;
    timer = setTimeout(() => {
      timer = null;
      void flushHouseholdAutoSync();
    }, DEBOUNCE_MS);
    return;
  }

  inFlight = true;
  queued = false;
  try {
    const result = await syncNow({ silent: true });
    if (result.ok) {
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
    }
  } finally {
    inFlight = false;
    if (queued) scheduleHouseholdAutoSync();
  }
}
