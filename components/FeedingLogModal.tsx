import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { DatePickerField } from '@/components/DatePickerField';
import { useAppStore, useOngoingFeeding } from '@/store/useAppStore';
import { formatTime } from '@/lib/dateUtils';
import type { FeedingEvent } from '@/types';

type Props = {
  visible: boolean;
  initial?: FeedingEvent | null;
  babyId: string;
  onClose: () => void;
};

type Mode = 'pick' | 'breast' | 'bottle' | 'solid';

export function FeedingLogModal({ visible, initial, babyId, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const ongoing = useOngoingFeeding();
  const startBreastFeed = useAppStore((s) => s.startBreastFeed);
  const endBreastFeed = useAppStore((s) => s.endBreastFeed);
  const addFeeding = useAppStore((s) => s.addFeeding);
  const editFeeding = useAppStore((s) => s.editFeeding);

  const [mode, setMode] = useState<Mode>('pick');
  const [side, setSide] = useState<FeedingEvent['side']>('left');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'ml' | 'oz' | 'g'>('ml');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setMode(initial.feedType);
      setSide(initial.side ?? 'left');
      setAmount(initial.amount?.toString() ?? '');
      setUnit(initial.unit ?? (initial.feedType === 'solid' ? 'g' : 'ml'));
      setStartTime(new Date(initial.startTime));
      setEndTime(initial.endTime ? new Date(initial.endTime) : new Date());
    } else {
      setMode('pick');
      setSide('left');
      setAmount('');
      setUnit('ml');
      setStartTime(new Date());
      setEndTime(new Date());
    }
  }, [visible, initial]);

  if (!visible) return null;

  const saveInstant = async (feedType: 'bottle' | 'solid') => {
    const parsed = parseFloat(amount);
    const now = new Date().toISOString();
    const payload: Omit<FeedingEvent, 'id'> = {
      babyId,
      feedType,
      startTime: initial?.startTime ?? now,
      endTime: initial?.endTime ?? now,
      side: null,
      amount: Number.isFinite(parsed) ? parsed : null,
      unit: feedType === 'solid' ? 'g' : unit,
      notes: initial?.notes ?? null,
    };
    if (initial) await editFeeding({ ...payload, id: initial.id });
    else await addFeeding(payload);
    onClose();
  };

  const saveEdited = async () => {
    if (!initial) return;
    const parsed = parseFloat(amount);
    await editFeeding({
      ...initial,
      side: initial.feedType === 'breast' ? side : null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      amount: Number.isFinite(parsed) ? parsed : null,
      unit: initial.feedType === 'solid' ? 'g' : initial.feedType === 'bottle' ? unit : null,
    });
    onClose();
  };

  const startBreast = async () => {
    await startBreastFeed(side);
    onClose();
  };

  const endBreast = async () => {
    await endBreastFeed();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {initial ? 'Edit feeding' : 'Log feeding'}
        </Text>

        {initial ? (
          <View>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              {initial.feedType === 'breast'
                ? 'Breast feed'
                : initial.feedType === 'bottle'
                  ? 'Bottle feed'
                  : 'Solid feed'}
            </Text>
            {initial.feedType === 'breast' && (
              <View style={styles.chips}>
                {(['left', 'right', 'both'] as const).map((s) => (
                  <Chip
                    key={s}
                    label={s === 'both' ? 'Both' : s === 'left' ? 'Left' : 'Right'}
                    selected={side === s}
                    color={colors.feeding}
                    onPress={() => setSide(s)}
                    colors={colors}
                  />
                ))}
              </View>
            )}
            {(initial.feedType === 'bottle' || initial.feedType === 'solid') && (
              <AmountInput
                amount={amount}
                unit={initial.feedType === 'solid' ? 'g' : unit}
                onAmount={setAmount}
                onUnit={setUnit}
                solid={initial.feedType === 'solid'}
                colors={colors}
              />
            )}
            <DatePickerField label="Start" value={startTime} onChange={setStartTime} maximumDate={new Date()} />
            <DatePickerField
              label="End"
              value={endTime}
              onChange={setEndTime}
              maximumDate={new Date()}
              style={{ marginTop: spacing.md }}
            />
            <BigButton title="Save" onPress={saveEdited} style={{ marginTop: spacing.lg }} />
          </View>
        ) : mode === 'pick' ? (
          <View style={styles.pickGrid}>
            <BigButton title="Breast" onPress={() => setMode('breast')} />
            <BigButton
              title="Bottle"
              variant="secondary"
              onPress={() => setMode('bottle')}
              style={{ marginTop: spacing.sm }}
            />
            <BigButton
              title="Solid"
              variant="secondary"
              onPress={() => {
                setUnit('g');
                setMode('solid');
              }}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : mode === 'breast' ? (
          <View>
            {ongoing ? (
              <>
                <Text style={[styles.hint, { color: colors.text }]}>
                  Feeding since {formatTime(new Date(ongoing.startTime))}
                  {ongoing.side ? ` · ${ongoing.side} side` : ''}
                </Text>
                <BigButton title="End feeding" onPress={endBreast} style={{ marginTop: spacing.lg }} />
              </>
            ) : (
              <>
                <Text style={[styles.section, { color: colors.textSecondary }]}>Side</Text>
                <View style={styles.chips}>
                  {(['left', 'right', 'both'] as const).map((s) => (
                    <Chip
                      key={s}
                      label={s === 'both' ? 'Both' : s === 'left' ? 'Left' : 'Right'}
                      selected={side === s}
                      color={colors.feeding}
                      onPress={() => setSide(s)}
                      colors={colors}
                    />
                  ))}
                </View>
                <BigButton title="Start feeding" onPress={startBreast} style={{ marginTop: spacing.lg }} />
              </>
            )}
          </View>
        ) : (
          <View>
            <AmountInput
              amount={amount}
              unit={mode === 'solid' ? 'g' : unit}
              onAmount={setAmount}
              onUnit={setUnit}
              solid={mode === 'solid'}
              colors={colors}
            />
            <BigButton
              title="Log now"
              onPress={() => saveInstant(mode)}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}

        <BigButton title="Cancel" variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
      </SafeAreaView>
    </Modal>
  );
}

function Chip({
  label,
  selected,
  color,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
  colors: (typeof Colors)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? color : colors.card,
          borderColor: colors.border,
        },
      ]}>
      <Text style={{ color: selected ? '#FFF' : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function AmountInput({
  amount,
  unit,
  onAmount,
  onUnit,
  solid,
  colors,
}: {
  amount: string;
  unit: 'ml' | 'oz' | 'g';
  onAmount: (v: string) => void;
  onUnit: (u: 'ml' | 'oz') => void;
  solid: boolean;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={onAmount}
        keyboardType="decimal-pad"
        placeholder={solid ? 'grams' : 'amount'}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
      />
      {!solid && (
        <View style={[styles.chips, { marginTop: spacing.sm }]}>
          {(['ml', 'oz'] as const).map((u) => (
            <Chip
              key={u}
              label={u}
              selected={unit === u}
              color={colors.feeding}
              onPress={() => onUnit(u)}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.lg },
  pickGrid: {},
  section: { fontSize: 14, fontWeight: '500', marginBottom: spacing.sm },
  hint: { fontSize: 17, lineHeight: 24 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    minHeight: touchTarget.minHeight - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    fontSize: 18,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget.minHeight,
  },
});
