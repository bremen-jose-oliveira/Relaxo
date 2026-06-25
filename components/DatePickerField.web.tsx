import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  label?: string;
  style?: ViewStyle;
};

function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromInputValue(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function DatePickerField({
  value,
  onChange,
  maximumDate = new Date(),
  minimumDate,
  label,
  style,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <View style={style}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <input
        type="date"
        value={toInputValue(value)}
        max={toInputValue(maximumDate)}
        min={minimumDate ? toInputValue(minimumDate) : undefined}
        onChange={(e) => {
          if (e.target.value) onChange(fromInputValue(e.target.value));
        }}
        style={{
          width: '100%',
          minHeight: touchTarget.minHeight,
          fontSize: 18,
          fontWeight: 600,
          padding: `${spacing.md}px`,
          borderRadius: 14,
          border: `1.5px solid ${colors.border}`,
          backgroundColor: colors.card,
          color: colors.text,
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
});
