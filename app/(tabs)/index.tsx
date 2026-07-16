import { useEffect, useState } from 'react';
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
import { FeedingLogModal } from '@/components/FeedingLogModal';
import { DiaperLogModal } from '@/components/DiaperLogModal';
import { BathLogModal } from '@/components/BathLogModal';
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
import { getTypicalSleepSchedule } from '@/lib/sleepPatterns';
import { UsualSleepTimes } from '@/components/UsualSleepTimes';
import { formatTime } from '@/lib/dateUtils';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);

  const initialize = useAppStore((s) => s.initialize);
  const isInitialized = useAppStore((s) => s.isInitialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const prediction = useAppStore((s) => s.prediction);
  const startSleep = useAppStore((s) => s.startSleep);
  const endSleep = useAppStore((s) => s.endSleep);
  const pauseSleep = useAppStore((s) => s.pauseSleep);
  const resumeSleep = useAppStore((s) => s.resumeSleep);
  const endBreastFeed = useAppStore((s) => s.endBreastFeed);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const events = useAppStore((s) => s.events);
  const wakes = useAppStore((s) => s.wakes);

  const baby = useActiveBaby();
  const ongoing = useOngoingSleep();
  const isPaused = useIsSleepPaused();
  const ongoingFeed = useOngoingFeeding();
  const trackFeedDuration = baby?.trackFeedingDuration ?? false;
  const router = useRouter();
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const addDiaper = useAppStore((s) => s.addDiaper);
  const addBath = useAppStore((s) => s.addBath);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    initialize();
  }, [initialize]);

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

  const napGoal =
    prediction?.resolvedNapGoal ??
    resolveNapGoal(baby, events, wakes, new Date()).goal;
  const usualSchedule = getTypicalSleepSchedule(events, wakes, new Date(), napGoal);

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

            <View style={[styles.statusPill, { backgroundColor: statusColor + '44' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: colors.text }]}>{statusText}</Text>
            </View>

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
                <BigButton title={t('home.endSleep')} variant="primary" onPress={() => endSleep()} />
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

          {usualSchedule.length > 0 ? (
            <Card style={styles.usualCard}>
              <UsualSleepTimes
                schedule={usualSchedule}
                title={t('home.usualTimes')}
                subtitle={t('history.usualTimesSub')}
                colors={colors}
              />
            </Card>
          ) : null}
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
    marginBottom: spacing.md,
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
  usualCard: {
    width: '100%',
    marginTop: spacing.md,
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
