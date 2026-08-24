import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { resolveSettleFields } from '@/lib/sleepSettle';
import type {
  SleepOnsetMethod,
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

export type SleepContextSelection = {
  onsetMethod: SleepOnsetMethod | null;
  settleMinutes: number | null;
  settleQuality: SleepSettleQuality | null;
  settleAid: SleepSettleAid | null;
  sleepPlace: SleepPlace | null;
  wakeManner: SleepWakeManner | null;
  wakeMood: SleepWakeMood | null;
};

export function SleepContextSheet({
  visible,
  initial,
  onSave,
  onSkip,
  t,
}: {
  visible: boolean;
  initial?: Partial<SleepContextSelection> | null;
  onSave: (selection: SleepContextSelection) => void;
  onSkip: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const [settleMinutes, setSettleMinutes] = useState<number | null>(null);
  const [settleMinutesText, setSettleMinutesText] = useState('');
  const [settleQuality, setSettleQuality] = useState<SleepSettleQuality | null>(null);
  const [settleAid, setSettleAid] = useState<SleepSettleAid | null>(null);
  const [sleepPlace, setSleepPlace] = useState<SleepPlace | null>(null);
  const [wakeManner, setWakeManner] = useState<SleepWakeManner | null>(null);
  const [wakeMood, setWakeMood] = useState<SleepWakeMood | null>(null);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, initial]);

  const save = () => {
    const parsed =
      settleMinutesText.trim() === ''
        ? null
        : Math.max(0, Math.round(Number(settleMinutesText)));
    const minutes =
      parsed != null && Number.isFinite(parsed) ? parsed : settleMinutes;
    onSave({
      onsetMethod: null,
      settleMinutes: minutes,
      settleQuality,
      settleAid,
      sleepPlace,
      wakeManner,
      wakeMood,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        {/* Separate dismiss layer — nesting Pressable around ScrollView blocks scroll on some phones. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg,
            },
          ]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces
            nestedScrollEnabled>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('home.sleepContextTitle')}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('home.sleepContextHint')}
            </Text>

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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
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
                  backgroundColor: colors.background,
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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
                        minWidth: '30%',
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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
                        minWidth: '45%',
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
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: selected ? colors.tint : colors.background,
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

            <Pressable
              onPress={save}
              style={[styles.done, { backgroundColor: colors.tint }]}>
              <Text style={styles.doneText}>{t('home.sleepContextDone')}</Text>
            </Pressable>
            <Pressable onPress={onSkip} style={styles.skip}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {t('home.extensionSkip')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '88%',
    // Constrain height so ScrollView can scroll instead of expanding forever.
    flexGrow: 0,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
    flexGrow: 0,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  section: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
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
    marginBottom: spacing.sm,
    fontSize: 15,
  },
  done: {
    marginTop: spacing.md,
    minHeight: touchTarget.minHeight,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { fontSize: 15 },
});
