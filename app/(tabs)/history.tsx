import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import { TrendBarChart } from '@/components/TrendBarChart';
import { TimelineEntry } from '@/components/TimelineEntry';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { getSleepMetrics24h, getSleepTrend } from '@/lib/predictNextSleep';
import { getDiaperTrend, getFeedingTrend } from '@/lib/careTrends';
import { buildChartBars, formatChartDateRange, formatDayGroupHeader } from '@/lib/chartLabels';
import {
  computeNiceMax,
  computeSleepMaxHours,
  computeSleepMaxMinutes,
  sleepMinutesToChartValue,
} from '@/lib/chartScale';
import { buildTimeline, groupTimelineByDay } from '@/lib/timeline';

const TREND_DAYS = 14;

function StatBlock({
  label,
  value,
  sub,
  colors,
}: {
  label: string;
  value: string;
  sub?: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statBlockLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statBlockValue, { color: colors.text }]}>{value}</Text>
      {sub ? (
        <Text style={[styles.statBlockSub, { color: colors.textSecondary }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

export default function HistoryScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [sleepUnit, setSleepUnit] = useState<'hours' | 'minutes'>('hours');

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();
  const now = useMemo(() => new Date(), []);

  const timeline = useMemo(
    () => buildTimeline(events, feedings, diapers, wakes),
    [events, feedings, diapers, wakes]
  );

  const dayGroups = useMemo(
    () => groupTimelineByDay(timeline, TREND_DAYS, now),
    [timeline, now]
  );

  const sleepTrend = useMemo(
    () => getSleepTrend(events, wakes, sleepPauses, TREND_DAYS, now),
    [events, wakes, sleepPauses, now]
  );
  const feedingTrend = useMemo(() => getFeedingTrend(feedings, TREND_DAYS, now), [feedings, now]);
  const diaperTrend = useMemo(() => getDiaperTrend(diapers, TREND_DAYS, now), [diapers, now]);
  const sleep24h = useMemo(() => getSleepMetrics24h(events, now), [events, now]);

  const dateRangeLabel = useMemo(() => {
    if (sleepTrend.length === 0) return '';
    return formatChartDateRange(sleepTrend[0].date, sleepTrend[sleepTrend.length - 1].date);
  }, [sleepTrend]);

  const wakeTodayCount = useMemo(
    () =>
      wakes.filter((w) => {
        const d = new Date(w.time);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      }).length,
    [wakes, now]
  );

  const sleepChartData = useMemo(
    () =>
      buildChartBars(
        sleepTrend,
        (d) => sleepMinutesToChartValue(d.totalMinutes, sleepUnit),
        now,
        colors.tint
      ),
    [sleepTrend, sleepUnit, now, colors.tint]
  );

  const sleepDataMax = Math.max(
    0,
    ...sleepTrend.map((d) => sleepMinutesToChartValue(d.totalMinutes, sleepUnit))
  );
  const sleepMaxValue =
    sleepUnit === 'hours'
      ? computeSleepMaxHours(sleepDataMax)
      : computeSleepMaxMinutes(sleepDataMax);

  const feedChartData = useMemo(
    () =>
      buildChartBars(feedingTrend, (d) => d.totalFeeds, now, colors.feeding),
    [feedingTrend, now, colors.feeding]
  );

  const diaperChartData = useMemo(
    () => buildChartBars(diaperTrend, (d) => d.total, now, colors.diaper),
    [diaperTrend, now, colors.diaper]
  );

  const feedMax = computeNiceMax(
    Math.max(...feedingTrend.map((d) => d.totalFeeds), 0),
    4
  );
  const diaperMax = computeNiceMax(Math.max(...diaperTrend.map((d) => d.total), 0), 4);

  const todaySleep = sleepTrend.at(-1);
  const todayFeeding = feedingTrend.at(-1);
  const todayDiaper = diaperTrend.at(-1);

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Set up a baby profile to view history.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trends</Text>
        {dateRangeLabel ? (
          <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
            Last {TREND_DAYS} days · {dateRangeLabel}
          </Text>
        ) : null}

        <Card style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View style={styles.chartTitleBlock}>
              <Text style={[styles.chartLabel, { color: colors.text }]}>Total sleep</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                Per wake day (morning wake → next)
              </Text>
            </View>
            <View
              style={[
                styles.unitToggle,
                { borderColor: colors.border, backgroundColor: colors.background },
              ]}>
              <Pressable
                onPress={() => setSleepUnit('hours')}
                style={[
                  styles.unitChip,
                  sleepUnit === 'hours' && { backgroundColor: colors.tint + '33' },
                ]}>
                <Text style={[styles.unitChipText, { color: colors.text }]}>Hours</Text>
              </Pressable>
              <Pressable
                onPress={() => setSleepUnit('minutes')}
                style={[
                  styles.unitChip,
                  sleepUnit === 'minutes' && { backgroundColor: colors.tint + '33' },
                ]}>
                <Text style={[styles.unitChipText, { color: colors.text }]}>Minutes</Text>
              </Pressable>
            </View>
          </View>
          <TrendBarChart
            data={sleepChartData}
            maxValue={sleepMaxValue}
            noOfSections={4}
            yAxisSuffix={sleepUnit === 'hours' ? 'h' : 'm'}
          />
        </Card>

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>Feeds</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Per calendar day</Text>
          <TrendBarChart data={feedChartData} maxValue={feedMax} noOfSections={3} />
        </Card>

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>Diapers</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>Per calendar day</Text>
          <TrendBarChart data={diaperChartData} maxValue={diaperMax} noOfSections={3} />
        </Card>

        <Card style={styles.statsCard}>
          <Text style={[styles.snapshotTitle, { color: colors.text }]}>Today at a glance</Text>

          <View style={styles.statGrid}>
            <StatBlock
              colors={colors}
              label="Sleep (24h)"
              value={`${Math.floor(sleep24h.total24hMinutes / 60)}h ${sleep24h.total24hMinutes % 60}m`}
              sub={`Daytime ${Math.floor(sleep24h.daytimeTodayMinutes / 60)}h ${sleep24h.daytimeTodayMinutes % 60}m`}
            />
            <StatBlock
              colors={colors}
              label="Last night"
              value={`${Math.floor(sleep24h.nighttimeLastNightMinutes / 60)}h ${sleep24h.nighttimeLastNightMinutes % 60}m`}
              sub="8pm – 8am window"
            />
            <StatBlock
              colors={colors}
              label="Naps · bedtime"
              value={`${todaySleep?.napCount ?? 0} · ${todaySleep?.bedtimeCount ?? 0}`}
            />
            <StatBlock
              colors={colors}
              label="Feeds"
              value={`${todayFeeding?.totalFeeds ?? 0}`}
              sub={`B ${todayFeeding?.breast ?? 0} · Bo ${todayFeeding?.bottle ?? 0} · S ${todayFeeding?.solid ?? 0}`}
            />
            <StatBlock
              colors={colors}
              label="Diapers"
              value={`${todayDiaper?.total ?? 0}`}
              sub={`W ${todayDiaper?.wet ?? 0} · D ${todayDiaper?.dirty ?? 0} · M ${todayDiaper?.mixed ?? 0}`}
            />
            <StatBlock
              colors={colors}
              label="Wake-ups"
              value={`${wakeTodayCount}`}
            />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
          Daily timeline
        </Text>

        {dayGroups.map(({ date, items }) => (
          <View key={date} style={styles.dayGroup}>
            <Text style={[styles.dayHeader, { color: colors.text }]}>
              {formatDayGroupHeader(date, now)}
            </Text>
            {items.length === 0 ? (
              <Text style={[styles.noEvents, { color: colors.textSecondary }]}>No events</Text>
            ) : (
              items.map((item) => <TimelineEntry key={`${item.kind}-${item.id}`} item={item} />)
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: spacing.xs },
  dateRange: { fontSize: 14, marginBottom: spacing.lg },
  chartCard: { marginBottom: spacing.md, paddingBottom: spacing.sm },
  statsCard: { marginBottom: spacing.md },
  chartLabel: { fontSize: 16, fontWeight: '700' },
  chartSub: { fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  chartTitleBlock: { flex: 1, marginRight: spacing.sm },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  unitToggle: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  unitChip: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  unitChipText: { fontSize: 12, fontWeight: '600' },
  snapshotTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statBlock: {
    width: '48%',
    minWidth: 140,
    flexGrow: 1,
    paddingVertical: spacing.sm,
  },
  statBlockLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statBlockValue: { fontSize: 18, fontWeight: '700' },
  statBlockSub: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  dayGroup: { marginBottom: spacing.lg },
  dayHeader: { fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  noEvents: { fontSize: 14, fontStyle: 'italic', marginLeft: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 16, padding: spacing.lg },
});
