import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import { TrendBarChart } from '@/components/TrendBarChart';
import { TrendLineChart } from '@/components/TrendLineChart';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { getSleepMetrics24h, getSleepTrend } from '@/lib/predictNextSleep';
import { getDiaperTrend, getFeedingTrend } from '@/lib/careTrends';
import { buildChartBars, formatChartDateRange } from '@/lib/chartLabels';
import {
  computeNiceMax,
  computeSleepMaxHours,
  computeSleepMaxMinutes,
  sleepMinutesToChartValue,
} from '@/lib/chartScale';
import { formatSleepDuration, getWakeDaySummary } from '@/lib/daySummary';
import { resolveLocale, useTranslation } from '@/lib/i18n';
import { resolveNapGoal } from '@/lib/napSchedule';
import { getTypicalSleepSchedule } from '@/lib/sleepPatterns';
import { UsualSleepTimes } from '@/components/UsualSleepTimes';
import { WeekCompareCard } from '@/components/WeekCompareCard';
import {
  compareSleepWeeks,
  formatBabyAge,
  getAgeNorms,
  getAverageNapForWindows,
  getSleepStats,
} from '@/lib/sleepInsights';

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
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const router = useRouter();
  const [sleepUnit, setSleepUnit] = useState<'hours' | 'minutes'>('hours');

  const jumpToDay = useCallback(
    (dateKey: string) => {
      router.push({ pathname: '/(tabs)/log', params: { day: dateKey } });
    },
    [router]
  );

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const baths = useAppStore((s) => s.baths);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();
  const now = useMemo(() => new Date(), []);
  const resolvedLang = resolveLocale(locale);

  const todaySummary = useMemo(
    () =>
      getWakeDaySummary(
        events,
        sleepPauses,
        feedings,
        diapers,
        baths,
        wakes,
        now,
        now
      ),
    [events, sleepPauses, feedings, diapers, baths, wakes, now]
  );

  const sleepTrend = useMemo(
    () => getSleepTrend(events, wakes, sleepPauses, TREND_DAYS, now),
    [events, wakes, sleepPauses, now]
  );
  const feedingTrend = useMemo(() => getFeedingTrend(feedings, TREND_DAYS, now), [feedings, now]);
  const diaperTrend = useMemo(() => getDiaperTrend(diapers, TREND_DAYS, now), [diapers, now]);
  const sleep24h = useMemo(
    () => getSleepMetrics24h(events, sleepPauses, now),
    [events, sleepPauses, now]
  );

  const usualSchedule = useMemo(() => {
    if (!baby) return [];
    const { goal } = resolveNapGoal(baby, events, wakes, now);
    return getTypicalSleepSchedule(events, wakes, now, goal);
  }, [baby, events, wakes, now]);

  const napAverages = useMemo(
    () => getAverageNapForWindows(events, sleepPauses, now),
    [events, sleepPauses, now]
  );

  const weekCompare = useMemo(
    () => compareSleepWeeks(events, sleepPauses, wakes, now),
    [events, sleepPauses, wakes, now]
  );

  const sleepStats = useMemo(
    () => getSleepStats(events, sleepPauses, wakes, now, 30),
    [events, sleepPauses, wakes, now]
  );

  const ageLabel = baby ? formatBabyAge(baby.birthDate, now, resolvedLang) : '';
  const ageNorms = baby ? getAgeNorms(baby.birthDate, now) : null;

  const dateRangeLabel = useMemo(() => {
    if (sleepTrend.length === 0) return '';
    return formatChartDateRange(sleepTrend[0].date, sleepTrend[sleepTrend.length - 1].date);
  }, [sleepTrend]);

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
    () => buildChartBars(feedingTrend, (d) => d.totalFeeds, now, colors.feeding),
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

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('history.setupProfile')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
          {t('history.ageLine', { age: ageLabel })}
        </Text>
        {ageNorms ? (
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            {t('history.typicalForAge', {
              naps: ageNorms.typicalNaps,
              wakeMin: ageNorms.wakeWindowMin,
              wakeMax: ageNorms.wakeWindowMax,
              dayMin: ageNorms.typicalDaytimeSleepMin,
              dayMax: ageNorms.typicalDaytimeSleepMax,
            })}
          </Text>
        ) : null}

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.avgNap')}</Text>
          <Text style={[styles.insightLine, { color: colors.text }]}>
            {t('history.avgNapToday', {
              min: napAverages.today ?? t('history.avgNapEmpty'),
            })}
          </Text>
          <Text style={[styles.insightLine, { color: colors.text }]}>
            {t('history.avgNap7d', {
              min: napAverages.last7 ?? t('history.avgNapEmpty'),
            })}
          </Text>
          <Text style={[styles.insightLine, { color: colors.text }]}>
            {t('history.avgNap30d', {
              min: napAverages.last30 ?? t('history.avgNapEmpty'),
            })}
          </Text>
        </Card>

        <WeekCompareCard compare={weekCompare} t={t} />

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.statistics')}</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            {t('history.statsHint')}
          </Text>
          <View style={styles.statGrid}>
            <StatBlock
              colors={colors}
              label={t('history.avgNap')}
              value={
                sleepStats.avgNapMinutes != null
                  ? t('history.min', { min: sleepStats.avgNapMinutes })
                  : t('history.avgNapEmpty')
              }
            />
            <StatBlock
              colors={colors}
              label={t('history.longestNapEver')}
              value={
                sleepStats.longestNapMinutes != null
                  ? t('history.min', { min: sleepStats.longestNapMinutes })
                  : t('history.avgNapEmpty')
              }
            />
            <StatBlock
              colors={colors}
              label={t('history.avgNapsPerDay')}
              value={
                sleepStats.avgNapsPerDay != null
                  ? `${sleepStats.avgNapsPerDay}`
                  : t('history.avgNapEmpty')
              }
            />
            <StatBlock
              colors={colors}
              label={t('history.avgWakeWindow')}
              value={
                sleepStats.avgWakeWindowMinutes != null
                  ? t('history.min', { min: sleepStats.avgWakeWindowMinutes })
                  : t('history.avgNapEmpty')
              }
            />
            <StatBlock
              colors={colors}
              label={t('history.avgDaytimeSleep')}
              value={
                sleepStats.avgDaytimeSleepMinutes != null
                  ? formatSleepDuration(sleepStats.avgDaytimeSleepMinutes)
                  : t('history.avgNapEmpty')
              }
            />
            <StatBlock
              colors={colors}
              label={t('history.extensionSuccess')}
              value={
                sleepStats.extensionSuccessPercent != null
                  ? `${sleepStats.extensionSuccessPercent}%`
                  : t('history.avgNapEmpty')
              }
            />
          </View>
        </Card>

        {dateRangeLabel ? (
          <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
            {t('history.lastDays', { count: TREND_DAYS, range: dateRangeLabel })}
          </Text>
        ) : null}
        <Text style={[styles.chartTapHint, { color: colors.textSecondary }]}>
          {t('history.chartTapHint')}
        </Text>

        {usualSchedule.length > 0 ? (
          <Card style={styles.chartCard}>
            <UsualSleepTimes
              schedule={usualSchedule}
              title={t('history.usualTimes')}
              subtitle={t('history.usualTimesSub')}
              colors={colors}
            />
          </Card>
        ) : null}

        <Card style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View style={styles.chartTitleBlock}>
              <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.totalSleep')}</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                {t('history.perCalendarDay')}
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
                <Text style={[styles.unitChipText, { color: colors.text }]}>{t('history.hours')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setSleepUnit('minutes')}
                style={[
                  styles.unitChip,
                  sleepUnit === 'minutes' && { backgroundColor: colors.tint + '33' },
                ]}>
                <Text style={[styles.unitChipText, { color: colors.text }]}>
                  {t('history.minutes')}
                </Text>
              </Pressable>
            </View>
          </View>
          <TrendLineChart
            data={sleepChartData}
            maxValue={sleepMaxValue}
            noOfSections={4}
            yAxisSuffix={sleepUnit === 'hours' ? 'h' : 'm'}
            onDayPress={jumpToDay}
            emptyLabel={t('history.chartSleepEmpty')}
          />
        </Card>

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.feeds')}</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
            {t('history.perCalendarDay')}
          </Text>
          <TrendBarChart data={feedChartData} maxValue={feedMax} noOfSections={3} onDayPress={jumpToDay} />
        </Card>

        <Card style={styles.chartCard}>
          <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.diapers')}</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
            {t('history.perCalendarDay')}
          </Text>
          <TrendBarChart data={diaperChartData} maxValue={diaperMax} noOfSections={3} onDayPress={jumpToDay} />
        </Card>

        <Card style={styles.statsCard}>
          <Text style={[styles.snapshotTitle, { color: colors.text }]}>
            {t('history.todayGlance')}
          </Text>

          <View style={styles.statGrid}>
            <StatBlock
              colors={colors}
              label={t('history.sleepToday')}
              value={formatSleepDuration(todaySummary.totalSleepMinutes)}
              sub={t('history.calendarDayTotal')}
            />
            <StatBlock
              colors={colors}
              label={t('history.lastNight')}
              value={formatSleepDuration(sleep24h.nighttimeLastNightMinutes)}
              sub={t('history.lastNightSub')}
            />
            <StatBlock
              colors={colors}
              label={t('history.napsBedtime')}
              value={`${todaySummary.napCount} · ${todaySummary.bedtimeCount}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.feeds')}
              value={`${todaySummary.feedCount}`}
              sub={`B ${todaySummary.breast} · Bo ${todaySummary.bottle} · S ${todaySummary.solid}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.diapers')}
              value={`${todaySummary.diaperCount}`}
              sub={`W ${todaySummary.wet} · D ${todaySummary.dirty} · M ${todaySummary.mixed}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.baths')}
              value={`${todaySummary.bathCount}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.wakeUps')}
              value={`${todaySummary.wakeCount}`}
            />
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionHint: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  chartTapHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  dateRange: { fontSize: 14, marginBottom: spacing.xs },
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
  insightLine: { fontSize: 15, lineHeight: 22, marginBottom: 4 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
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
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 16, padding: spacing.lg },
});
