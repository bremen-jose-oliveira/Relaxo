import { Platform } from 'react-native';

import { getSession } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

/** Publish auth + baby context into the App Group for killed-app widget intents. */
export async function publishWidgetBridge(): Promise<void> {
  if (Platform.OS !== 'ios' || !isSupabaseConfigured()) return;

  try {
    const {
      setWidgetBridge,
    } = require('@/modules/widget-bridge') as typeof import('@/modules/widget-bridge');

    const { user, householdId } = useAuthStore.getState();
    const babyId = useAppStore.getState().activeBabyId;

    if (!user || !householdId || !babyId) {
      setWidgetBridge(null);
      return;
    }

    const session = await getSession();
    const accessToken = session?.access_token;
    if (!accessToken || !SUPABASE_URL || !SUPABASE_KEY) {
      setWidgetBridge(null);
      return;
    }

    setWidgetBridge({
      accessToken,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_KEY,
      householdId,
      babyId,
    });
  } catch (error) {
    console.warn('[widgetBridge] publish failed', error);
  }
}
