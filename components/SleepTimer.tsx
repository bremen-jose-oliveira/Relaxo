import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSleepTimerDisplay } from '@/components/useElapsedClock';
import { useTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import type { SleepPause } from '@/types';

type Props = {
  sleepEventId: string;
  startTime: string;
  pauses: SleepPause[];
  type: 'nap' | 'night';
  paused: boolean;
};

export function SleepTimer({ sleepEventId, startTime, pauses, type, paused }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const { segmentClock, totalClock, showTotalLine, paused: isPausedDisplay } =
    useSleepTimerDisplay(true, sleepEventId, startTime, pauses, paused);

  const typeLabel = type === 'night' ? t('home.bedtime') : t('home.nap');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {isPausedDisplay ? t('home.babyAwake') : typeLabel}
      </Text>
      <Text style={[styles.clock, { color: colors.text }]}>{segmentClock}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {isPausedDisplay
          ? t('home.asleepBeforeWaking', { time: totalClock })
          : showTotalLine
            ? t('home.totalAsleep', { time: totalClock })
            : t('home.sleepingFor')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  clock: {
    fontSize: 56,
    fontWeight: '300',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
