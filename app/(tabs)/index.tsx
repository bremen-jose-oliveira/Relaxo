import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { FeedingLogModal } from '@/components/FeedingLogModal';
import { DiaperLogModal } from '@/components/DiaperLogModal';
import {
  useAppStore,
  useActiveBaby,
  useOngoingSleep,
  useOngoingFeeding,
  useIsSleepPaused,
  useMorningWakeToday,
} from '@/store/useAppStore';
import { getOngoingPause } from '@/lib/sleepPauses';
import { SleepTimer } from '@/components/SleepTimer';
import { formatNapScheduleLabel } from '@/lib/napSchedule';
import { formatTime } from '@/lib/dateUtils';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const initialize = useAppStore((s) => s.initialize);
  const isInitialized = useAppStore((s) => s.isInitialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const prediction = useAppStore((s) => s.prediction);
  const startSleep = useAppStore((s) => s.startSleep);
  const endSleep = useAppStore((s) => s.endSleep);
  const pauseSleep = useAppStore((s) => s.pauseSleep);
  const resumeSleep = useAppStore((s) => s.resumeSleep);
  const startDay = useAppStore((s) => s.startDay);
  const sleepPauses = useAppStore((s) => s.sleepPauses);

  const baby = useActiveBaby();
  const ongoing = useOngoingSleep();
  const isPaused = useIsSleepPaused();
  const morningWake = useMorningWakeToday();
  const ongoingFeed = useOngoingFeeding();
  const router = useRouter();
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const addDiaper = useAppStore((s) => s.addDiaper);

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
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Welcome to Relaxo</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Set up your baby's profile to start tracking sleep and getting nap predictions.
          </Text>
          <BigButton
            title="Set up baby profile"
            style={{ marginTop: spacing.xl, width: '100%' }}
            onPress={() => router.push('/profile')}
          />
        </View>
      </SafeAreaView>
    );
  }

  const openPause = ongoing ? getOngoingPause(sleepPauses, ongoing.id) : null;

  const statusColor = ongoing ? (isPaused ? colors.wake : colors.asleep) : colors.awake;
  const statusText = ongoing
    ? isPaused && openPause
      ? `Paused since ${formatTime(new Date(openPause.startTime))}`
      : `Asleep since ${formatTime(new Date(ongoing.startTime))}`
    : prediction
      ? `Awake · next ${prediction.slotLabel}`
      : 'Awake';

  const sleepType = ongoing?.type ?? 'nap';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <View style={styles.body}>
        <View style={styles.centerBlock}>
          <View style={styles.hero}>
            <Text style={[styles.babyName, { color: colors.text }]}>{baby.name}</Text>

            <View style={[styles.statusPill, { backgroundColor: statusColor + '44' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: colors.text }]}>{statusText}</Text>
            </View>

            {morningWake && !ongoing && (
              <Text style={[styles.dayStarted, { color: colors.textSecondary }]}>
                Day started at {formatTime(new Date(morningWake.time))}
              </Text>
            )}

            {prediction && !ongoing && (
              <Card style={styles.heroCard}>
                <Text style={[styles.predictionLabel, { color: colors.textSecondary }]}>
                  Predicted {prediction.slotLabel}
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
                    ? 'Tap Resume when baby is back asleep'
                    : `Started at ${formatTime(new Date(ongoing.startTime))}`}
                </Text>
              </Card>
            )}
          </View>

          <View style={styles.actionArea}>
            {ongoing ? (
              <>
                {isPaused ? (
                  <BigButton
                    title="Resume sleep"
                    variant="primary"
                    onPress={() => resumeSleep()}
                    style={{ marginBottom: spacing.md }}
                  />
                ) : (
                  <BigButton
                    title="Pause sleep"
                    variant="secondary"
                    onPress={() => pauseSleep()}
                    style={{ marginBottom: spacing.md }}
                  />
                )}
                <BigButton title="End sleep" variant="primary" onPress={() => endSleep()} />
              </>
            ) : (
              <>
                {!morningWake && (
                  <BigButton
                    title="Start day"
                    variant="primary"
                    onPress={() => startDay()}
                    style={{ marginBottom: spacing.md }}
                  />
                )}
                <BigButton
                  title="Start nap"
                  variant={morningWake ? 'primary' : 'secondary'}
                  onPress={() => startSleep('nap')}
                  style={{ marginBottom: spacing.md }}
                />
                <BigButton
                  title="Start bedtime"
                  variant="secondary"
                  onPress={() => startSleep('night')}
                />
              </>
            )}
          </View>

          {(ongoing || ongoingFeed) && (
            <View style={styles.hints}>
              {ongoing && (
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  Logging as {sleepType === 'night' ? 'bedtime' : 'nap'}
                </Text>
              )}
              {ongoingFeed && (
                <Text style={[styles.hintText, { color: colors.feeding }]}>
                  Breastfeeding since {formatTime(new Date(ongoingFeed.startTime))}
                </Text>
              )}
            </View>
          )}
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
            <Text style={[styles.quickBtnText, { color: colors.text }]}>Log feeding</Text>
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
            <Text style={[styles.quickBtnText, { color: colors.text }]}>Log diaper</Text>
          </Pressable>
        </View>
      </View>

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
    </SafeAreaView>
  );
}

const CONTENT_MAX_WIDTH = 400;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
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
  dayStarted: {
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  heroCard: {
    width: '100%',
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
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
  quickLogRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexShrink: 0,
  },
  quickBtn: {
    flex: 1,
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
