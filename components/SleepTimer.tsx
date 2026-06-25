import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSleepElapsedClock } from '@/components/useElapsedClock';
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
  const elapsed = useSleepElapsedClock(true, sleepEventId, startTime, pauses);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {paused ? 'Paused · ' : ''}
        {type === 'night' ? 'Bedtime' : 'Nap'}
      </Text>
      <Text style={[styles.clock, { color: colors.text }]}>{elapsed}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        {paused ? 'Timer paused' : 'Time asleep'}
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
