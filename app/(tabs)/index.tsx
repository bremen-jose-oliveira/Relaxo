import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { AgeInsightCard } from '@/components/AgeInsightCard';
import { WakeReadinessPill } from '@/components/WakeReadinessPill';
import { NapExtensionSheet } from '@/components/NapExtensionSheet';
import { SleepContextSheet } from '@/components/SleepContextSheet';
import { FeedingLogModal } from '@/components/FeedingLogModal';
import { DiaperLogModal } from '@/components/DiaperLogModal';
import { BathLogModal } from '@/components/BathLogModal';
import { DayContextChips } from '@/components/DayContextChips';
import {
  useAppStore,
  useActiveBaby,
  useOngoingSleep,
  useOngoingFeeding,
  useIsSleepPaused,
} from '@/store/useAppStore';
import { getCurrentSegmentStart } from '@/lib/elapsedTime';
import { getOngoingPause } from '@/lib/sleepPauses';
import { SleepTimer } from '@/components/SleepTimer';
import { formatNapScheduleLabel, resolveNapGoal } from '@/lib/napSchedule';
import { ageInWeeks, formatDateKey, formatTime, minutesBetween } from '@/lib/dateUtils';
import { resolveLocale, useTranslation } from '@/lib/i18n';
import {
  formatBabyAge,
  getWakeReadiness,
} from '@/lib/sleepInsights';
import {
  formatDayContextLabelList,
  shouldExplainDayContext,
  shouldSuggestCalmWindow,
  tagsForDate,
} from '@/lib/dayContext';
import {
  getAgeDefaultMidpoint,
  getLastWakeUpTime,
  getPersonalAverageForSlot,
} from '@/lib/predictNextSleep';
import { useRouter } from 'expo-router';
import type {
  DayContextTag,
  NapExtension,
} from '@/types';
import type { SleepContextSelection } from '@/components/SleepContextSheet';
import { useAuthStore } from '@/store/useAuthStore';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const resolvedLang = resolveLocale(locale);

  const initialize = useAppStore((s) => s.initialize);
  const isInitialized = useAppStore((s) => s.isInitialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const prediction = useAppStore((s) => s.prediction);
  const startSleep = useAppStore((s) => s.startSleep);
  const endSleep = useAppStore((s) => s.endSleep);
  const setSleepExtension = useAppStore((s) => s.setSleepExtension);
  const setSleepContext = useAppStore((s) => s.setSleepContext);
  const pauseSleep = useAppStore((s) => s.pauseSleep);
  const resumeSleep = useAppStore((s) => s.resumeSleep);
  const endBreastFeed = useAppStore((s) => s.endBreastFeed);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const events = useAppStore((s) => s.events);
  const wakes = useAppStore((s) => s.wakes);
  const householdId = useAuthStore((s) => s.householdId);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const lastSyncError = useAuthStore((s) => s.lastSyncError);
  const isSyncing = useAuthStore((s) => s.isSyncing);
  const dayContextTags = useAppStore((s) => s.dayContextTags);
  const toggleDayTag = useAppStore((s) => s.toggleDayTag);

  const baby = useActiveBaby();
  const ongoing = useOngoingSleep();
  const isPaused = useIsSleepPaused();
  const ongoingFeed = useOngoingFeeding();
  const trackFeedDuration = baby?.trackFeedingDuration ?? false;
  const router = useRouter();
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const [extensionEventId, setExtensionEventId] = useState<string | null>(null);
  const [contextEventId, setContextEventId] = useState<string | null>(null);
  const [pendingExtensionAfterContext, setPendingExtensionAfterContext] = useState(false);
  const addDiaper = useAppStore((s) => s.addDiaper);
  const addBath = useAppStore((s) => s.addBath);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const now = useMemo(() => new Date(), [events, wakes, ongoing, dayContextTags]);
  const todayKey = formatDateKey(now);

  const todayTags = useMemo(
    () => tagsForDate(dayContextTags, todayKey),
    [dayContextTags, todayKey]
  );
  const todayTagSet = useMemo(() => new Set<DayContextTag>(todayTags), [todayTags]);

  const wakeReadiness = useMemo(() => {
    if (!baby || ongoing) return null;
    const lastWake = getLastWakeUpTime(events, wakes, now);
    if (!lastWake) return null;
    const awakeMinutes = minutesBetween(lastWake, now);
    const slot = prediction?.slot ?? 0;
    const napGoal = prediction?.resolvedNapGoal ?? resolveNapGoal(baby, events, wakes, now).goal;
    const { average } = getPersonalAverageForSlot(events, wakes, slot, now, napGoal);
    const weeks = ageInWeeks(baby.birthDate, now);
    const target = average ?? getAgeDefaultMidpoint(weeks);
    return getWakeReadiness(awakeMinutes, target);
  }, [baby, ongoing, events, wakes, now, prediction]);

  const showDayContextExplain = shouldExplainDayContext({
    tags: todayTags,
    confidence: prediction?.confidence ?? null,
    wakeReadiness,
  });

  const showCalmNudge = shouldSuggestCalmWindow({
    tags: todayTags,
    wakeReadiness,
    easilyOverstimulated: baby?.easilyOverstimulated,
    asleep: ongoing != null,
  });

  const dayContextLabels = formatDayContextLabelList(todayTags, (tag) =>
    t(`dayTags.${tag}`)
  );

  const ageLabel = baby ? formatBabyAge(baby.birthDate, now, resolvedLang) : '';

  const handleEndSleep = async () => {
    const ended = await endSleep();
    if (!ended) return;
    setPendingExtensionAfterContext(ended.type === 'nap');
    setContextEventId(ended.id);
  };

  const finishContextFlow = () => {
    const id = contextEventId;
    const showExtension = pendingExtensionAfterContext;
    setContextEventId(null);
    setPendingExtensionAfterContext(false);
    if (showExtension && id) {
      setExtensionEventId(id);
    }
  };

  const handleContextSave = async (selection: SleepContextSelection) => {
    if (contextEventId) {
      await setSleepContext(contextEventId, selection);
    }
    finishContextFlow();
  };

  const handleExtensionSelect = async (extension: NapExtension) => {
    if (extensionEventId) {
      await setSleepExtension(extensionEventId, extension);
    }
    setExtensionEventId(null);
  };

  if (!isInitialized || isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.welcome')}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('home.welcomeSub')}
          </Text>
          <Text
            style={[
              styles.emptyText,
              { color: colors.textSecondary, marginTop: spacing.md, fontStyle: 'italic' },
            ]}>
            {t('legal.medicalDisclaimer')}
          </Text>
          <BigButton
            title={t('home.setupProfile')}
            style={{ marginTop: spacing.xl, width: '100%' }}
            onPress={() => router.push('/profile')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const openPause = ongoing ? getOngoingPause(sleepPauses, ongoing.id) : null;
  const asleepSinceTime =
    ongoing && !isPaused
      ? getCurrentSegmentStart(
          new Date(ongoing.startTime),
          ongoing.id,
          sleepPauses
        )
      : null;

  const statusColor = ongoing ? (isPaused ? colors.wake : colors.asleep) : colors.awake;
  const statusText = ongoing
    ? isPaused && openPause
      ? t('home.pausedSince', { time: formatTime(new Date(openPause.startTime)) })
      : t('home.asleepSince', {
          time: formatTime(asleepSinceTime ?? new Date(ongoing.startTime)),
        })
    : prediction
      ? t('home.awakeNext', { slot: prediction.slotLabel })
      : t('home.awake');

  const sleepType = ongoing?.type ?? 'nap';
  const sleepTypeLabel = sleepType === 'night' ? t('home.bedtime') : t('home.nap');

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { minHeight: windowHeight - 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.centerBlock}>
          <View style={styles.hero}>
            <Text style={[styles.babyName, { color: colors.text }]}>{baby.name}</Text>
            <Text style={[styles.ageLine, { color: colors.textSecondary }]}>
              {t('home.ageLabel', { age: ageLabel })}
            </Text>
            {householdId ? (
              <Text style={[styles.syncTrust, { color: lastSyncError ? colors.danger : colors.textSecondary }]}>
                {isSyncing
                  ? t('profile.syncStatusSyncing')
                  : lastSyncError
                    ? t('profile.syncStatusFailed')
                    : lastSyncedAt
                      ? t('profile.syncStatusOk', {
                          time: formatTime(new Date(lastSyncedAt)),
                        })
                      : t('profile.syncStatusNever')}
              </Text>
            ) : null}

            <View style={[styles.statusPill, { backgroundColor: statusColor + '44' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: colors.text }]}>{statusText}</Text>
            </View>

            {wakeReadiness && !ongoing ? (
              <WakeReadinessPill readiness={wakeReadiness} t={t} />
            ) : null}

            {showDayContextExplain ? (
              <Text style={[styles.contextExplain, { color: colors.textSecondary }]}>
                {prediction?.confidence === 'low'
                  ? t('home.dayContextExplainLowConfidence', { tags: dayContextLabels })
                  : t('home.dayContextExplain', { tags: dayContextLabels })}
              </Text>
            ) : null}

            {showCalmNudge ? (
              <View
                style={[
                  styles.nudgePill,
                  {
                    backgroundColor: colors.confidence.medium + '22',
                    borderColor: colors.confidence.medium,
                  },
                ]}>
                <Text style={[styles.nudgeText, { color: colors.text }]}>
                  {baby.easilyOverstimulated
                    ? t('home.calmWindowNudgeSensitive')
                    : t('home.calmWindowNudge')}
                </Text>
              </View>
            ) : null}

            {prediction && !ongoing && !ongoingFeed && (
              <Card style={styles.heroCard}>
                <Text style={[styles.predictionLabel, { color: colors.textSecondary }]}>
                  {t('home.predicted', { slot: prediction.slotLabel })}
                </Text>
                <Text style={[styles.predictionTime, { color: colors.text }]}>
                  {formatTime(prediction.predictedTime)}
                </Text>
                <ConfidenceBadge
                  confidence={prediction.confidence}
                  style={{ marginTop: spacing.sm }}
                />
                <Text style={[styles.scheduleHint, { color: colors.textSecondary }]}>
                  {formatNapScheduleLabel({
                    goal: prediction.resolvedNapGoal,
                    source: prediction.napGoalSource,
                  })}
                </Text>
              </Card>
            )}

            {ongoing && (
              <Card style={styles.heroCard}>
                <SleepTimer
                  sleepEventId={ongoing.id}
                  startTime={ongoing.startTime}
                  pauses={sleepPauses}
                  type={ongoing.type}
                  paused={isPaused}
                />
                <Text style={[styles.asleepHint, { color: colors.textSecondary }]}>
                  {isPaused
                    ? t('home.tapResume')
                    : t('home.asleepSince', {
                        time: formatTime(asleepSinceTime ?? new Date(ongoing.startTime)),
                      })}
                </Text>
              </Card>
            )}

            {ongoingFeed && trackFeedDuration && (
              <Card style={styles.heroCard}>
                <Text style={[styles.predictionLabel, { color: colors.textSecondary }]}>
                  {t('home.feedingSince', { time: formatTime(new Date(ongoingFeed.startTime)) })}
                  {ongoingFeed.side ? ` · ${ongoingFeed.side}` : ''}
                </Text>
              </Card>
            )}
          </View>

          <View style={styles.actionArea}>
            {ongoing ? (
              <>
                {isPaused ? (
                  <BigButton
                    title={t('home.resumeSleep')}
                    variant="primary"
                    onPress={() => resumeSleep()}
                    style={{ marginBottom: spacing.md }}
                  />
                ) : (
                  <BigButton
                    title={t('home.pauseSleep')}
                    variant="secondary"
                    onPress={() => pauseSleep()}
                    style={{ marginBottom: spacing.md }}
                  />
                )}
                <BigButton title={t('home.endSleep')} variant="primary" onPress={() => void handleEndSleep()} />
              </>
            ) : ongoingFeed && trackFeedDuration ? (
              <BigButton title={t('home.endFeeding')} variant="primary" onPress={() => endBreastFeed()} />
            ) : (
              <>
                <BigButton
                  title={t('home.startNap')}
                  variant="primary"
                  onPress={() => startSleep('nap')}
                  style={{ marginBottom: spacing.md }}
                />
                <BigButton
                  title={t('home.startBedtime')}
                  variant="secondary"
                  onPress={() => startSleep('night')}
                />
              </>
            )}
          </View>

          {ongoing && (
            <View style={styles.hints}>
              <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                {t('home.loggingAs', { type: sleepTypeLabel })}
              </Text>
            </View>
          )}

          <Card style={styles.contextCard}>
            <Text style={[styles.contextTitle, { color: colors.text }]}>
              {t('home.dayContextTitle')}
            </Text>
            <Text style={[styles.contextHint, { color: colors.textSecondary }]}>
              {t('home.dayContextHint')}
            </Text>
            <DayContextChips
              compact
              selected={todayTagSet}
              onToggle={(tag) => {
                void toggleDayTag(todayKey, tag);
              }}
              t={t}
            />
          </Card>
        </View>

        <View style={[styles.insightWrap, { borderTopColor: colors.border }]}>
          <AgeInsightCard
            birthDate={baby.birthDate}
            events={events}
            wakes={wakes}
            easilyOverstimulated={baby.easilyOverstimulated}
            highNeed={baby.highNeed}
            locale={locale}
            t={t}
          />
        </View>

        <View style={styles.quickLogRow}>
          <Pressable
            onPress={() => setFeedingOpen(true)}
            style={({ pressed }) => [
              styles.quickBtn,
              {
                backgroundColor: colors.feeding + '33',
                borderColor: colors.feeding,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.quickBtnText, { color: colors.text }]}>{t('home.logFeeding')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDiaperOpen(true)}
            style={({ pressed }) => [
              styles.quickBtn,
              {
                backgroundColor: colors.diaper + '33',
                borderColor: colors.diaper,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.quickBtnText, { color: colors.text }]}>{t('home.logDiaper')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setBathOpen(true)}
            style={({ pressed }) => [
              styles.quickBtn,
              {
                backgroundColor: colors.bath + '33',
                borderColor: colors.bath,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.quickBtnText, { color: colors.text }]}>{t('home.logBath')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <FeedingLogModal
        visible={feedingOpen}
        babyId={baby.id}
        onClose={() => setFeedingOpen(false)}
      />
      <DiaperLogModal
        visible={diaperOpen}
        babyId={baby.id}
        onSave={async (payload) => {
          await addDiaper(payload);
          setDiaperOpen(false);
        }}
        onClose={() => setDiaperOpen(false)}
      />
      <BathLogModal
        visible={bathOpen}
        babyId={baby.id}
        onSave={async (payload) => {
          await addBath(payload);
          setBathOpen(false);
        }}
        onClose={() => setBathOpen(false)}
      />
      <SleepContextSheet
        visible={contextEventId != null}
        onSave={(selection) => void handleContextSave(selection)}
        onSkip={finishContextFlow}
        t={t}
      />
      <NapExtensionSheet
        visible={extensionEventId != null}
        onSelect={(ext) => void handleExtensionSelect(ext)}
        onSkip={() => setExtensionEventId(null)}
        t={t}
      />
    </SafeAreaView>
  );
}

const CONTENT_MAX_WIDTH = 400;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingBottom: spacing.lg,
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  babyName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  ageLine: {
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  syncTrust: {
    fontSize: 12,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    marginBottom: spacing.sm,
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroCard: {
    width: '100%',
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  contextCard: {
    width: '100%',
    marginTop: spacing.md,
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  contextHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  contextExplain: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  nudgePill: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '100%',
  },
  nudgeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  predictionLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  predictionTime: {
    fontSize: 52,
    fontWeight: '300',
    letterSpacing: -2,
    textAlign: 'center',
  },
  scheduleHint: {
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  asleepHint: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.sm,
  },
  actionArea: {
    width: '100%',
  },
  hints: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  hintText: {
    textAlign: 'center',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    width: '100%',
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  insightWrap: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  quickLogRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  quickBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: '30%',
    minHeight: touchTarget.minHeight,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  quickBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
