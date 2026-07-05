import { View, Pressable } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  ChartXAxisLabels,
  CHART_BAR_WIDTH,
  CHART_BAR_SPACING,
  CHART_INITIAL_SPACING,
  CHART_END_SPACING,
  CHART_Y_AXIS_WIDTH,
} from '@/components/ChartXAxisLabels';
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
};

export function TrendBarChart({
  data,
  maxValue,
  noOfSections = 4,
  yAxisSuffix,
  formatYLabel,
  height = 148,
  onDayPress,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const chartWidth = useChartWidth();

  const yLabelFormatter =
    formatYLabel ?? (yAxisSuffix ? (label: string) => `${label}${yAxisSuffix}` : undefined);

  const barData = data.map((bar) => ({ ...bar, label: '' }));

  return (
    <View>
      <View>
        <BarChart
          data={barData}
          width={chartWidth}
          height={height}
          barWidth={CHART_BAR_WIDTH}
          spacing={CHART_BAR_SPACING}
          initialSpacing={CHART_INITIAL_SPACING}
          endSpacing={CHART_END_SPACING}
          roundedTop
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
          xAxisLabelsHeight={4}
          noOfSections={noOfSections}
          maxValue={maxValue}
          barBorderRadius={4}
          yAxisLabelWidth={CHART_Y_AXIS_WIDTH}
        />
        {onDayPress ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: CHART_Y_AXIS_WIDTH,
              top: 0,
              right: 0,
              height,
              flexDirection: 'row',
              alignItems: 'flex-end',
              paddingLeft: CHART_INITIAL_SPACING,
              paddingRight: CHART_END_SPACING,
            }}>
            {data.map((bar) => (
              <Pressable
                key={bar.date}
                onPress={() => onDayPress(bar.date)}
                style={{
                  width: CHART_BAR_WIDTH,
                  marginRight: CHART_BAR_SPACING,
                  height: '100%',
                }}
                accessibilityRole="button"
                accessibilityLabel={bar.date}
              />
            ))}
          </View>
        ) : null}
      </View>
      <ChartXAxisLabels data={data} color={colors.textSecondary} />
    </View>
  );
}
