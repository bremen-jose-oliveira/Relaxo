import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import type { DiaperEvent } from '@/types';
import { DatePickerField } from '@/components/DatePickerField';

type Props = {
  visible: boolean;
  initial?: DiaperEvent | null;
  babyId: string;
  onSave: (event: Omit<DiaperEvent, 'id'>) => void;
  onClose: () => void;
};

export function DiaperLogModal({ visible, initial, babyId, onSave, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [diaperType, setDiaperType] = useState<DiaperEvent['diaperType']>('wet');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (visible) {
      setDiaperType(initial?.diaperType ?? 'wet');
      setTime(initial ? new Date(initial.time) : new Date());
    }
  }, [visible, initial]);

  if (!visible) return null;

  const save = () => {
    onSave({
      babyId,
      diaperType,
      time: time.toISOString(),
      notes: initial?.notes ?? null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {initial ? 'Edit diaper' : 'Log diaper'}
        </Text>

        <View style={styles.chips}>
          {(['wet', 'dirty', 'mixed'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setDiaperType(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: diaperType === t ? colors.diaper : colors.card,
                  borderColor: colors.border,
                },
              ]}>
              <Text
                style={{
                  color: diaperType === t ? '#FFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                {t === 'wet' ? 'Wet' : t === 'dirty' ? 'Dirty' : 'Mixed'}
              </Text>
            </Pressable>
          ))}
        </View>

        <DatePickerField
          label="Time"
          value={time}
          onChange={setTime}
          maximumDate={new Date()}
        />

        <View style={styles.actions}>
          <BigButton title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <BigButton
            title={initial ? 'Save' : 'Log now'}
            onPress={save}
            style={{ flex: 1, marginLeft: spacing.sm }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
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
  actions: { flexDirection: 'row', marginTop: spacing.xl },
});
