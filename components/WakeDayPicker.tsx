import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { DatePickerField } from '@/components/DatePickerField';
import { formatCalendarDayLabel } from '@/lib/dayAnchor';
import { isSameDay, startOfDay } from '@/lib/dateUtils';
import type { SleepEvent, WakeEvent } from '@/types';

type Props = {
  label: string;
  selectedDay: Date;
  onSelectedDayChange: (day: Date) => void;
  events: SleepEvent[];
  wakes: WakeEvent[];
  now?: Date;
};

export function WakeDayPicker({
  label,
  selectedDay,
  onSelectedDayChange,
  events: _events,
  wakes: _wakes,
  now = new Date(),
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const canGoForward = !isSameDay(selectedDay, now);

  const shift = (delta: number) => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + delta);
    if (startOfDay(next).getTime() > startOfDay(now).getTime()) return;
    onSelectedDayChange(next);
  };

  return (
    <View>
      <View style={styles.nav}>
        <Pressable
          onPress={() => shift(-1)}
          style={[styles.navBtn, { borderColor: colors.border }]}>
          <Text style={[styles.navBtnText, { color: colors.text }]}>‹</Text>
        </Pressable>
        <View style={styles.center}>
          <DatePickerField
            label={label}
            value={selectedDay}
            onChange={onSelectedDayChange}
            maximumDate={now}
            style={{ marginBottom: 0 }}
          />
        </View>
        <Pressable
          onPress={() => shift(1)}
          disabled={!canGoForward}
          style={[
            styles.navBtn,
            { borderColor: colors.border, opacity: canGoForward ? 1 : 0.35 },
          ]}>
          <Text style={[styles.navBtnText, { color: colors.text }]}>›</Text>
        </Pressable>
      </View>
      <Text style={[styles.range, { color: colors.textSecondary }]}>
        {formatCalendarDayLabel(selectedDay)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  center: { flex: 1 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navBtnText: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  range: { fontSize: 14, marginBottom: spacing.sm },
});
