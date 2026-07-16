import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { CHART_Y_AXIS_WIDTH } from '@/components/ChartXAxisLabels';
import type { ChartBarPoint } from '@/lib/chartLabels';
import { useChartWidth } from '@/components/useChartWidth';

type Props = {
  data: ChartBarPoint[];
  maxValue: number;
  noOfSections?: number;
  yAxisSuffix?: string;
  formatYLabel?: (label: string) => string;
  height?: number;
  onDayPress?: (dateKey: string) => void;
  emptyLabel?: string;
};

export function TrendLineChart({
  data,
  maxValue,
  noOfSections = 4,
  yAxisSuffix,
  formatYLabel,
  height = 148,
  onDayPress,
  emptyLabel,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const chartWidth = useChartWidth();
  const lineColor = colors.tint;

  const yLabelFormatter =
    formatYLabel ?? (yAxisSuffix ? (label: string) => `${label}${yAxisSuffix}` : undefined);

  const hasData = data.some((point) => point.value > 0);
  const initialSpacing = 12;
  const endSpacing = 12;
  const pointCount = Math.max(data.length, 2);
  const spacingPx = Math.max(
    8,
    (chartWidth - initialSpacing - endSpacing) / (pointCount - 1)
  );

  const lineData = data.map((point) => ({
    value: point.value,
    label: '',
  }));

  if (!hasData) {
    return (
      <View style={[styles.emptyWrap, { height: height + 24 }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyLabel ?? 'No sleep logged in this range yet.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.chartClip, { height }]}>
        <LineChart
          data={lineData}
          width={chartWidth}
          height={height}
          adjustToWidth
          spacing={spacingPx}
          initialSpacing={initialSpacing}
          endSpacing={endSpacing}
          areaChart
          curved
          isAnimated={false}
          color={lineColor}
          thickness={2.5}
          startFillColor={lineColor}
          startOpacity={0.22}
          endFillColor={lineColor}
          endOpacity={0.02}
          hideRules={false}
          rulesType="solid"
          rulesColor={colors.border + '88'}
          rulesThickness={1}
          disableScroll
          xAxisColor={colors.border}
          yAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, fontSize: 11 }}
          xAxisLabelTextStyle={{ color: 'transparent', fontSize: 1, height: 0 }}
          formatYLabel={yLabelFormatter}
          labelsExtraHeight={0}
          xAxisLabelsHeight={0}
          noOfSections={noOfSections}
          maxValue={Math.max(maxValue, 0.1)}
          yAxisLabelWidth={CHART_Y_AXIS_WIDTH}
          hideDataPoints={false}
          dataPointsColor={lineColor}
          dataPointsRadius={3.5}
          focusedDataPointRadius={5}
          overflowTop={8}
        />
        {onDayPress ? (
          <View
            pointerEvents="box-none"
            style={[styles.hitRow, { height, marginLeft: CHART_Y_AXIS_WIDTH }]}>
            {data.map((point) => (
              <Pressable
                key={point.date}
                onPress={() => onDayPress(point.date)}
                style={styles.hitSlot}
                accessibilityRole="button"
                accessibilityLabel={point.date}
              />
            ))}
          </View>
        ) : null}
      </View>
      <View style={[styles.labelRow, { marginLeft: CHART_Y_AXIS_WIDTH }]}>
        {data.map((point) => (
          <View key={point.date} style={styles.labelSlot}>
            {point.label ? (
              <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
                {point.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  chartClip: {
    overflow: 'hidden',
  },
  hitRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
  },
  hitSlot: {
    flex: 1,
    height: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    marginTop: 4,
    minHeight: 14,
  },
  labelSlot: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
