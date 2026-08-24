import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { DateTimePickerField } from '@/components/DateTimePickerField';
import { useTranslation } from '@/lib/i18n';
import { deriveOnsetMethodFromSettle, resolveSettleFields } from '@/lib/sleepSettle';
import { useAppStore } from '@/store/useAppStore';
import type {
  SleepEvent,
  SleepPlace,
  SleepSettleAid,
  SleepSettleQuality,
  SleepWakeManner,
  SleepWakeMood,
} from '@/types';

const SETTLE_MINUTE_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];
const SETTLE_QUALITY_OPTIONS: SleepSettleQuality[] = [
  'calm',
  'restless',
  'fussy',
  'fighting',
];
const SETTLE_AID_OPTIONS: SleepSettleAid[] = [
  'breast',
  'held',
  'on_mom',
  'on_dad',
  'visual_shield',
  'combination',
];
const SLEEP_PLACE_OPTIONS: SleepPlace[] = ['mom', 'dad', 'crib'];
const WAKE_MANNER_OPTIONS: SleepWakeManner[] = ['woken', 'self'];
const WAKE_MOOD_OPTIONS: SleepWakeMood[] = ['fussy', 'ok', 'happy'];

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
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const [type, setType] = useState<SleepEvent['type']>('nap');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [ongoing, setOngoing] = useState(false);
  const [settleMinutes, setSettleMinutes] = useState<number | null>(null);
  const [settleMinutesText, setSettleMinutesText] = useState('');
  const [settleQuality, setSettleQuality] = useState<SleepSettleQuality | null>(null);
  const [settleAid, setSettleAid] = useState<SleepSettleAid | null>(null);
  const [sleepPlace, setSleepPlace] = useState<SleepPlace | null>(null);
  const [wakeManner, setWakeManner] = useState<SleepWakeManner | null>(null);
  const [wakeMood, setWakeMood] = useState<SleepWakeMood | null>(null);

  useEffect(() => {
    if (visible) {
      setType(initial?.type ?? 'nap');
      setStartTime(initial ? new Date(initial.startTime) : new Date());
      setEndTime(initial?.endTime ? new Date(initial.endTime) : new Date());
      setOngoing(initial ? initial.endTime === null : false);
      const resolved = resolveSettleFields({
        onsetMethod: initial?.onsetMethod,
        settleMinutes: initial?.settleMinutes,
        settleQuality: initial?.settleQuality,
        settleAid: initial?.settleAid,
        sleepPlace: initial?.sleepPlace,
      });
      setSettleMinutes(resolved.settleMinutes);
      setSettleMinutesText(
        resolved.settleMinutes != null ? String(resolved.settleMinutes) : ''
      );
      setSettleQuality(resolved.settleQuality);
      setSettleAid(resolved.settleAid);
      setSleepPlace(resolved.sleepPlace);
      setWakeManner(initial?.wakeManner ?? null);
      setWakeMood(initial?.wakeMood ?? null);
    }
  }, [visible, initial]);

  if (!visible) return null;

  const save = () => {
    const parsed =
      settleMinutesText.trim() === ''
        ? null
        : Math.max(0, Math.round(Number(settleMinutesText)));
    const minutes =
      parsed != null && Number.isFinite(parsed) ? parsed : settleMinutes;
    onSave({
      babyId,
      type,
      startTime: startTime.toISOString(),
      endTime: ongoing ? null : endTime.toISOString(),
      settleMinutes: minutes,
      settleQuality,
      settleAid,
      sleepPlace,
      onsetMethod: deriveOnsetMethodFromSettle({
        settleAid,
        sleepPlace,
        onsetMethod: initial?.onsetMethod ?? null,
      }),
      wakeManner: ongoing ? null : wakeManner,
      wakeMood: ongoing ? null : wakeMood,
      extension: initial?.extension ?? null,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>
            {initial ? t('log.editSleep') : t('log.addSleep')}
          </Text>

          <View style={styles.chips}>
            {(['nap', 'night'] as const).map((sleepType) => (
              <Pressable
                key={sleepType}
                onPress={() => setType(sleepType)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: type === sleepType ? colors.tint : colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <Text
                  style={{
                    color: type === sleepType ? '#FFF' : colors.text,
                    fontWeight: '700',
                    fontSize: 16,
                  }}>
                  {sleepType === 'nap' ? t('timeline.nap') : t('timeline.bedtime')}
                </Text>
              </Pressable>
            ))}
          </View>

          <DateTimePickerField
            label={t('common.start')}
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
            <Text style={[styles.ongoingLabel, { color: colors.text }]}>
              {t('log.stillAsleep')}
            </Text>
          </Pressable>

          {!ongoing && (
            <DateTimePickerField
              label={t('common.end')}
              value={endTime}
              onChange={setEndTime}
              minimumDate={startTime}
              maximumDate={new Date()}
              style={{ marginTop: spacing.sm }}
            />
          )}

          <Text style={[styles.section, { color: colors.textSecondary }]}>
            {t('home.sleepContextSettleMinutes')}
          </Text>
          <View style={styles.wrap}>
            {SETTLE_MINUTE_OPTIONS.map((opt) => {
              const selected = settleMinutes === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    const next = selected ? null : opt;
                    setSettleMinutes(next);
                    setSettleMinutesText(next != null ? String(next) : '');
                  }}
                  style={[
                    styles.contextChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.tint : colors.card,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? '#FFF' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {t('home.sleepContextMinutesChip', { min: opt })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={settleMinutesText}
            onChangeText={(text) => {
              setSettleMinutesText(text.replace(/[^\d]/g, ''));
              const n = Number(text.replace(/[^\d]/g, ''));
              setSettleMinutes(Number.isFinite(n) && text.trim() !== '' ? n : null);
            }}
            keyboardType="number-pad"
            placeholder={t('home.sleepContextSettleMinutesCustom')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.minutesInput,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.card,
              },
            ]}
          />

          <Text style={[styles.section, { color: colors.textSecondary }]}>
            {t('home.sleepContextSettleQuality')}
          </Text>
          <View style={styles.wrap}>
            {SETTLE_QUALITY_OPTIONS.map((opt) => {
              const selected = settleQuality === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSettleQuality(selected ? null : opt)}
                  style={[
                    styles.contextChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.tint : colors.card,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? '#FFF' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {t(`sleepSettleQuality.${opt}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, { color: colors.textSecondary }]}>
            {t('home.sleepContextSettleAid')}
          </Text>
          <View style={styles.wrap}>
            {SETTLE_AID_OPTIONS.map((opt) => {
              const selected = settleAid === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSettleAid(selected ? null : opt)}
                  style={[
                    styles.contextChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.tint : colors.card,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? '#FFF' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {t(`sleepSettleAid.${opt}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, { color: colors.textSecondary }]}>
            {t('home.sleepContextSleepPlace')}
          </Text>
          <View style={styles.wrap}>
            {SLEEP_PLACE_OPTIONS.map((opt) => {
              const selected = sleepPlace === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSleepPlace(selected ? null : opt)}
                  style={[
                    styles.contextChip,
                    {
                      borderColor: colors.border,
                      backgroundColor: selected ? colors.tint : colors.card,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? '#FFF' : colors.text,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                    {t(`sleepPlace.${opt}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!ongoing ? (
            <>
              <Text style={[styles.section, { color: colors.textSecondary }]}>
                {t('home.sleepContextWakeManner')}
              </Text>
              <View style={styles.wrap}>
                {WAKE_MANNER_OPTIONS.map((opt) => {
                  const selected = wakeManner === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setWakeManner(selected ? null : opt)}
                      style={[
                        styles.contextChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: selected ? colors.tint : colors.card,
                        },
                      ]}>
                      <Text
                        style={{
                          color: selected ? '#FFF' : colors.text,
                          fontWeight: '600',
                          fontSize: 13,
                        }}>
                        {t(`sleepWakeManner.${opt}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.section, { color: colors.textSecondary }]}>
                {t('home.sleepContextWakeMood')}
              </Text>
              <View style={styles.wrap}>
                {WAKE_MOOD_OPTIONS.map((opt) => {
                  const selected = wakeMood === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setWakeMood(selected ? null : opt)}
                      style={[
                        styles.contextChip,
                        {
                          borderColor: colors.border,
                          backgroundColor: selected ? colors.tint : colors.card,
                        },
                      ]}>
                      <Text
                        style={{
                          color: selected ? '#FFF' : colors.text,
                          fontWeight: '600',
                          fontSize: 13,
                        }}>
                        {t(`sleepWakeMood.${opt}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <View style={styles.actions}>
            <BigButton
              title={t('common.cancel')}
              variant="secondary"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <BigButton
              title={initial ? t('common.save') : t('common.log')}
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
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
  },
  ongoingLabel: { fontSize: 16, fontWeight: '600' },
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  contextChip: {
    minHeight: touchTarget.minHeight - 8,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  minutesInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: touchTarget.minHeight - 4,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xl,
  },
});
