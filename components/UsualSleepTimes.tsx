import { View, Text, StyleSheet } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { formatTime } from '@/lib/dateUtils';
import type { TypicalSlotStart } from '@/lib/sleepPatterns';

type Props = {
  schedule: TypicalSlotStart[];
  title: string;
  subtitle?: string;
  colors: (typeof Colors)['light'];
  /** Tighter layout for Home prediction card */
  compact?: boolean;
};

export function UsualSleepTimes({
  schedule,
  title,
  subtitle,
  colors,
  compact = false,
}: Props) {
  if (schedule.length === 0) return null;

  return (
    <View style={compact ? styles.compactWrap : styles.wrap}>
      <Text
        style={[
          compact ? styles.compactTitle : styles.title,
          { color: compact ? colors.textSecondary : colors.text },
        ]}>
        {title}
      </Text>
      {subtitle && !compact ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {schedule.map((item) => (
        <View key={item.slot} style={styles.row}>
          <Text
            style={[
              compact ? styles.compactLabel : styles.label,
              { color: colors.textSecondary },
            ]}>
            {item.slotLabel}
          </Text>
          <Text
            style={[
              compact ? styles.compactTime : styles.time,
              { color: colors.text },
            ]}>
            {formatTime(item.typicalTime)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xs,
  },
  compactWrap: {
    marginTop: spacing.sm,
    width: '100%',
    paddingHorizontal: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 15,
    flex: 1,
    marginRight: spacing.sm,
  },
  compactLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
  },
  compactTime: {
    fontSize: 15,
    fontWeight: '600',
  },
});
