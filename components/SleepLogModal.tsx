import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { DateTimePickerField } from '@/components/DateTimePickerField';
import type { SleepEvent } from '@/types';

type Props = {
  visible: boolean;
  initial?: SleepEvent | null;
  babyId: string;
  onSave: (event: Omit<SleepEvent, 'id'>) => void;
  onClose: () => void;
};

export function SleepLogModal({ visible, initial, babyId, onSave, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [type, setType] = useState<SleepEvent['type']>('nap');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [ongoing, setOngoing] = useState(false);

  useEffect(() => {
    if (visible) {
      setType(initial?.type ?? 'nap');
      setStartTime(initial ? new Date(initial.startTime) : new Date());
      setEndTime(initial?.endTime ? new Date(initial.endTime) : new Date());
      setOngoing(initial ? initial.endTime === null : false);
    }
  }, [visible, initial]);

  if (!visible) return null;

  const save = () => {
    onSave({
      babyId,
      type,
      startTime: startTime.toISOString(),
      endTime: ongoing ? null : endTime.toISOString(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>
          {initial ? 'Edit sleep' : 'Log sleep'}
        </Text>

        <View style={styles.chips}>
          {(['nap', 'night'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: type === t ? colors.tint : colors.card,
                  borderColor: colors.border,
                },
              ]}>
              <Text
                style={{
                  color: type === t ? '#FFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                {t === 'nap' ? 'Nap' : 'Bedtime'}
              </Text>
            </Pressable>
          ))}
        </View>

        <DateTimePickerField
          label="Start"
          value={startTime}
          onChange={setStartTime}
          maximumDate={new Date()}
        />

        <Pressable
          onPress={() => setOngoing((v) => !v)}
          style={[styles.ongoingRow, { borderColor: colors.border }]}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: colors.tint,
                backgroundColor: ongoing ? colors.tint : 'transparent',
              },
            ]}
          />
          <Text style={[styles.ongoingLabel, { color: colors.text }]}>Still asleep (ongoing)</Text>
        </Pressable>

        {!ongoing && (
          <DateTimePickerField
            label="End"
            value={endTime}
            onChange={setEndTime}
            minimumDate={startTime}
            maximumDate={new Date()}
            style={{ marginTop: spacing.sm }}
          />
        )}

        <View style={styles.actions}>
          <BigButton title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <BigButton
            title={initial ? 'Save' : 'Log'}
            onPress={save}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: spacing.sm,
  },
  ongoingLabel: { fontSize: 16, fontWeight: '500' },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
});
