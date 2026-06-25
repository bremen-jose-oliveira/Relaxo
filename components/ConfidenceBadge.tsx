import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  confidence: 'low' | 'medium' | 'high';
  style?: ViewStyle;
};

const LABELS = {
  low: 'Learning',
  medium: 'Getting there',
  high: 'Confident',
};

export function ConfidenceBadge({ confidence, style }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.confidence[confidence] + '33' },
        style,
      ]}>
      <View style={[styles.dot, { backgroundColor: colors.confidence[confidence] }]} />
      <Text style={[styles.text, { color: colors.confidence[confidence] }]}>
        {LABELS[confidence]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
});
