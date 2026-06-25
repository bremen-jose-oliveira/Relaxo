import { View, Text, StyleSheet } from 'react-native';
import type { ChartBarPoint } from '@/lib/chartLabels';

export const CHART_BAR_WIDTH = 11;
export const CHART_BAR_SPACING = 7;
export const CHART_INITIAL_SPACING = 10;
export const CHART_END_SPACING = 10;
export const CHART_Y_AXIS_WIDTH = 36;

type Props = {
  data: ChartBarPoint[];
  color: string;
};

export function ChartXAxisLabels({ data, color }: Props) {
  return (
    <View style={styles.row}>
      {data.map((bar, index) => {
        const slotWidth =
          index === data.length - 1
            ? CHART_BAR_WIDTH
            : CHART_BAR_WIDTH + CHART_BAR_SPACING;

        return (
          <View key={bar.date} style={[styles.slot, { width: slotWidth }]}>
            {bar.label ? (
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {bar.label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginLeft: CHART_Y_AXIS_WIDTH,
    paddingLeft: CHART_INITIAL_SPACING,
    paddingRight: CHART_END_SPACING,
    marginTop: 2,
    minHeight: 14,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
