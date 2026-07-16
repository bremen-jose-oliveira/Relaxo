import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { NapEval } from '@/lib/sleepInsights';

const EVAL_LABEL_KEY: Record<NapEval, string> = {
  longer: 'history.napLonger',
  around: 'history.napAround',
  shorter: 'history.napShorter',
};

export function NapEvalDot({
  eval: napEval,
  t,
}: {
  eval: NapEval;
  t: (key: string) => string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const tone =
    napEval === 'longer'
      ? colors.confidence.high
      : napEval === 'shorter'
        ? colors.confidence.low
        : colors.confidence.medium;

  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {t(EVAL_LABEL_KEY[napEval])}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12 },
});
