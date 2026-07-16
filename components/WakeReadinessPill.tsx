import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { WakeReadiness } from '@/lib/sleepInsights';

export function WakeReadinessPill({
  readiness,
  t,
}: {
  readiness: WakeReadiness;
  t: (key: string) => string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tone =
    readiness === 'rested'
      ? colors.confidence.high
      : readiness === 'prepare'
        ? colors.confidence.medium
        : colors.confidence.low;

  const labelKey =
    readiness === 'rested'
      ? 'home.readinessRested'
      : readiness === 'prepare'
        ? 'home.readinessPrepare'
        : 'home.readinessReady';

  return (
    <View style={[styles.pill, { backgroundColor: tone + '22', borderColor: tone }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.label, { color: colors.text }]}>{t(labelKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 14, fontWeight: '600' },
});
