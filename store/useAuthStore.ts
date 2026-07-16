import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import {
  appleSignInAvailable,
  getSession,
  onAuthStateChange,
  signInWithApple,
  signOut as authSignOut,
} from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  disconnectCloudSync,
  joinHouseholdByInviteCode,
  syncHouseholdData,
  type SyncResult,
} from '@/lib/sync';
import { getSyncState } from '@/db/syncState';

type AuthState = {
  configured: boolean;
  appleAvailable: boolean;
  session: Session | null;
  user: User | null;
  householdId: string | null;
  inviteCode: string | null;
  lastSyncedAt: string | null;
  isReady: boolean;
  isSigningIn: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;

  initializeAuth: () => Promise<void>;
  signInApple: () => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<SyncResult>;
  joinWithCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  refreshSyncMeta: () => Promise<void>;
};

let unsubAuth: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  configured: isSupabaseConfigured(),
  appleAvailable: appleSignInAvailable(),
  session: null,
  user: null,
  householdId: null,
  inviteCode: null,
  lastSyncedAt: null,
  isReady: false,
  isSigningIn: false,
  isSyncing: false,
  lastSyncError: null,

  initializeAuth: async () => {
    if (unsubAuth) {
      unsubAuth();
      unsubAuth = null;
    }

    const configured = isSupabaseConfigured();
    set({ configured, appleAvailable: appleSignInAvailable() });

    if (!configured) {
      set({ isReady: true, session: null, user: null });
      return;
    }

    const session = await getSession();
    set({
      session,
      user: session?.user ?? null,
      isReady: true,
    });

    if (session) {
      await get().refreshSyncMeta();
    }

    unsubAuth = onAuthStateChange(async (next) => {
      set({ session: next, user: next?.user ?? null });
      if (next) {
        await get().refreshSyncMeta();
      } else {
        set({ householdId: null, inviteCode: null, lastSyncedAt: null });
      }
    });
  },

  refreshSyncMeta: async () => {
    const meta = await getSyncState();
    set({
      householdId: meta.householdId,
      inviteCode: meta.inviteCode,
      lastSyncedAt: meta.lastSyncedAt,
    });
  },

  signInApple: async () => {
    set({ isSigningIn: true, lastSyncError: null });
    try {
      const result = await signInWithApple();
      if ('error' in result) {
        if (result.error === 'canceled') {
          return { ok: false, error: 'canceled' };
        }
        set({ lastSyncError: result.error });
        return { ok: false, error: result.error };
      }
      set({ user: result.user });
      const sync = await syncHouseholdData();
      if (!sync.ok) {
        set({ lastSyncError: sync.error ?? 'Sync failed after sign-in.' });
      }
      await get().refreshSyncMeta();
      return { ok: true };
    } finally {
      set({ isSigningIn: false });
    }
  },

  signOut: async () => {
    await authSignOut();
    await disconnectCloudSync();
    set({
      session: null,
      user: null,
      householdId: null,
      inviteCode: null,
      lastSyncedAt: null,
      lastSyncError: null,
    });
  },

  syncNow: async () => {
    set({ isSyncing: true, lastSyncError: null });
    try {
      const result = await syncHouseholdData();
      if (!result.ok) {
        set({ lastSyncError: result.error ?? 'Sync failed.' });
      } else {
        await get().refreshSyncMeta();
      }
      return result;
    } finally {
      set({ isSyncing: false });
    }
  },

  joinWithCode: async (code) => {
    set({ isSyncing: true, lastSyncError: null });
    try {
      const joined = await joinHouseholdByInviteCode(code);
      if ('error' in joined) {
        set({ lastSyncError: joined.error });
        return { ok: false, error: joined.error };
      }
      const sync = await syncHouseholdData();
      if (!sync.ok) {
        set({ lastSyncError: sync.error ?? 'Joined but sync failed.' });
        return { ok: false, error: sync.error };
      }
      await get().refreshSyncMeta();
      return { ok: true };
    } finally {
      set({ isSyncing: false });
    }
  },
}));
