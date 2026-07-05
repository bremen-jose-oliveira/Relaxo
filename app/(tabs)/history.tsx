import { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import { TrendBarChart } from '@/components/TrendBarChart';
import { TimelineEntry } from '@/components/TimelineEntry';
import { WakeDayPicker } from '@/components/WakeDayPicker';
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
import { buildTimeline, filterTimelineForDayView } from '@/lib/timeline';
import { formatSleepDuration, getWakeDaySummary } from '@/lib/daySummary';
import { parseDateKey } from '@/lib/dateUtils';
import { useTranslation } from '@/lib/i18n';

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
  const [sleepUnit, setSleepUnit] = useState<'hours' | 'minutes'>('hours');
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const scrollRef = useRef<ScrollView>(null);
  const dayViewOffset = useRef(0);

  const jumpToDay = useCallback((dateKey: string) => {
    setSelectedDay(parseDateKey(dateKey));
    scrollRef.current?.scrollTo({
      y: Math.max(0, dayViewOffset.current - spacing.sm),
      animated: true,
    });
  }, []);

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const baths = useAppStore((s) => s.baths);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();
  const now = useMemo(() => new Date(), []);

  const allTimeline = useMemo(
    () => buildTimeline(events, feedings, diapers, baths, wakes),
    [events, feedings, diapers, baths, wakes]
  );

  const selectedDayTimeline = useMemo(
    () =>
      filterTimelineForDayView(allTimeline, events, wakes, selectedDay, now),
    [allTimeline, events, wakes, selectedDay, now]
  );

  const selectedSummary = useMemo(
    () =>
      getWakeDaySummary(
        events,
        sleepPauses,
        feedings,
        diapers,
        baths,
        wakes,
        selectedDay,
        now
      ),
    [events, sleepPauses, feedings, diapers, baths, wakes, selectedDay, now]
  );

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
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View
          onLayout={(e) => {
            dayViewOffset.current = e.nativeEvent.layout.y;
          }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('history.dayView')}</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            {t('history.dayViewHint')}
          </Text>

          <Card style={styles.dayCard}>
            <WakeDayPicker
              label={t('log.day')}
              selectedDay={selectedDay}
              onSelectedDayChange={setSelectedDay}
              events={events}
              wakes={wakes}
              now={now}
            />

            <View style={styles.statGrid}>
            <StatBlock
              colors={colors}
              label={t('history.sleepToday')}
              value={formatSleepDuration(selectedSummary.totalSleepMinutes)}
              sub={`${selectedSummary.napCount} ${t('timeline.nap').toLowerCase()} · ${selectedSummary.bedtimeCount} ${t('timeline.bedtime').toLowerCase()}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.feeds')}
              value={`${selectedSummary.feedCount}`}
              sub={`B ${selectedSummary.breast} · Bo ${selectedSummary.bottle} · S ${selectedSummary.solid}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.diapers')}
              value={`${selectedSummary.diaperCount}`}
              sub={`W ${selectedSummary.wet} · D ${selectedSummary.dirty} · M ${selectedSummary.mixed}`}
            />
            <StatBlock
              colors={colors}
              label={t('history.baths')}
              value={`${selectedSummary.bathCount}`}
            />
          </View>

          {selectedDayTimeline.length === 0 ? (
            <Text style={[styles.noEvents, { color: colors.textSecondary }]}>
              {t('history.noEventsCalendarDay')}
            </Text>
          ) : (
            selectedDayTimeline.map((item) => (
              <TimelineEntry key={`${item.kind}-${item.id}`} item={item} />
            ))
          )}
        </Card>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.md }]}>
          {t('history.trends')}
        </Text>
        {dateRangeLabel ? (
          <Text style={[styles.dateRange, { color: colors.textSecondary }]}>
            {t('history.lastDays', { count: TREND_DAYS, range: dateRangeLabel })}
          </Text>
        ) : null}
        <Text style={[styles.chartTapHint, { color: colors.textSecondary }]}>
          {t('history.chartTapHint')}
        </Text>

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
          <TrendBarChart
            data={sleepChartData}
            maxValue={sleepMaxValue}
            noOfSections={4}
            yAxisSuffix={sleepUnit === 'hours' ? 'h' : 'm'}
            onDayPress={jumpToDay}
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
  sectionTitle: { fontSize: 22, fontWeight: '700', marginBottom: spacing.xs },
  sectionHint: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  calendarHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  chartTapHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  dateRange: { fontSize: 14, marginBottom: spacing.xs },
  dayCard: { marginBottom: spacing.lg },
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
  noEvents: { fontSize: 14, fontStyle: 'italic' },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 16, padding: spacing.lg },
});
