import * as Linking from 'expo-linking';

import { parseSleepLiveActivityAction } from '@/lib/sleepLiveActivity';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

const AUTH_READY_MS = 8000;

async function waitForAuthReady(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.isReady) {
    if (auth.user) await auth.refreshSyncMeta();
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      unsub();
      clearTimeout(timeout);
      resolve();
    };
    const unsub = useAuthStore.subscribe((state) => {
      if (state.isReady) done();
    });
    const timeout = setTimeout(done, AUTH_READY_MS);
    if (useAuthStore.getState().isReady) done();
  });

  const next = useAuthStore.getState();
  if (next.user) await next.refreshSyncMeta();
}

async function handleSleepDeepLink(url: string): Promise<void> {
  const action = parseSleepLiveActivityAction(url);
  if (!action || action === 'active') return;

  const store = useAppStore.getState();
  if (!store.isInitialized) {
    await store.initialize();
  }

  // Live Activity can open the app before auth/household meta is hydrated.
  await waitForAuthReady();

  if (action === 'end') {
    await useAppStore.getState().endSleep();
    return;
  }
  if (action === 'pause') {
    await useAppStore.getState().pauseSleep();
    return;
  }
  if (action === 'resume') {
    await useAppStore.getState().resumeSleep();
    return;
  }
  if (action === 'start-nap') {
    await useAppStore.getState().startSleep('nap');
    return;
  }
  if (action === 'start-bedtime') {
    await useAppStore.getState().startSleep('night');
  }
}

/** Wire Lock Screen / Home Screen deep links for sleep controls. */
export function setupSleepLiveActivityLinking(): () => void {
  void Linking.getInitialURL().then((url) => {
    if (url) void handleSleepDeepLink(url);
  });

  const subscription = Linking.addEventListener('url', ({ url }) => {
    void handleSleepDeepLink(url);
  });

  return () => subscription.remove();
}
