import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import type { DiaperEvent } from '@/types';
import { DatePickerField } from '@/components/DatePickerField';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';
import { formatLastCareWhen, getLastDirtyDiaper } from '@/lib/lastCareEvents';

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
  const locale = useAppStore((s) => s.locale);
  const diapers = useAppStore((s) => s.diapers);
  const t = useTranslation(locale);
  const [diaperType, setDiaperType] = useState<DiaperEvent['diaperType']>('wet');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (visible) {
      setDiaperType(initial?.diaperType ?? 'wet');
      setTime(initial ? new Date(initial.time) : new Date());
    }
  }, [visible, initial]);

  if (!visible) return null;

  const lastDirty = getLastDirtyDiaper(diapers, initial?.id);
  const lastWhen = lastDirty
    ? formatLastCareWhen(lastDirty.time, {
        today: t('common.today'),
        yesterday: t('common.yesterday'),
      })
    : null;

  const typeLabel = (type: DiaperEvent['diaperType']) =>
    type === 'wet' ? t('diaper.wet') : type === 'dirty' ? t('diaper.dirty') : t('diaper.mixed');

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
          {initial ? t('diaper.editTitle') : t('diaper.title')}
        </Text>

        {lastWhen ? (
          <Text style={[styles.lastHint, { color: colors.textSecondary }]}>
            {t('diaper.lastDirty', { when: lastWhen })}
          </Text>
        ) : null}

        <View style={styles.chips}>
          {(['wet', 'dirty', 'mixed'] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setDiaperType(type)}
              style={[
                styles.chip,
                {
                  backgroundColor: diaperType === type ? colors.diaper : colors.card,
                  borderColor: colors.border,
                },
              ]}>
              <Text
                style={{
                  color: diaperType === type ? '#FFF' : colors.text,
                  fontWeight: '700',
                  fontSize: 16,
                }}>
                {typeLabel(type)}
              </Text>
            </Pressable>
          ))}
        </View>

        <DatePickerField
          label={t('diaper.time')}
          value={time}
          onChange={setTime}
          maximumDate={new Date()}
        />

        <View style={styles.actions}>
          <BigButton
            title={t('common.cancel')}
            variant="secondary"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <BigButton
            title={initial ? t('common.save') : t('diaper.logNow')}
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
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.sm },
  lastHint: {
    fontSize: 15,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
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
