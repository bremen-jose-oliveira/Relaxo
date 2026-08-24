import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import { TrendLineChart } from '@/components/TrendLineChart';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { getSleepTrend } from '@/lib/predictNextSleep';
import { averageDailyCount, getDiaperTrend, getFeedingTrend } from '@/lib/careTrends';
import { buildChartBars, formatChartDateRange } from '@/lib/chartLabels';
import {
  computeNiceMax,
  computeSleepMaxHours,
  computeSleepMaxMinutes,
  sleepMinutesToChartValue,
} from '@/lib/chartScale';
import { formatSleepDuration } from '@/lib/daySummary';
import { formatTime, startOfDay } from '@/lib/dateUtils';
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
  type StatsLookbackDays,
} from '@/lib/sleepInsights';
import { compareBusyVsQuietDays } from '@/lib/dayContext';

const TREND_DAYS = 14;
const STATS_PERIODS: StatsLookbackDays[] = [7, 14, 30];

type InsightsSegment = 'overview' | 'sleep' | 'care' | 'context';

const SEGMENTS: { key: InsightsSegment; labelKey: string }[] = [
  { key: 'overview', labelKey: 'history.segmentOverview' },
  { key: 'sleep', labelKey: 'history.segmentSleep' },
  { key: 'care', labelKey: 'history.segmentCare' },
  { key: 'context', labelKey: 'history.segmentContext' },
];

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

function formatWakeMinutes(minutes: number, now: Date): string {
  const d = startOfDay(now);
  d.setMinutes(Math.round(minutes));
  return formatTime(d);
}

export default function InsightsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const router = useRouter();
  const [segment, setSegment] = useState<InsightsSegment>('overview');
  const [sleepUnit, setSleepUnit] = useState<'hours' | 'minutes'>('hours');
  const [statsDays, setStatsDays] = useState<StatsLookbackDays>(30);

  const jumpToDay = useCallback(
    (dateKey: string) => {
      router.push({ pathname: '/log', params: { day: dateKey } });
    },
    [router]
  );

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const wakes = useAppStore((s) => s.wakes);
  const dayContextTags = useAppStore((s) => s.dayContextTags);
  const baby = useActiveBaby();
  const now = useMemo(() => new Date(), []);
  const resolvedLang = resolveLocale(locale);

  const sleepTrend = useMemo(
    () => getSleepTrend(events, wakes, sleepPauses, TREND_DAYS, now),
    [events, wakes, sleepPauses, now]
  );
  const feedingTrend = useMemo(() => getFeedingTrend(feedings, TREND_DAYS, now), [feedings, now]);
  const diaperTrend = useMemo(() => getDiaperTrend(diapers, TREND_DAYS, now), [diapers, now]);

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
    () => getSleepStats(events, sleepPauses, wakes, now, statsDays),
    [events, sleepPauses, wakes, now, statsDays]
  );

  const busyQuiet = useMemo(
    () => compareBusyVsQuietDays(events, sleepPauses, wakes, dayContextTags, now, 14),
    [events, sleepPauses, wakes, dayContextTags, now]
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

  const feedMax = computeNiceMax(Math.max(...feedingTrend.map((d) => d.totalFeeds), 0), 4);
  const diaperMax = computeNiceMax(Math.max(...diaperTrend.map((d) => d.total), 0), 4);

  const feedAvg = averageDailyCount(feedingTrend.map((d) => d.totalFeeds));
  const diaperAvg = averageDailyCount(diaperTrend.map((d) => d.total));
  const feedTypeAvg = {
    breast: averageDailyCount(feedingTrend.map((d) => d.breast)),
    bottle: averageDailyCount(feedingTrend.map((d) => d.bottle)),
    solid: averageDailyCount(feedingTrend.map((d) => d.solid)),
  };
  const diaperTypeAvg = {
    wet: averageDailyCount(diaperTrend.map((d) => d.wet)),
    dirty: averageDailyCount(diaperTrend.map((d) => d.dirty)),
    mixed: averageDailyCount(diaperTrend.map((d) => d.mixed)),
  };

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('history.setupProfile')}
        </Text>
      </SafeAreaView>
    );
  }

  const periodToggle = (
    <View
      style={[
        styles.unitToggle,
        { borderColor: colors.border, backgroundColor: colors.background },
      ]}>
      {STATS_PERIODS.map((days) => (
        <Pressable
          key={days}
          onPress={() => setStatsDays(days)}
          style={[styles.unitChip, statsDays === days && { backgroundColor: colors.tint + '33' }]}>
          <Text style={[styles.unitChipText, { color: colors.text }]}>
            {t(`history.statsPeriod${days}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <View style={[styles.segmentBar, { borderBottomColor: colors.border }]}>
        {SEGMENTS.map(({ key, labelKey }) => {
          const selected = segment === key;
          return (
            <Pressable
              key={key}
              onPress={() => setSegment(key)}
              style={[
                styles.segmentChip,
                {
                  backgroundColor: selected ? colors.tint : colors.card,
                  borderColor: colors.border,
                },
              ]}>
              <Text
                style={{
                  color: selected ? '#FFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {segment === 'overview' ? (
          <>
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

            <WeekCompareCard compare={weekCompare} t={t} />

            <Card style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <View style={styles.chartTitleBlock}>
                  <Text style={[styles.chartLabel, { color: colors.text }]}>
                    {t('history.overviewHero')}
                  </Text>
                  <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                    {t('history.statsHint', { days: statsDays })}
                  </Text>
                </View>
                {periodToggle}
              </View>
              <View style={styles.statGrid}>
                <StatBlock
                  colors={colors}
                  label={t('history.typicalWakeUp')}
                  value={
                    sleepStats.typicalMorningWakeMinutes != null
                      ? formatWakeMinutes(sleepStats.typicalMorningWakeMinutes, now)
                      : t('history.avgNapEmpty')
                  }
                  sub={t('history.typicalWakeUpSub')}
                />
                <StatBlock
                  colors={colors}
                  label={t('history.avgNightSleep')}
                  value={
                    sleepStats.avgNightSleepMinutes != null
                      ? formatSleepDuration(sleepStats.avgNightSleepMinutes)
                      : t('history.avgNapEmpty')
                  }
                />
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
                  label={t('history.avgNapsPerDay')}
                  value={
                    sleepStats.avgNapsPerDay != null
                      ? `${sleepStats.avgNapsPerDay}`
                      : t('history.avgNapEmpty')
                  }
                />
              </View>
            </Card>

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
          </>
        ) : null}

        {segment === 'sleep' ? (
          <>
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
                  <Text style={[styles.chartLabel, { color: colors.text }]}>
                    {t('history.totalSleep')}
                  </Text>
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
                    <Text style={[styles.unitChipText, { color: colors.text }]}>
                      {t('history.hours')}
                    </Text>
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
              <View style={styles.chartHeaderRow}>
                <View style={styles.chartTitleBlock}>
                  <Text style={[styles.chartLabel, { color: colors.text }]}>
                    {t('history.statistics')}
                  </Text>
                  <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                    {t('history.statsHint', { days: statsDays })}
                  </Text>
                </View>
                {periodToggle}
              </View>
              <View style={styles.statGrid}>
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
          </>
        ) : null}

        {segment === 'care' ? (
          <>
            {dateRangeLabel ? (
              <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
                {t('history.lastDays', { count: TREND_DAYS, range: dateRangeLabel })}
              </Text>
            ) : null}
            <Text style={[styles.chartTapHint, { color: colors.textSecondary }]}>
              {t('history.chartTapHint')}
            </Text>

            <Card style={styles.chartCard}>
              <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.feeds')}</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                {t('history.perCalendarDay')}
                {feedAvg != null ? ` · ${t('history.careAvgDay', { avg: feedAvg })}` : ''}
              </Text>
              {feedAvg != null ? (
                <Text style={[styles.careBreakdown, { color: colors.textSecondary }]}>
                  {t('history.feedBreakdown', {
                    breast: feedTypeAvg.breast ?? 0,
                    bottle: feedTypeAvg.bottle ?? 0,
                    solid: feedTypeAvg.solid ?? 0,
                  })}
                </Text>
              ) : null}
              <TrendLineChart
                data={feedChartData}
                maxValue={feedMax}
                noOfSections={4}
                color={colors.feeding}
                onDayPress={jumpToDay}
                emptyLabel={t('history.chartFeedsEmpty')}
              />
            </Card>

            <Card style={styles.chartCard}>
              <Text style={[styles.chartLabel, { color: colors.text }]}>{t('history.diapers')}</Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                {t('history.perCalendarDay')}
                {diaperAvg != null ? ` · ${t('history.careAvgDay', { avg: diaperAvg })}` : ''}
              </Text>
              {diaperAvg != null ? (
                <Text style={[styles.careBreakdown, { color: colors.textSecondary }]}>
                  {t('history.diaperBreakdown', {
                    wet: diaperTypeAvg.wet ?? 0,
                    dirty: diaperTypeAvg.dirty ?? 0,
                    mixed: diaperTypeAvg.mixed ?? 0,
                  })}
                </Text>
              ) : null}
              <TrendLineChart
                data={diaperChartData}
                maxValue={diaperMax}
                noOfSections={4}
                color={colors.diaper}
                onDayPress={jumpToDay}
                emptyLabel={t('history.chartDiapersEmpty')}
              />
            </Card>
          </>
        ) : null}

        {segment === 'context' ? (
          <>
            <Card style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <View style={styles.chartTitleBlock}>
                  <Text style={[styles.chartLabel, { color: colors.text }]}>
                    {t('history.settleWakeStats')}
                  </Text>
                  <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                    {t('history.statsHint', { days: statsDays })}
                  </Text>
                </View>
                {periodToggle}
              </View>
              <View style={styles.statGrid}>
                <StatBlock
                  colors={colors}
                  label={t('history.selfWake')}
                  value={
                    sleepStats.selfWakePercent != null
                      ? `${sleepStats.selfWakePercent}%`
                      : t('history.avgNapEmpty')
                  }
                />
                <StatBlock
                  colors={colors}
                  label={t('history.happyWake')}
                  value={
                    sleepStats.happyWakePercent != null
                      ? `${sleepStats.happyWakePercent}%`
                      : t('history.avgNapEmpty')
                  }
                />
                <StatBlock
                  colors={colors}
                  label={t('history.cribOnset')}
                  value={
                    sleepStats.cribOnsetPercent != null
                      ? `${sleepStats.cribOnsetPercent}%`
                      : t('history.avgNapEmpty')
                  }
                />
                <StatBlock
                  colors={colors}
                  label={t('history.calmSettle')}
                  value={
                    sleepStats.calmSettlePercent != null
                      ? `${sleepStats.calmSettlePercent}%`
                      : t('history.avgNapEmpty')
                  }
                />
                <StatBlock
                  colors={colors}
                  label={t('history.avgSettleMinutes')}
                  value={
                    sleepStats.avgSettleMinutes != null
                      ? t('history.min', { min: Math.round(sleepStats.avgSettleMinutes) })
                      : t('history.avgNapEmpty')
                  }
                />
              </View>
            </Card>

            <Card style={styles.chartCard}>
              <Text style={[styles.chartLabel, { color: colors.text }]}>
                {t('history.busyVsQuiet')}
              </Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                {t('history.busyVsQuietHint', { days: busyQuiet.lookbackDays })}
              </Text>
              {busyQuiet.busyDays === 0 || busyQuiet.quietDays === 0 ? (
                <Text style={[styles.insightLine, { color: colors.textSecondary }]}>
                  {t('history.busyQuietEmpty')}
                </Text>
              ) : (
                <View style={styles.statGrid}>
                  <StatBlock
                    colors={colors}
                    label={t('history.busyDays')}
                    value={`${busyQuiet.busyDays}`}
                  />
                  <StatBlock
                    colors={colors}
                    label={t('history.quietDays')}
                    value={`${busyQuiet.quietDays}`}
                  />
                  <StatBlock
                    colors={colors}
                    label={t('history.busyAvgNap')}
                    value={
                      busyQuiet.busyAvgNapMinutes != null
                        ? t('history.min', { min: busyQuiet.busyAvgNapMinutes })
                        : t('history.avgNapEmpty')
                    }
                  />
                  <StatBlock
                    colors={colors}
                    label={t('history.quietAvgNap')}
                    value={
                      busyQuiet.quietAvgNapMinutes != null
                        ? t('history.min', { min: busyQuiet.quietAvgNapMinutes })
                        : t('history.avgNapEmpty')
                    }
                  />
                  <StatBlock
                    colors={colors}
                    label={t('history.busyAvgWake')}
                    value={
                      busyQuiet.busyAvgWakeWindowMinutes != null
                        ? t('history.min', { min: busyQuiet.busyAvgWakeWindowMinutes })
                        : t('history.avgNapEmpty')
                    }
                  />
                  <StatBlock
                    colors={colors}
                    label={t('history.quietAvgWake')}
                    value={
                      busyQuiet.quietAvgWakeWindowMinutes != null
                        ? t('history.min', { min: busyQuiet.quietAvgWakeWindowMinutes })
                        : t('history.avgNapEmpty')
                    }
                  />
                </View>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segmentChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionHint: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  chartTapHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  dateRange: { fontSize: 14, marginBottom: spacing.xs },
  chartCard: { marginBottom: spacing.md, paddingBottom: spacing.sm },
  chartLabel: { fontSize: 16, fontWeight: '700' },
  chartSub: { fontSize: 13, marginTop: 2, marginBottom: spacing.sm },
  careBreakdown: { fontSize: 12, marginBottom: spacing.sm, lineHeight: 16 },
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
