import type { SleepDeepLinkAction } from '@/lib/sleepLiveActivityProps';
import type { SleepHomeWidgetProps } from '@/lib/sleepHomeWidget';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type SleepWidgetAction = Exclude<SleepDeepLinkAction, 'active'>;
export type SleepWidgetInteraction = SleepWidgetAction | 'sync';

/** Optimistic widget props after a button tap (partial merge into current props). */
export function optimisticSleepHomeWidgetProps(
  props: SleepHomeWidgetProps,
  action: SleepWidgetInteraction
): Partial<SleepHomeWidgetProps> {
  const now = Date.now();
  const pending = { pendingAction: action, pendingActionAt: now };

  if (action === 'sync') {
    // Keep sleep state; flash a syncing subtitle until the Intent refreshes from cloud.
    return {
      ...pending,
      subtitle: props.labelSync || 'Sync',
    };
  }

  if (action === 'start-nap' || action === 'start-bedtime') {
    const isNight = action === 'start-bedtime';
    return {
      ...pending,
      asleep: true,
      paused: false,
      statusTone: 'asleep',
      title: isNight ? props.labelBedtime : props.labelNap,
      subtitle: props.labelSleepingFor,
      showTimer: true,
      timerLowerMs: now,
      timerUpperMs: now + YEAR_MS,
      primaryLabel: props.labelEnd,
      primaryTarget: 'end',
      secondaryLabel: props.labelPause,
      secondaryTarget: 'pause',
      showPrediction: false,
      predictionLabel: '',
      predictionTime: '',
      showReadiness: false,
      readinessLabel: '',
      readinessTone: 'none',
    };
  }

  if (action === 'end') {
    return {
      ...pending,
      asleep: false,
      paused: false,
      statusTone: 'awake',
      title: props.babyName || props.title,
      subtitle: props.labelAwake,
      showTimer: true,
      timerLowerMs: now,
      timerUpperMs: now + YEAR_MS,
      primaryLabel: props.labelStartNap,
      primaryTarget: 'start-nap',
      secondaryLabel: props.labelStartBedtime,
      secondaryTarget: 'start-bedtime',
      showPrediction: false,
      showReadiness: false,
      readinessLabel: '',
      readinessTone: 'none',
    };
  }

  if (action === 'pause') {
    return {
      ...pending,
      paused: true,
      asleep: true,
      statusTone: 'paused',
      title: props.labelBabyAwake,
      subtitle: props.labelAwakeSince,
      showTimer: true,
      timerLowerMs: now,
      timerUpperMs: now + YEAR_MS,
      primaryLabel: props.labelEnd,
      primaryTarget: 'end',
      secondaryLabel: props.labelResume,
      secondaryTarget: 'resume',
      showPrediction: false,
      showReadiness: false,
    };
  }

  return {
    ...pending,
    paused: false,
    asleep: true,
    statusTone: 'asleep',
    title: props.title === props.labelBabyAwake ? props.labelNap : props.title,
    subtitle: props.labelSleepingFor,
    showTimer: true,
    timerLowerMs: now,
    timerUpperMs: now + YEAR_MS,
    primaryLabel: props.labelEnd,
    primaryTarget: 'end',
    secondaryLabel: props.labelPause,
    secondaryTarget: 'pause',
    showPrediction: false,
    showReadiness: false,
  };
}
