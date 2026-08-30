import { Platform } from 'react-native';

import { ageInWeeks, formatTime, minutesBetween } from '@/lib/dateUtils';
import { getCurrentSegmentStart } from '@/lib/elapsedTime';
import { resolveLocale, translate } from '@/lib/i18n';
import { resolveNapGoal } from '@/lib/napSchedule';
import {
  getAgeDefaultMidpoint,
  getLastWakeUpTime,
  getPersonalAverageForSlot,
  type PredictResult,
} from '@/lib/predictNextSleep';
import type { SleepWidgetAction } from '@/lib/sleepWidgetOptimistic';
import { getOngoingPause } from '@/lib/sleepPauses';
import { getWakeReadiness, type WakeReadiness } from '@/lib/sleepInsights';
import type { AppLocale, Baby, SleepEvent, SleepPause, WakeEvent } from '@/types';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export type SleepHomeWidgetStatusTone = 'awake' | 'asleep' | 'paused';
export type SleepHomeWidgetReadinessTone = WakeReadiness | 'none';

export type SleepHomeWidgetProps = {
  title: string;
  subtitle: string;
  /** Stable baby name (title changes while asleep). */
  babyName: string;
  paused: boolean;
  asleep: boolean;
  statusTone: SleepHomeWidgetStatusTone;
  showTimer: boolean;
  timerLowerMs: number;
  timerUpperMs: number;
  primaryLabel: string;
  primaryTarget: SleepWidgetAction;
  secondaryLabel: string;
  secondaryTarget: SleepWidgetAction;
  showPrediction: boolean;
  predictionLabel: string;
  predictionTime: string;
  showReadiness: boolean;
  readinessLabel: string;
  readinessTone: SleepHomeWidgetReadinessTone;
  /** Labels for optimistic button transitions inside the widget process. */
  labelNap: string;
  labelBedtime: string;
  labelEnd: string;
  labelPause: string;
  labelResume: string;
  labelSleepingFor: string;
  labelAwakeSince: string;
  labelBabyAwake: string;
  labelStartNap: string;
  labelStartBedtime: string;
  labelAwake: string;
  labelSync: string;
  /** Pending action written by widget Button onPress; '' when none. */
  pendingAction: string;
  pendingActionAt: number;
};

function readinessLabelFor(
  readiness: WakeReadiness,
  lang: 'en' | 'de'
): string {
  if (readiness === 'rested') return translate('home.widgetReadinessRested', lang);
  if (readiness === 'prepare') return translate('home.widgetReadinessPrepare', lang);
  return translate('home.widgetReadinessReady', lang);
}

function sharedLabels(lang: 'en' | 'de'): Pick<
  SleepHomeWidgetProps,
  | 'labelNap'
  | 'labelBedtime'
  | 'labelEnd'
  | 'labelPause'
  | 'labelResume'
  | 'labelSleepingFor'
  | 'labelAwakeSince'
  | 'labelBabyAwake'
  | 'labelStartNap'
  | 'labelStartBedtime'
  | 'labelAwake'
  | 'labelSync'
> {
  return {
    labelNap: translate('home.nap', lang),
    labelBedtime: translate('home.bedtime', lang),
    labelEnd: translate('home.liveEnd', lang),
    labelPause: translate('home.livePause', lang),
    labelResume: translate('home.liveResume', lang),
    labelSleepingFor: translate('home.sleepingFor', lang),
    labelAwakeSince: translate('home.awakeSince', lang),
    labelBabyAwake: translate('home.babyAwake', lang),
    labelStartNap: translate('home.liveStartNap', lang),
    labelStartBedtime: translate('home.liveStartBedtime', lang),
    labelAwake: translate('home.awake', lang),
    labelSync: translate('home.widgetSync', lang),
  };
}

function computeAwakeExtras(input: {
  events: SleepEvent[];
  wakes: WakeEvent[];
  prediction: PredictResult | null;
  baby: Baby | null;
  locale: 'en' | 'de';
  now: Date;
}): Pick<
  SleepHomeWidgetProps,
  | 'showTimer'
  | 'timerLowerMs'
  | 'showPrediction'
  | 'predictionLabel'
  | 'predictionTime'
  | 'showReadiness'
  | 'readinessLabel'
  | 'readinessTone'
  | 'subtitle'
> {
  const lastWake = getLastWakeUpTime(input.events, input.wakes, input.now);
  const prediction = input.prediction;

  let showReadiness = false;
  let readinessLabel = '';
  let readinessTone: SleepHomeWidgetReadinessTone = 'none';

  if (input.baby && lastWake) {
    const awakeMinutes = minutesBetween(lastWake, input.now);
    const slot = prediction?.slot ?? 0;
    const napGoal =
      prediction?.resolvedNapGoal ??
      resolveNapGoal(input.baby, input.events, input.wakes, input.now).goal;
    const { average } = getPersonalAverageForSlot(
      input.events,
      input.wakes,
      slot,
      input.now,
      napGoal
    );
    const weeks = ageInWeeks(input.baby.birthDate, input.now);
    const target = average ?? getAgeDefaultMidpoint(weeks);
    const readiness = getWakeReadiness(awakeMinutes, target);
    showReadiness = true;
    readinessLabel = readinessLabelFor(readiness, input.locale);
    readinessTone = readiness;
  }

  return {
    showTimer: lastWake != null,
    timerLowerMs: lastWake?.getTime() ?? input.now.getTime(),
    showPrediction: prediction != null,
    predictionLabel: prediction
      ? translate('home.predicted', input.locale, { slot: prediction.slotLabel })
      : '',
    predictionTime: prediction ? formatTime(prediction.predictedTime) : '',
    showReadiness,
    readinessLabel,
    readinessTone,
    subtitle: prediction
      ? translate('home.awakeNext', input.locale, { slot: prediction.slotLabel })
      : translate('home.awake', input.locale),
  };
}

export function buildSleepHomeWidgetProps(input: {
  ongoing: SleepEvent | null;
  pauses: SleepPause[];
  events?: SleepEvent[];
  wakes?: WakeEvent[];
  prediction?: PredictResult | null;
  baby?: Baby | null;
  locale: AppLocale;
  babyName?: string | null;
}): SleepHomeWidgetProps {
  const lang = resolveLocale(input.locale);
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const babyName = input.babyName?.trim() || 'Relaxo';
  const events = input.events ?? [];
  const wakes = input.wakes ?? [];
  const prediction = input.prediction ?? null;
  const baby = input.baby ?? null;
  const labels = sharedLabels(lang);

  if (!input.ongoing) {
    const awake = computeAwakeExtras({
      events,
      wakes,
      prediction,
      baby,
      locale: lang,
      now,
    });

    return {
      title: babyName,
      babyName,
      subtitle: awake.subtitle,
      paused: false,
      asleep: false,
      statusTone: 'awake',
      showTimer: awake.showTimer,
      timerLowerMs: awake.timerLowerMs,
      timerUpperMs: nowMs + YEAR_MS,
      primaryLabel: labels.labelStartNap,
      primaryTarget: 'start-nap',
      secondaryLabel: labels.labelStartBedtime,
      secondaryTarget: 'start-bedtime',
      showPrediction: awake.showPrediction,
      predictionLabel: awake.predictionLabel,
      predictionTime: awake.predictionTime,
      showReadiness: awake.showReadiness,
      readinessLabel: awake.readinessLabel,
      readinessTone: awake.readinessTone,
      ...labels,
      pendingAction: '',
      pendingActionAt: 0,
    };
  }

  const openPause = getOngoingPause(input.pauses, input.ongoing.id);
  const paused = openPause != null;
  const typeLabel =
    input.ongoing.type === 'night' ? labels.labelBedtime : labels.labelNap;
  const sleepStart = new Date(input.ongoing.startTime);

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
    title: paused ? labels.labelBabyAwake : typeLabel,
    babyName,
    subtitle: paused ? labels.labelAwakeSince : labels.labelSleepingFor,
    paused,
    asleep: true,
    statusTone: paused ? 'paused' : 'asleep',
    showTimer: true,
    timerLowerMs,
    timerUpperMs: nowMs + YEAR_MS,
    primaryLabel: labels.labelEnd,
    primaryTarget: 'end',
    secondaryLabel: paused ? labels.labelResume : labels.labelPause,
    secondaryTarget: paused ? 'resume' : 'pause',
    showPrediction: false,
    predictionLabel: '',
    predictionTime: '',
    showReadiness: false,
    readinessLabel: '',
    readinessTone: 'none',
    ...labels,
    pendingAction: '',
    pendingActionAt: 0,
  };
}

/** Push current sleep state into the Home Screen widget + Watch complication. */
export function syncSleepHomeWidget(input: {
  ongoing: SleepEvent | null;
  pauses: SleepPause[];
  events?: SleepEvent[];
  wakes?: WakeEvent[];
  prediction?: PredictResult | null;
  baby?: Baby | null;
  locale: AppLocale;
  babyName?: string | null;
}): void {
  if (Platform.OS !== 'ios') return;

  try {
    const props = buildSleepHomeWidgetProps(input);
    const SleepHomeWidget =
      require('@/widgets/SleepHomeWidget').default as typeof import('@/widgets/SleepHomeWidget').default;
    SleepHomeWidget.updateSnapshot(props);

    const { buildWatchSleepSnapshot } =
      require('@/lib/watchSnapshot') as typeof import('@/lib/watchSnapshot');
    const { setWatchSnapshot } =
      require('@/modules/widget-bridge') as typeof import('@/modules/widget-bridge');
    setWatchSnapshot(
      JSON.stringify(buildWatchSleepSnapshot(props, input.babyName ?? props.title))
    );
  } catch (error) {
    console.warn('[sleepHomeWidget] sync failed', error);
  }
}
