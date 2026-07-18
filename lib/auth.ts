import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export type AuthErrorResult = { error: string };

export function isRunningInExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}

/** Native Apple Auth module linked in this binary (false in Expo Go / stub). */
export function appleAuthNativeModulePresent(): boolean {
  return requireOptionalNativeModule('ExpoAppleAuthentication') != null;
}

/**
 * Official AppleAuthenticationButton needs a real native view manager.
 * Expo Go shows a red “Unimplemented component” if we mount it anyway.
 */
export function canRenderNativeAppleAuthButton(): boolean {
  return (
    Platform.OS === 'ios' &&
    !isRunningInExpoGo() &&
    appleAuthNativeModulePresent()
  );
}

/** Whether Profile should offer Sign in with Apple at all. */
export function appleSignInAvailable(): boolean {
  return (
    Platform.OS === 'ios' &&
    !isRunningInExpoGo() &&
    appleAuthNativeModulePresent()
  );
}

/** Refines availability after native `isAvailableAsync` (simulator / device). */
export async function resolveAppleSignInAvailable(): Promise<boolean> {
  if (!appleSignInAvailable()) return false;
  if (!appleAuthNativeModulePresent()) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function signInWithApple(): Promise<{ user: User } | AuthErrorResult> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.' };
  }
  if (Platform.OS !== 'ios') {
    return { error: 'Sign in with Apple is only available on iOS.' };
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return {
      error:
        'Sign in with Apple is not available here. Use a real iPhone with a new preview build that includes Apple Sign-In (not Expo Go / old install).',
    };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { error: 'Apple did not return an identity token.' };
    }

    const supabase = getSupabase()!;
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error || !data.user) {
      return { error: error?.message ?? 'Sign in failed.' };
    }

    const given = credential.fullName?.givenName;
    const family = credential.fullName?.familyName;
    if (given || family) {
      const fullName = [given, family].filter(Boolean).join(' ');
      await supabase.auth.updateUser({
        data: { full_name: fullName, name: fullName },
      });
    }

    return { user: data.user };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      return { error: 'canceled' };
    }
    return {
      error: err instanceof Error ? err.message : 'Sign in with Apple failed.',
    };
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const supabase = getSupabase();
  if (!supabase) {
    callback(null);
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
