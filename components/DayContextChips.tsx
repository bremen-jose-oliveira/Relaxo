import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
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

type TagIcon = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

const DAY_CONTEXT_ICONS: Record<DayContextTag, TagIcon> = {
  quiet_home: { ios: 'house.fill', android: 'home', web: 'home' },
  outing: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  park: { ios: 'tree.fill', android: 'park', web: 'park' },
  visitors: { ios: 'person.2.fill', android: 'group', web: 'group' },
  cafe: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
  shopping: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  car: { ios: 'car.fill', android: 'directions_car', web: 'directions_car' },
  transit: { ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' },
  baby_class: {
    ios: 'figure.and.child.holdinghands',
    android: 'child_care',
    web: 'child_care',
  },
  travel: { ios: 'airplane', android: 'flight', web: 'flight' },
  sick: { ios: 'cross.case.fill', android: 'medical_services', web: 'medical_services' },
  teething: { ios: 'mouth.fill', android: 'sentiment_satisfied', web: 'sentiment_satisfied' },
  vaccination: { ios: 'syringe.fill', android: 'vaccines', web: 'vaccines' },
};

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
          const label = t(`dayTags.${tag}`);
          return (
            <Pressable
              key={tag}
              onPress={() => onToggle(tag)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                {
                  borderColor: on ? colors.tint : colors.border,
                  backgroundColor: on ? colors.tint : colors.card,
                },
              ]}>
              <SymbolView
                name={DAY_CONTEXT_ICONS[tag]}
                tintColor={on ? '#FFFFFF' : colors.text}
                size={22}
              />
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
    width: touchTarget.minHeight,
    height: touchTarget.minHeight,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
