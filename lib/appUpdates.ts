import { BackHandler, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import latestPreviewBuild from '@/assets/latest-preview-build.json';

/**
 * Force-quit after kicking off a native install so the running binary
 * is not overwritten in the foreground (that causes open→close loops).
 * Uses the local AppExit Expo module (needs a preview build that includes it).
 */
export function exitAppAfterInstallTrigger(): void {
  try {
    // Lazy require so Jest / Expo Go don't crash on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { exitApp } = require('@/modules/app-exit') as {
      exitApp: () => void;
    };
    exitApp();
    return;
  } catch {
    // Module missing in older binaries / Expo Go
  }

  if (Platform.OS === 'android') {
    BackHandler.exitApp();
  }
}

/**
 * Best-effort wipe of Expo Updates / cache leftovers before replacing the binary.
 * Prevents the next install from inheriting a stale update cache from the previous build.
 */
export async function clearInstallLeftovers(): Promise<void> {
  const roots = [FileSystem.cacheDirectory, FileSystem.documentDirectory].filter(
    (d): d is string => Boolean(d)
  );

  for (const root of roots) {
    try {
      const entries = await FileSystem.readDirectoryAsync(root);
      for (const name of entries) {
        if (
          /expo|updates|Exponent|EASUpdate|dev\.expo|com\.expo/i.test(name)
        ) {
          await FileSystem.deleteAsync(`${root}${name}`, { idempotent: true });
        }
      }
    } catch {
      // Sandbox may deny some paths — ignore
    }
  }
}

export type AppVersionInfo = {
  appVersion: string;
  runtimeVersion: string | null;
  channel: string | null;
  updateId: string | null;
  updatesSupported: boolean;
};

export type UpdateCheckOutcome =
  | { status: 'unsupported' }
  | { status: 'up_to_date' }
  | { status: 'downloaded' }
  | { status: 'error'; message: string };

export type BuildInstallOutcome =
  | { status: 'opened' }
  | { status: 'no_build' }
  | { status: 'error'; message: string };

type PlatformBuildMeta = {
  buildId: string;
  artifactUrl?: string | null;
};

type LatestPreviewBuildFile = {
  ios?: PlatformBuildMeta | null;
  android?: PlatformBuildMeta | null;
  syncedAt?: string;
};

export function getAppVersionInfo(): AppVersionInfo {
  return {
    appVersion: Constants.expoConfig?.version ?? '—',
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    updateId: Updates.updateId,
    updatesSupported: Updates.isEnabled && !__DEV__,
  };
}

export function formatUpdateId(updateId: string | null): string | null {
  if (!updateId) return null;
  return updateId.slice(0, 8);
}

export function getExpoProjectMeta(): {
  projectId: string;
  owner: string;
  slug: string;
} {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    '8976219b-9c26-4481-ac57-23dc6496c341';
  const owner = Constants.expoConfig?.owner ?? 'jose_oliv';
  const slug = Constants.expoConfig?.slug ?? 'relaxo';
  return { projectId, owner, slug };
}

/** Expo project builds list (fallback). */
export function getExpoBuildsUrl(): string {
  const { owner, slug } = getExpoProjectMeta();
  return `https://expo.dev/accounts/${owner}/projects/${slug}/builds`;
}

export function getBuildPageUrl(buildId: string): string {
  const { owner, slug } = getExpoProjectMeta();
  return `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${buildId}`;
}

/** Same URL encoded in the EAS install QR code on iOS. */
export function getIosItmsInstallUrl(projectId: string, buildId: string): string {
  const manifestUrl = `https://api.expo.dev/v2/projects/${projectId}/builds/${buildId}/manifest.plist`;
  return `itms-services://?action=download-manifest;url=${encodeURIComponent(manifestUrl)}`;
}

export function getLatestPreviewBuildForPlatform(
  platform: 'ios' | 'android' = Platform.OS === 'android' ? 'android' : 'ios'
): PlatformBuildMeta | null {
  const file = latestPreviewBuild as LatestPreviewBuildFile;
  const entry = platform === 'android' ? file.android : file.ios;
  if (!entry?.buildId) return null;
  return entry;
}

/**
 * Prefer live pointer from Supabase (updated by `npm run sync:preview-build`),
 * fall back to the JSON baked into the app bundle.
 */
export async function resolveLatestPreviewBuild(
  platform: 'ios' | 'android' = Platform.OS === 'android' ? 'android' : 'ios'
): Promise<PlatformBuildMeta | null> {
  try {
    // Lazy so unit tests don't load AsyncStorage / native supabase client.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabase } = require('@/lib/supabase') as typeof import('@/lib/supabase');
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('latest_preview_build')
        .select(
          'ios_build_id, ios_artifact_url, android_build_id, android_artifact_url'
        )
        .eq('id', 'preview')
        .maybeSingle();

      if (!error && data) {
        if (platform === 'ios' && data.ios_build_id) {
          return {
            buildId: String(data.ios_build_id),
            artifactUrl: data.ios_artifact_url
              ? String(data.ios_artifact_url)
              : null,
          };
        }
        if (platform === 'android' && data.android_build_id) {
          return {
            buildId: String(data.android_build_id),
            artifactUrl: data.android_artifact_url
              ? String(data.android_artifact_url)
              : null,
          };
        }
      }
    }
  } catch {
    // Table missing / offline / test env — use bundled JSON
  }

  return getLatestPreviewBuildForPlatform(platform);
}

export async function checkAndDownloadUpdate(): Promise<UpdateCheckOutcome> {
  if (!Updates.isEnabled || __DEV__) {
    return { status: 'unsupported' };
  }

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) {
      return { status: 'up_to_date' };
    }

    const fetch = await Updates.fetchUpdateAsync();
    if (!fetch.isNew) {
      return { status: 'up_to_date' };
    }

    return { status: 'downloaded' };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Update check failed',
    };
  }
}

export async function reloadWithLatestUpdate(): Promise<void> {
  await Updates.reloadAsync();
}

/**
 * Clears Expo leftovers, then opens the latest preview install flow
 * (same as scanning the EAS QR code).
 *
 * Callers should call `exitAppAfterInstallTrigger` shortly after `opened`
 * so the running app is not overwritten in the foreground.
 *
 * Keep the cloud pointer fresh with `npm run sync:preview-build` after each eas build.
 */
export async function openLatestBuildInstall(): Promise<BuildInstallOutcome> {
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const build = await resolveLatestPreviewBuild(platform);
  if (!build) {
    return { status: 'no_build' };
  }

  await clearInstallLeftovers();

  const { projectId } = getExpoProjectMeta();

  try {
    if (platform === 'ios') {
      const itmsUrl = getIosItmsInstallUrl(projectId, build.buildId);
      await Linking.openURL(itmsUrl);
      return { status: 'opened' };
    }

    if (build.artifactUrl) {
      await Linking.openURL(build.artifactUrl);
      return { status: 'opened' };
    }

    await Linking.openURL(getBuildPageUrl(build.buildId));
    return { status: 'opened' };
  } catch (err) {
    try {
      await Linking.openURL(getBuildPageUrl(build.buildId));
      return { status: 'opened' };
    } catch {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not open install link',
      };
    }
  }
}

