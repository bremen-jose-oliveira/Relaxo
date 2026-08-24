import type { SleepHomeWidgetProps } from '@/lib/sleepHomeWidget';

/** Compact payload mirrored to Apple Watch via WatchConnectivity + App Group. */
export type WatchSleepSnapshot = {
  v: 1;
  updatedAt: number;
  statusTone: SleepHomeWidgetProps['statusTone'];
  title: string;
  subtitle: string;
  asleep: boolean;
  paused: boolean;
  showTimer: boolean;
  timerLowerMs: number;
  showPrediction: boolean;
  predictionTime: string;
  predictionLabel: string;
  readinessLabel: string;
  babyName: string;
  primaryLabel: string;
  primaryTarget: string;
  secondaryLabel: string;
  secondaryTarget: string;
};

export function buildWatchSleepSnapshot(
  props: SleepHomeWidgetProps,
  babyName?: string | null
): WatchSleepSnapshot {
  return {
    v: 1,
    updatedAt: Date.now(),
    statusTone: props.statusTone,
    title: props.title,
    subtitle: props.subtitle,
    asleep: props.asleep,
    paused: props.paused,
    showTimer: props.showTimer,
    timerLowerMs: props.timerLowerMs,
    showPrediction: props.showPrediction,
    predictionTime: props.predictionTime,
    predictionLabel: props.predictionLabel,
    readinessLabel: props.readinessLabel,
    babyName: babyName?.trim() || props.title || 'Relaxo',
    primaryLabel: props.primaryLabel,
    primaryTarget: props.primaryTarget,
    secondaryLabel: props.secondaryLabel,
    secondaryTarget: props.secondaryTarget,
  };
}
