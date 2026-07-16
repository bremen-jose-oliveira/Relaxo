import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { DayContextTag } from '@/types';

export const DAY_CONTEXT_TAG_ORDER: DayContextTag[] = [
  'quiet_home',
  'outing',
  'park',
  'visitors',
  'cafe',
  'shopping',
  'car',
  'transit',
  'baby_class',
  'travel',
  'sick',
  'teething',
  'vaccination',
];

export function DayContextChips({
  selected,
  onToggle,
  t,
}: {
  selected: Set<DayContextTag>;
  onToggle: (tag: DayContextTag) => void;
  t: (key: string) => string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('history.dayTagsHint')}
      </Text>
      <View style={styles.row}>
        {DAY_CONTEXT_TAG_ORDER.map((tag) => {
          const on = selected.has(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => onToggle(tag)}
              style={[
                styles.chip,
                {
                  borderColor: on ? colors.tint : colors.border,
                  backgroundColor: on ? colors.tint : colors.card,
                },
              ]}>
              <Text
                style={[
                  styles.chipText,
                  { color: on ? '#FFFFFF' : colors.text },
                ]}>
                {t(`dayTags.${tag}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  hint: { fontSize: 13, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: touchTarget.minHeight * 0.7,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
});
