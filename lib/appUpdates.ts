import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import latestPreviewBuild from '@/assets/latest-preview-build.json';

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
 * Opens the latest preview build install flow (same as scanning the EAS QR code).
 * iOS: itms-services manifest install. Android: direct APK when available, else build page.
 */
export async function openLatestBuildInstall(): Promise<BuildInstallOutcome> {
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const build = getLatestPreviewBuildForPlatform(platform);
  if (!build) {
    return { status: 'no_build' };
  }

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

/** @deprecated use openLatestBuildInstall */
export async function openBuildsPage(): Promise<void> {
  const outcome = await openLatestBuildInstall();
  if (outcome.status === 'no_build') {
    const url = getExpoBuildsUrl();
    await Linking.openURL(url);
    return;
  }
  if (outcome.status === 'error') {
    throw new Error(outcome.message);
  }
}
