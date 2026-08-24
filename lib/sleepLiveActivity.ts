import { Platform } from 'react-native';

import {
  buildSleepLiveActivityProps,
  sleepActionUrl,
} from '@/lib/sleepLiveActivityProps';
import type { AppLocale, SleepEvent, SleepPause } from '@/types';

export {
  buildSleepLiveActivityProps,
  parseSleepLiveActivityAction,
  SLEEP_LIVE_ACTIVITY_URL,
  sleepActionUrl,
} from '@/lib/sleepLiveActivityProps';

/** Start, update, or dismiss the sleep Live Activity to match app state. */
export function syncSleepLiveActivity(
  input: {
    ongoing: SleepEvent;
    pauses: SleepPause[];
    locale: AppLocale;
  } | null
): void {
  if (Platform.OS !== 'ios') return;

  try {
    // Lazy import so Jest / Android never loads the widget native module.
    const SleepLiveActivity =
      require('@/widgets/SleepLiveActivity').default as typeof import('@/widgets/SleepLiveActivity').default;

    const instances = SleepLiveActivity.getInstances();

    if (!input) {
      for (const instance of instances) {
        void instance.end('immediate');
      }
      return;
    }

    const props = buildSleepLiveActivityProps(input);
    if (instances.length === 0) {
      SleepLiveActivity.start(props, sleepActionUrl('active'));
      return;
    }

    void instances[0].update(props);
    for (const extra of instances.slice(1)) {
      void extra.end('immediate');
    }
  } catch (error) {
    console.warn('[sleepLiveActivity] sync failed', error);
  }
}
