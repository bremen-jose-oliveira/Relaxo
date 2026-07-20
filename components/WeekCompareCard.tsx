import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import {
  formatMinutesCompact,
  type WeekCompare,
} from '@/lib/sleepInsights';

type ColorsT = (typeof Colors)['light'];

type Props = {
  compare: WeekCompare;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function deltaColor(delta: number | null, colors: ColorsT): string {
  if (delta == null || delta === 0) return colors.textSecondary;
  return delta > 0 ? colors.success : colors.danger;
}

function formatSigned(delta: number | null, suffix = ''): string {
  if (delta == null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}${suffix}`;
}

function MetricRow({
  label,
  thisValue,
  lastValue,
  deltaLabel,
  deltaTone,
  barThis,
  barLast,
  colors,
}: {
  label: string;
  thisValue: string;
  lastValue: string;
  deltaLabel: string;
  deltaTone: string;
  barThis: number;
  barLast: number;
  colors: ColorsT;
}) {
  const max = Math.max(barThis, barLast, 1);
  return (
    <View style={styles.metricBlock}>
      <View style={styles.metricHeader}>
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.deltaChip, { color: deltaTone }]}>{deltaLabel}</Text>
      </View>
      <View style={styles.compareRow}>
        <View style={styles.col}>
          <Text style={[styles.valueText, { color: colors.text }]}>{thisValue}</Text>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: colors.tint,
                  width: `${Math.round((barThis / max) * 100)}%` as `${number}%`,
                },
              ]}
            />
          </View>
        </View>
        <View style={styles.col}>
          <Text style={[styles.valueText, { color: colors.text }]}>{lastValue}</Text>
          <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: colors.textSecondary + '99',
                  width: `${Math.round((barLast / max) * 100)}%` as `${number}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function WeekCompareCard({ compare, t }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const { thisWeek: tw, lastWeek: lw, daysCompared } = compare;

  const rows = [
    {
      label: t('history.avgNap'),
      thisValue:
        tw.avgNapMinutes != null
          ? t('history.min', { min: tw.avgNapMinutes })
          : t('history.avgNapEmpty'),
      lastValue:
        lw.avgNapMinutes != null
          ? t('history.min', { min: lw.avgNapMinutes })
          : t('history.avgNapEmpty'),
      delta: compare.avgNapDelta,
      deltaSuffix: ` ${t('history.minUnit')}`,
      barThis: tw.avgNapMinutes ?? 0,
      barLast: lw.avgNapMinutes ?? 0,
    },
    {
      label: t('history.daytimeSleep'),
      thisValue: formatMinutesCompact(tw.daytimeSleepMinutes),
      lastValue: formatMinutesCompact(lw.daytimeSleepMinutes),
      // Delta is per-day so mid-week comparisons stay fair.
      delta: compare.avgDaytimePerDayDelta,
      deltaSuffix: ` ${t('history.perDayShort')}`,
      barThis: tw.daytimeSleepMinutes,
      barLast: lw.daytimeSleepMinutes,
    },
    {
      label: t('history.naps'),
      thisValue: String(tw.napCount),
      lastValue: String(lw.napCount),
      delta: compare.napCountDelta,
      deltaSuffix: '',
      barThis: tw.napCount,
      barLast: lw.napCount,
    },
    {
      label: t('history.avgWakeWindow'),
      thisValue:
        tw.avgWakeWindowMinutes != null
          ? t('history.min', { min: tw.avgWakeWindowMinutes })
          : t('history.avgNapEmpty'),
      lastValue:
        lw.avgWakeWindowMinutes != null
          ? t('history.min', { min: lw.avgWakeWindowMinutes })
          : t('history.avgNapEmpty'),
      delta: compare.avgWakeWindowDelta,
      deltaSuffix: ` ${t('history.minUnit')}`,
      barThis: tw.avgWakeWindowMinutes ?? 0,
      barLast: lw.avgWakeWindowMinutes ?? 0,
    },
  ];

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.text }]}>{t('history.weekCompare')}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {t('history.weekCompareHint', { days: daysCompared })}
      </Text>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.tint }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            {t('history.thisWeek')}
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            {t('history.lastWeek')}
          </Text>
        </View>
      </View>

      {rows.map((row) => (
        <MetricRow
          key={row.label}
          label={row.label}
          thisValue={row.thisValue}
          lastValue={row.lastValue}
          deltaLabel={formatSigned(row.delta, row.deltaSuffix)}
          deltaTone={deltaColor(row.delta, colors)}
          barThis={row.barThis}
          barLast={row.barLast}
          colors={colors}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 16, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: spacing.md },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '600' },
  metricBlock: { marginBottom: spacing.md },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: { fontSize: 13, fontWeight: '600' },
  deltaChip: { fontSize: 13, fontWeight: '700' },
  compareRow: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  valueText: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
});
