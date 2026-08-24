import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { Card, InfoRow } from '@/components/Card';
import { DatePickerField } from '@/components/DatePickerField';
import type { NapGoal } from '@/types';
import { ageInWeeks, formatDateKey } from '@/lib/dateUtils';
import { formatBabyAge } from '@/lib/sleepInsights';
import { getAgeWakeWindowRange } from '@/lib/predictNextSleep';
import { resolveLocale, useTranslation } from '@/lib/i18n';
import { formatNapScheduleLabel, resolveNapGoal } from '@/lib/napSchedule';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';

const ROUTINE_NAP_OPTIONS: NapGoal[] = [2, 3, 4];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const saveBaby = useAppStore((s) => s.saveBaby);
  const removeBaby = useAppStore((s) => s.removeBaby);
  const setActiveBaby = useAppStore((s) => s.setActiveBaby);
  const babies = useAppStore((s) => s.babies);
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const initialize = useAppStore((s) => s.initialize);
  const events = useAppStore((s) => s.events);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();

  const householdId = useAuthStore((s) => s.householdId);
  const syncNow = useAuthStore((s) => s.syncNow);

  const [name, setName] = useState(baby?.name ?? '');
  const [birthDate, setBirthDate] = useState(
    baby?.birthDate ? new Date(baby.birthDate + 'T00:00:00') : new Date()
  );
  const [scheduleMode, setScheduleMode] = useState<'auto' | 'routine'>(
    baby?.napGoal == null ? 'auto' : 'routine'
  );
  const [routineNaps, setRoutineNaps] = useState<NapGoal>(baby?.napGoal ?? 3);
  const [trackFeedingDuration, setTrackFeedingDuration] = useState(
    baby?.trackFeedingDuration ?? false
  );
  const [easilyOverstimulated, setEasilyOverstimulated] = useState(
    baby?.easilyOverstimulated ?? false
  );
  const [highNeed, setHighNeed] = useState(baby?.highNeed ?? false);
  const [saving, setSaving] = useState(false);
  /** True while composing a new baby (not editing the active one). */
  const [isAddingBaby, setIsAddingBaby] = useState(false);

  useEffect(() => {
    if (isAddingBaby) return;
    if (baby) {
      setName(baby.name);
      setBirthDate(new Date(baby.birthDate + 'T00:00:00'));
      setScheduleMode(baby.napGoal == null ? 'auto' : 'routine');
      setRoutineNaps(baby.napGoal ?? 3);
      setTrackFeedingDuration(baby.trackFeedingDuration ?? false);
      setEasilyOverstimulated(baby.easilyOverstimulated ?? false);
      setHighNeed(baby.highNeed ?? false);
    }
  }, [baby, isAddingBaby]);

  const resolvedSchedule = useMemo(() => {
    if (!baby) return null;
    const previewBaby = {
      ...baby,
      napGoal: scheduleMode === 'auto' ? null : routineNaps,
    };
    return resolveNapGoal(previewBaby, events, wakes, new Date());
  }, [baby, scheduleMode, routineNaps, events, wakes]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('profile.nameRequired'), t('profile.nameRequiredMsg'));
      return;
    }

    setSaving(true);
    try {
      const dateStr = formatDateKey(birthDate);
      const creating = isAddingBaby || !baby;
      await saveBaby({
        id: creating ? undefined : baby.id,
        name: name.trim(),
        birthDate: dateStr,
        napGoal: scheduleMode === 'auto' ? null : routineNaps,
        trackFeedingDuration,
        easilyOverstimulated,
        highNeed,
      });
      setIsAddingBaby(false);
      if (householdId) {
        const sync = await syncNow();
        if (!sync.ok) {
          Alert.alert(t('profile.saved'), sync.error ?? t('profile.syncFailed'));
          return;
        }
        await initialize();
      }
      Alert.alert(t('profile.saved'), t('profile.savedMsg'));
    } finally {
      setSaving(false);
    }
  };

  const handleStartAddBaby = () => {
    setIsAddingBaby(true);
    setName('');
    setBirthDate(new Date());
    setScheduleMode('auto');
    setRoutineNaps(3);
    setTrackFeedingDuration(false);
    setEasilyOverstimulated(false);
    setHighNeed(false);
  };

  const handleSelectBaby = (id: string) => {
    setIsAddingBaby(false);
    void setActiveBaby(id);
  };

  const handleRemoveBaby = () => {
    if (!baby) return;
    Alert.alert(
      t('profile.removeBabyTitle'),
      t('profile.removeBabyMsg', { name: baby.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.removeBaby'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await removeBaby(baby.id);
              if (!result.ok) {
                Alert.alert(t('profile.syncFailed'), result.error ?? t('profile.syncFailed'));
                return;
              }
              setIsAddingBaby(false);
              if (householdId) {
                await syncNow();
                await initialize();
              }
            })();
          },
        },
      ]
    );
  };

  const weeks = ageInWeeks(formatDateKey(birthDate), new Date());
  const wakeRange = getAgeWakeWindowRange(weeks);
  const ageLabel = formatBabyAge(formatDateKey(birthDate), new Date(), resolveLocale(locale));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('profile.subtitle')}
        </Text>

        {babies.length > 0 ? (
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
              {t('profile.babies')}
            </Text>
            <Text style={[styles.importHint, { color: colors.textSecondary }]}>
              {t('profile.babiesHint')}
            </Text>
            <View style={styles.babyChipRow}>
              {babies.map((b) => {
                const selected = !isAddingBaby && baby?.id === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => handleSelectBaby(b.id)}
                    style={[
                      styles.babyChip,
                      {
                        backgroundColor: selected ? colors.tint : colors.card,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text
                      style={{
                        color: selected ? '#FFF' : colors.text,
                        fontWeight: '700',
                        fontSize: 14,
                      }}>
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.babyActions}>
              <BigButton
                title={t('profile.addBaby')}
                variant="secondary"
                onPress={handleStartAddBaby}
                style={{ flex: 1, marginBottom: 0 }}
              />
              {baby && !isAddingBaby ? (
                <BigButton
                  title={t('profile.removeBaby')}
                  variant="secondary"
                  onPress={handleRemoveBaby}
                  style={{ flex: 1, marginBottom: 0 }}
                />
              ) : null}
            </View>
          </Card>
        ) : null}

        {babies.length === 0 && !isAddingBaby ? (
          <Card style={styles.formCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('profile.noBabyYet')}
            </Text>
            <Text style={[styles.importHint, { color: colors.textSecondary }]}>
              {t('profile.noBabyYetHint')}
            </Text>
            <BigButton title={t('profile.createProfile')} onPress={handleStartAddBaby} />
          </Card>
        ) : null}

        {(baby && !isAddingBaby) || isAddingBaby ? (
          <Card style={styles.formCard}>
            {isAddingBaby ? (
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
                {t('profile.addBaby')}
              </Text>
            ) : null}
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('profile.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('profile.namePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />

            <DatePickerField
              label={t('profile.birthDate')}
              value={birthDate}
              onChange={setBirthDate}
              maximumDate={new Date()}
              style={{ marginTop: spacing.md }}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>
              {t('profile.sleepSchedule')}
            </Text>
            <Text style={[styles.napGoalHint, { color: colors.textSecondary }]}>
              {t('profile.routineHint')}
            </Text>
            <View style={styles.modeRow}>
              {(
                [
                  ['auto', t('profile.automatic')],
                  ['routine', t('profile.setRoutine')],
                ] as const
              ).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  onPress={() => setScheduleMode(mode)}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor: scheduleMode === mode ? colors.tint : colors.card,
                      borderColor: colors.border,
                    },
                  ]}>
                  <Text
                    style={{
                      color: scheduleMode === mode ? '#FFF' : colors.text,
                      fontWeight: '700',
                      fontSize: 15,
                    }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {scheduleMode === 'routine' && (
              <>
                <Text style={[styles.routineLabel, { color: colors.textSecondary }]}>
                  {t('profile.napsPerDay')}
                </Text>
                <View style={styles.napGoalRow}>
                  {ROUTINE_NAP_OPTIONS.map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setRoutineNaps(n)}
                      style={[
                        styles.napGoalChip,
                        {
                          backgroundColor: routineNaps === n ? colors.tint : colors.card,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Text
                        style={{
                          color: routineNaps === n ? '#FFF' : colors.text,
                          fontWeight: '700',
                          fontSize: 16,
                        }}>
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {resolvedSchedule && (
              <Text style={[styles.previewSchedule, { color: colors.textSecondary }]}>
                {t('profile.predictionsUse', {
                  label: formatNapScheduleLabel(resolvedSchedule),
                })}
              </Text>
            )}

            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View style={styles.toggleText}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>
                  {t('profile.trackDuration')}
                </Text>
                <Text style={[styles.napGoalHint, { color: colors.textSecondary, marginBottom: 0 }]}>
                  {t('profile.trackDurationHint')}
                </Text>
              </View>
              <Switch
                value={trackFeedingDuration}
                onValueChange={setTrackFeedingDuration}
                trackColor={{ false: colors.border, true: colors.feeding }}
              />
            </View>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>
              {t('profile.temperament')}
            </Text>
            <Text style={[styles.napGoalHint, { color: colors.textSecondary }]}>
              {t('profile.temperamentHint')}
            </Text>

            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View style={styles.toggleText}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>
                  {t('profile.easilyOverstimulated')}
                </Text>
                <Text style={[styles.napGoalHint, { color: colors.textSecondary, marginBottom: 0 }]}>
                  {t('profile.easilyOverstimulatedHint')}
                </Text>
              </View>
              <Switch
                value={easilyOverstimulated}
                onValueChange={setEasilyOverstimulated}
                trackColor={{ false: colors.border, true: colors.tint }}
              />
            </View>

            <View style={[styles.toggleRow, { borderColor: colors.border }]}>
              <View style={styles.toggleText}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 4 }]}>
                  {t('profile.highNeed')}
                </Text>
                <Text style={[styles.napGoalHint, { color: colors.textSecondary, marginBottom: 0 }]}>
                  {t('profile.highNeedHint')}
                </Text>
              </View>
              <Switch
                value={highNeed}
                onValueChange={setHighNeed}
                trackColor={{ false: colors.border, true: colors.tint }}
              />
            </View>
          </Card>
        ) : null}

        {baby && !isAddingBaby ? (
          <Card style={styles.infoCard}>
            <InfoRow label={t('profile.age')} value={ageLabel} />
            <InfoRow
              label={t('profile.sleepSchedule')}
              value={
                resolvedSchedule
                  ? formatNapScheduleLabel(resolvedSchedule)
                  : t('profile.automatic')
              }
            />
            <InfoRow
              label={t('profile.wakeWindow')}
              value={`${wakeRange.min}–${wakeRange.max} min`}
              subtitle={t('profile.wakeWindowSub')}
            />
          </Card>
        ) : null}

        {(baby && !isAddingBaby) || isAddingBaby ? (
          <BigButton
            title={
              isAddingBaby || !baby
                ? t('profile.createProfile')
                : t('profile.saveChanges')
            }
            onPress={handleSave}
            loading={saving}
          />
        ) : null}
        {isAddingBaby ? (
          <BigButton
            title={t('common.cancel')}
            variant="secondary"
            onPress={() => {
              setIsAddingBaby(false);
              if (baby) {
                setName(baby.name);
                setBirthDate(new Date(baby.birthDate + 'T00:00:00'));
              }
            }}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15, marginTop: spacing.xs, marginBottom: spacing.lg },
  formCard: { marginBottom: spacing.md },
  infoCard: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  importHint: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  toggleText: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    fontSize: 18,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget.minHeight,
  },
  napGoalHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  babyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  babyChip: {
    minHeight: touchTarget.minHeight * 0.75,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  babyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modeChip: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  routineLabel: { fontSize: 13, marginBottom: spacing.sm },
  napGoalRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  napGoalChip: {
    flex: 1,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  previewSchedule: { fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
});
