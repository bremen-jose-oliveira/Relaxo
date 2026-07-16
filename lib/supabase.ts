import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Prefer new publishable key; fall back to legacy anon if still set. */
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

function isPlaceholderKey(key: string): boolean {
  return (
    key.includes('YOUR_PUBLISHABLE_KEY') ||
    key.includes('YOUR_ANON_KEY') ||
    key.includes('YOUR_PROJECT')
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey && !isPlaceholderKey(url) && !isPlaceholderKey(publishableKey));
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, publishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
