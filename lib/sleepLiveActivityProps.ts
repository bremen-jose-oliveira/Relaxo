import { getCurrentSegmentStart } from '@/lib/elapsedTime';
import { resolveLocale, translate } from '@/lib/i18n';
import { getOngoingPause } from '@/lib/sleepPauses';
import type { AppLocale, SleepEvent, SleepPause } from '@/types';

export type SleepDeepLinkAction =
  | 'end'
  | 'pause'
  | 'resume'
  | 'active'
  | 'start-nap'
  | 'start-bedtime';

export type SleepLiveActivityProps = {
  title: string;
  subtitle: string;
  paused: boolean;
  /** Epoch ms — lower bound for the live timer. */
  timerLowerMs: number;
  /** Epoch ms — upper bound (far future for count-up). */
  timerUpperMs: number;
  endLabel: string;
  secondaryLabel: string;
  secondaryTarget: 'pause' | 'resume';
  endTarget: 'end';
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Opens Home; actions are handled by Linking, not Expo Router screens. */
export const SLEEP_LIVE_ACTIVITY_URL = 'relaxo:///';

export function sleepActionUrl(action: SleepDeepLinkAction): string {
  if (action === 'active') return SLEEP_LIVE_ACTIVITY_URL;
  return `${SLEEP_LIVE_ACTIVITY_URL}?sleepAction=${action}`;
}

export function buildSleepLiveActivityProps(input: {
  ongoing: SleepEvent;
  pauses: SleepPause[];
  locale: AppLocale;
}): SleepLiveActivityProps {
  const lang = resolveLocale(input.locale);
  const openPause = getOngoingPause(input.pauses, input.ongoing.id);
  const paused = openPause != null;
  const typeLabel =
    input.ongoing.type === 'night'
      ? translate('home.bedtime', lang)
      : translate('home.nap', lang);

  const sleepStart = new Date(input.ongoing.startTime);
  const now = Date.now();

  let timerLowerMs: number;
  if (paused && openPause) {
    timerLowerMs = new Date(openPause.startTime).getTime();
  } else {
    timerLowerMs = getCurrentSegmentStart(
      sleepStart,
      input.ongoing.id,
      input.pauses
    ).getTime();
  }

  return {
    title: paused ? translate('home.babyAwake', lang) : typeLabel,
    subtitle: paused
      ? translate('home.awakeSince', lang)
      : translate('home.sleepingFor', lang),
    paused,
    timerLowerMs,
    timerUpperMs: now + YEAR_MS,
    endLabel: translate('home.liveEnd', lang),
    secondaryLabel: paused
      ? translate('home.liveResume', lang)
      : translate('home.livePause', lang),
    secondaryTarget: paused ? 'resume' : 'pause',
    endTarget: 'end',
  };
}

function isSleepAction(value: string): value is SleepDeepLinkAction {
  return (
    value === 'end' ||
    value === 'pause' ||
    value === 'resume' ||
    value === 'active' ||
    value === 'start-nap' ||
    value === 'start-bedtime'
  );
}

export function parseSleepLiveActivityAction(url: string): SleepDeepLinkAction | null {
  try {
    // Preferred: relaxo:///?sleepAction=start-nap
    const queryMatch = url.match(/[?&]sleepAction=([^&]+)/i);
    if (queryMatch?.[1]) {
      const action = decodeURIComponent(queryMatch[1]);
      return isSleepAction(action) ? action : null;
    }

    // Tap-through home open (no action)
    if (/^relaxo:\/\/\/?$/i.test(url.trim())) {
      return 'active';
    }

    // Legacy: relaxo://sleep/start-nap (caused "screen doesn't exist")
    const normalized = url.replace(/^relaxo:\/\//i, '');
    const parts = normalized.split(/[/?#]/).filter(Boolean);
    if (parts[0] !== 'sleep') return null;
    const action = parts[1] ?? 'active';
    return isSleepAction(action) ? action : null;
  } catch {
    return null;
  }
}
