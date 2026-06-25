import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
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

function formatDisplayDateTime(date: Date): string {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DateTimePickerField({
  value,
  onChange,
  maximumDate = new Date(),
  minimumDate,
  label,
  style,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    setDraft(value);
    setVisible(true);
  };

  const confirm = () => {
    onChange(draft);
    setVisible(false);
  };

  const cancel = () => setVisible(false);

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setVisible(false);
    if (event.type === 'set' && date) onChange(date);
  };

  return (
    <View style={style}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      )}
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Text style={[styles.fieldText, { color: colors.text }]}>
          {formatDisplayDateTime(value)}
        </Text>
      </Pressable>

      {Platform.OS === 'android' && visible && (
        <DateTimePicker
          value={draft}
          mode="datetime"
          display="default"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={visible} transparent animationType="slide">
          <Pressable style={styles.backdrop} onPress={cancel} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
              <Pressable onPress={cancel} hitSlop={12}>
                <Text style={[styles.toolbarBtn, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Text style={[styles.toolbarTitle, { color: colors.text }]}>
                {label ?? 'Date & time'}
              </Text>
              <Pressable onPress={confirm} hitSlop={12}>
                <Text style={[styles.toolbarBtn, styles.toolbarDone, { color: colors.tint }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="datetime"
              display="spinner"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              onChange={(_, date) => date && setDraft(date)}
              themeVariant={scheme}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  field: {
    minHeight: touchTarget.minHeight,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  toolbarBtn: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 64,
  },
  toolbarDone: {
    textAlign: 'right',
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  iosPicker: {
    height: 220,
  },
});
