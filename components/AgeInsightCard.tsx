import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card } from '@/components/Card';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { categoryKey, resolveAgeInsight } from '@/lib/ageInsights';
import { resolveLocale } from '@/lib/i18n';
import type { AppLocale } from '@/types';
import type { SleepEvent, WakeEvent } from '@/types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  birthDate: string;
  events: SleepEvent[];
  wakes: WakeEvent[];
  easilyOverstimulated: boolean;
  highNeed: boolean;
  locale: AppLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AgeInsightCard({
  birthDate,
  events,
  wakes,
  easilyOverstimulated,
  highNeed,
  locale,
  t,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const resolvedLocale = resolveLocale(locale);
  const [expanded, setExpanded] = useState(false);

  const insight = useMemo(
    () =>
      resolveAgeInsight(birthDate, events, wakes, new Date(), resolvedLocale, {
        easilyOverstimulated,
        highNeed,
      }),
    [birthDate, events, wakes, resolvedLocale, easilyOverstimulated, highNeed]
  );

  if (!insight) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.headerPress, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.headerText}>
          <View style={styles.headerRow}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {t('home.thisStage')}
            </Text>
            <View style={[styles.categoryPill, { backgroundColor: colors.tint + '22' }]}>
              <Text style={[styles.categoryText, { color: colors.tint }]}>
                {t(categoryKey(insight.category))}
              </Text>
            </View>
          </View>
          <Text style={[styles.collapsedTitle, { color: colors.text }]} numberOfLines={expanded ? 2 : 1}>
            {t(insight.titleKey, insight.params)}
          </Text>
          <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>
            {t('insights.weekLabel', { week: insight.weeks })}
            {!expanded ? ` · ${t('home.stageTapHint')}` : ''}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.bodyWrap}>
          <Text style={[styles.body, { color: colors.text }]}>
            {t(insight.bodyKey, insight.params)}
          </Text>

          {insight.personalKey ? (
            <Text style={[styles.personal, { color: colors.text }]}>
              {t(insight.personalKey, insight.personalParams)}
            </Text>
          ) : null}

          {insight.temperamentKeys.map((key) => (
            <Text key={key} style={[styles.temperament, { color: colors.tint }]}>
              {t(key)}
            </Text>
          ))}

          {insight.upcomingKey ? (
            <View style={[styles.upcomingBlock, { borderTopColor: colors.border }]}>
              <Text style={[styles.upcomingLabel, { color: colors.textSecondary }]}>
                {t('insights.upcomingLabel')}
              </Text>
              <Text style={[styles.upcomingBody, { color: colors.textSecondary }]}>
                {t(insight.upcomingKey, insight.params)}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
            {t('insights.disclaimer')}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: spacing.xs,
  },
  headerPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  categoryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  collapsedTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 2,
  },
  weekLabel: {
    fontSize: 13,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  bodyWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.35)',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  personal: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    fontWeight: '500',
  },
  temperament: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  upcomingBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  upcomingLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  upcomingBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.md,
  },
});
