/**
 * Expo Router treats every incoming URL as a route. Sleep widget / Live Activity
 * actions are not screens — send users to Home and let Linking handle the action.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const normalized = String(path ?? '').toLowerCase();
    if (
      normalized.includes('sleepaction=') ||
      normalized.includes('/sleep') ||
      normalized.startsWith('sleep/') ||
      normalized.includes('://sleep/')
    ) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
