import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import type { BathEvent } from '@/types';
import { DatePickerField } from '@/components/DatePickerField';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';
import { formatLastCareWhen, getLastBath } from '@/lib/lastCareEvents';

type Props = {
  visible: boolean;
  initial?: BathEvent | null;
  babyId: string;
  onSave: (event: Omit<BathEvent, 'id'>) => void;
  onClose: () => void;
};

export function BathLogModal({ visible, initial, babyId, onSave, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const baths = useAppStore((s) => s.baths);
  const t = useTranslation(locale);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (visible) {
      setTime(initial ? new Date(initial.time) : new Date());
    }
  }, [visible, initial]);

  if (!visible) return null;

  const lastBath = getLastBath(baths, initial?.id);
  const lastWhen = lastBath
    ? formatLastCareWhen(lastBath.time, {
        today: t('common.today'),
        yesterday: t('common.yesterday'),
      })
    : null;

  const save = () => {
    onSave({
      babyId,
      time: time.toISOString(),
      notes: initial?.notes ?? null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {initial ? t('bath.editTitle') : t('bath.title')}
        </Text>

        {lastWhen ? (
          <Text style={[styles.lastHint, { color: colors.textSecondary }]}>
            {t('bath.lastBath', { when: lastWhen })}
          </Text>
        ) : null}

        <DatePickerField
          label={t('bath.time')}
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
            title={initial ? t('common.save') : t('bath.addNow')}
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
  actions: { flexDirection: 'row', marginTop: spacing.xl },
});
