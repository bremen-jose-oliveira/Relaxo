/**
 * Subscribe to household Postgres changes and trigger a silent pull/push.
 * Complements foreground + interval auto-sync so partner updates arrive in seconds.
 */
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { scheduleHouseholdPullSync } from '@/lib/autoSync';
import { getSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const TABLES = [
  'sleep_events',
  'sleep_pauses',
  'feeding_events',
  'diaper_events',
  'bath_events',
  'wake_events',
  'day_context_tags',
  'babies',
  'daily_chores',
  'daily_chore_completions',
] as const;

/** Coalesce bursty partner writes (start + pause rows, etc.) into one sync. */
const REALTIME_COALESCE_MS = 400;

let channel: RealtimeChannel | null = null;
let subscribedHouseholdId: string | null = null;
let hooksInstalled = false;
let unsubAuth: (() => void) | null = null;
let appSub: NativeEventSubscription | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;

function requestPullFromRealtime(): void {
  if (coalesceTimer) clearTimeout(coalesceTimer);
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null;
    scheduleHouseholdPullSync({ urgent: true });
  }, REALTIME_COALESCE_MS);
}

async function teardownChannel(): Promise<void> {
  const supabase = getSupabase();
  if (channel && supabase) {
    try {
      await supabase.removeChannel(channel);
    } catch {
      // ignore
    }
  }
  channel = null;
  subscribedHouseholdId = null;
}

async function ensureRealtimeAuth(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      await supabase.realtime.setAuth(token);
    }
  } catch {
    // Older clients / offline — subscribe may still work via existing session.
  }
}

async function subscribeHousehold(householdId: string): Promise<void> {
  const supabase = getSupabase();
  const { user, configured } = useAuthStore.getState();
  if (!supabase || !configured || !user || !householdId) {
    await teardownChannel();
    return;
  }

  if (subscribedHouseholdId === householdId && channel) {
    return;
  }

  await teardownChannel();
  await ensureRealtimeAuth();

  const filter = `household_id=eq.${householdId}`;
  let next = supabase.channel(`relaxo-household:${householdId}`);

  for (const table of TABLES) {
    next = next.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      () => {
        requestPullFromRealtime();
      }
    );
  }

  channel = next.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribedHouseholdId = householdId;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      // Interval / foreground pull remain as fallback.
      if (subscribedHouseholdId === householdId) {
        subscribedHouseholdId = null;
      }
    }
  });
}

async function syncSubscriptionToAuth(): Promise<void> {
  const { householdId, user, configured, isReady } = useAuthStore.getState();
  if (!isReady || !configured || !user || !householdId) {
    await teardownChannel();
    return;
  }
  // Only keep the socket warm while the app is active.
  if (AppState.currentState !== 'active') {
    await teardownChannel();
    return;
  }
  await subscribeHousehold(householdId);
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === 'active') {
    void syncSubscriptionToAuth();
    return;
  }
  if (next === 'background' || next === 'inactive') {
    void teardownChannel();
  }
}

/** Install Realtime household listeners (idempotent). */
export function installHouseholdRealtimeSync(): () => void {
  if (hooksInstalled) {
    return () => {};
  }
  hooksInstalled = true;

  appSub = AppState.addEventListener('change', onAppStateChange);

  unsubAuth = useAuthStore.subscribe((state, prev) => {
    const householdChanged = state.householdId !== prev.householdId;
    const userChanged = state.user?.id !== prev.user?.id;
    const becameReady = state.isReady && !prev.isReady;
    if (householdChanged || userChanged || becameReady) {
      void syncSubscriptionToAuth();
    }
  });

  void syncSubscriptionToAuth();

  return () => {
    hooksInstalled = false;
    appSub?.remove();
    appSub = null;
    unsubAuth?.();
    unsubAuth = null;
    if (coalesceTimer) {
      clearTimeout(coalesceTimer);
      coalesceTimer = null;
    }
    void teardownChannel();
  };
}
