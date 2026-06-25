import { Dimensions } from 'react-native';
import { spacing } from '@/constants/Colors';

const CHART_WIDTH = Dimensions.get('window').width - spacing.lg * 2 - 32;

export function useChartWidth(): number {
  return CHART_WIDTH;
}
