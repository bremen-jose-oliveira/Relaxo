import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { Card, InfoRow } from '@/components/Card';
import { DatePickerField } from '@/components/DatePickerField';
import { ImportPreviewModal } from '@/components/ImportPreviewModal';
import type { AppLocale, NapGoal } from '@/types';
import { ageInWeeks, formatDateKey, formatTime } from '@/lib/dateUtils';
import { formatBabyAge } from '@/lib/sleepInsights';
import { getAgeWakeWindowRange } from '@/lib/predictNextSleep';
import { resolveLocale, useTranslation } from '@/lib/i18n';
import { formatNapScheduleLabel, resolveNapGoal } from '@/lib/napSchedule';
import {
  prepareImportFromCsv,
  buildImportPreview,
  extractBabyProfileFromCsv,
  type ColumnMapping,
  type ImportPreview,
  type ParsedCsv,
  type AutoDetectResult,
} from '@/lib/importNapper';
import {
  buildExportFilename,
  exportCareDataToCsv,
  getExportSummary,
} from '@/lib/exportCareData';
import { shareCsvFile } from '@/lib/shareCsvFile';
import {
  checkAndDownloadUpdate,
  formatUpdateId,
  getAppVersionInfo,
  openLatestBuildInstall,
  exitAppAfterInstallTrigger,
  reloadWithLatestUpdate,
} from '@/lib/appUpdates';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { newId } from '@/lib/newId';

const ROUTINE_NAP_OPTIONS: NapGoal[] = [2, 3, 4];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const saveBaby = useAppStore((s) => s.saveBaby);
  const removeBaby = useAppStore((s) => s.removeBaby);
  const setActiveBaby = useAppStore((s) => s.setActiveBaby);
  const babies = useAppStore((s) => s.babies);
  const setLocale = useAppStore((s) => s.setLocale);
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const importCareEvents = useAppStore((s) => s.importCareEvents);
  const initialize = useAppStore((s) => s.initialize);
  const events = useAppStore((s) => s.events);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const baths = useAppStore((s) => s.baths);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();

  const authConfigured = useAuthStore((s) => s.configured);
  const appleAvailable = useAuthStore((s) => s.appleAvailable);
  const authUser = useAuthStore((s) => s.user);
  const inviteCode = useAuthStore((s) => s.inviteCode);
  const householdId = useAuthStore((s) => s.householdId);
  const householdName = useAuthStore((s) => s.householdName);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  const isSyncing = useAuthStore((s) => s.isSyncing);
  const lastSyncError = useAuthStore((s) => s.lastSyncError);
  const signInApple = useAuthStore((s) => s.signInApple);
  const signOutCloud = useAuthStore((s) => s.signOut);
  const createHousehold = useAuthStore((s) => s.createHousehold);
  const syncNow = useAuthStore((s) => s.syncNow);
  const joinWithCode = useAuthStore((s) => s.joinWithCode);

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

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [autoDetect, setAutoDetect] = useState<AutoDetectResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [manualMapping, setManualMapping] = useState<Partial<ColumnMapping>>({});
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [openingBuilds, setOpeningBuilds] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  /** Baby id used while mapping an import (existing or provisional). */
  const [importBabyId, setImportBabyId] = useState<string | null>(null);

  const versionInfo = useMemo(() => getAppVersionInfo(), []);

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

  const resetImportState = useCallback(() => {
    setParsedCsv(null);
    setAutoDetect(null);
    setImportPreview(null);
    setManualMapping({});
    setImporting(false);
    setImportBabyId(null);
  }, []);

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

  const exportSummary = useMemo(() => {
    if (!baby) return null;
    return getExportSummary({
      baby,
      events,
      sleepPauses,
      feedings,
      diapers,
      baths,
      wakes,
    });
  }, [baby, events, sleepPauses, feedings, diapers, baths, wakes]);

  const handleExport = async () => {
    if (!baby) {
      Alert.alert(t('alerts.profileRequired'), t('alerts.profileRequiredExport'));
      return;
    }

    const summary = getExportSummary({
      baby,
      events,
      sleepPauses,
      feedings,
      diapers,
      baths,
      wakes,
    });

    if (summary.total === 0) {
      Alert.alert(t('alerts.nothingToExport'), t('alerts.nothingToExportMsg'));
      return;
    }

    setExporting(true);
    try {
      const csv = exportCareDataToCsv({
        baby,
        events,
        sleepPauses,
        feedings,
        diapers,
        baths,
        wakes,
      });
      const filename = buildExportFilename(baby.name);
      await shareCsvFile(csv, filename);
    } catch (err) {
      Alert.alert(
        t('alerts.exportFailed'),
        err instanceof Error ? err.message : t('alerts.exportFailed')
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const csvText = await FileSystem.readAsStringAsync(asset.uri);

      const targetBabyId = baby?.id ?? newId();
      setImportBabyId(targetBabyId);
      const prepared = prepareImportFromCsv(csvText, targetBabyId);

      setParsedCsv(prepared.parsed);
      setAutoDetect(prepared.autoDetect);
      setManualMapping(prepared.autoDetect.mapping);
      setImportPreview(prepared.preview ?? null);
      setImportModalVisible(true);
    } catch (err) {
      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Could not read the selected file.'
      );
    }
  };

  const handleBuildPreview = (mapping: ColumnMapping) => {
    if (!parsedCsv || !importBabyId) return;
    const babyProfile = extractBabyProfileFromCsv(parsedCsv);
    const preview = buildImportPreview(
      parsedCsv,
      mapping,
      importBabyId,
      'manual',
      new Date(),
      babyProfile
    );
    setImportPreview(preview);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;

    setImporting(true);
    try {
      const result = await importCareEvents(importPreview, {
        // Form name only as override; CSV Baby Name / Birth Date win by default in the store
        babyName: name.trim() || undefined,
      });
      setImportModalVisible(false);
      resetImportState();
      await initialize();

      const profile = importPreview.babyProfile ?? { name: null, birthDate: null };
      let createdNote = '';
      if (result.createdBaby) {
        const usedName =
          profile.name?.trim() || name.trim() || 'Baby';
        const usedBirth =
          profile.birthDate ??
          'earliest imported event (adjust on Profile if needed)';
        createdNote = ` Baby profile created as “${usedName}”, birth date ${usedBirth}.`;
      }

      Alert.alert(
        'Import complete',
        `${result.sleepAdded} sleep, ${result.feedingAdded} feeding, ${result.diaperAdded} diaper, ${result.bathAdded} bath, ${result.wakeAdded} wake added. ${result.duplicatesSkipped} duplicates skipped, ${result.failedSkipped} rows skipped.${createdNote}`
      );
    } catch (err) {
      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Something went wrong during import.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImport = () => {
    setImportModalVisible(false);
    resetImportState();
  };

  const handleSignInApple = async () => {
    const result = await signInApple();
    if (!result.ok) {
      if (result.error === 'canceled') return;
      Alert.alert(t('profile.syncFailed'), result.error ?? t('profile.syncFailed'));
      return;
    }
    await initialize();
    const hasHousehold = Boolean(useAuthStore.getState().householdId);
    if (hasHousehold) {
      Alert.alert(t('profile.syncDone'));
    } else {
      Alert.alert(t('profile.cloudSync'), t('profile.signedInChooseHousehold'));
    }
  };

  const handleSyncNow = async () => {
    try {
      const result = await syncNow();
      if (!result.ok) {
        Alert.alert(t('profile.syncFailed'), result.error ?? t('profile.syncFailed'));
        return;
      }
      await initialize();
      const pushed = result.pushed ?? 0;
      const pulled = result.pulled ?? 0;
      Alert.alert(
        t('profile.syncDone'),
        pushed === 0 && pulled === 0
          ? t('profile.syncUpToDate')
          : t('profile.syncCounts', { pushed, pulled })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profile.syncFailed');
      Alert.alert(t('profile.syncFailed'), message);
    }
  };

  const handleCreateHousehold = async () => {
    const trimmed = newHouseholdName.trim();
    if (!trimmed) {
      Alert.alert(t('profile.householdNameRequired'));
      return;
    }
    const result = await createHousehold(trimmed);
    if (!result.ok) {
      Alert.alert(t('profile.syncFailed'), result.error ?? t('profile.syncFailed'));
      return;
    }
    setNewHouseholdName('');
    if (useAppStore.getState().babies.length > 0) {
      const sync = await syncNow();
      if (sync.ok) await initialize();
    }
    Alert.alert(t('profile.householdCreated'), t('profile.householdCreatedMsg'));
  };

  const handleJoinHousehold = async () => {
    const result = await joinWithCode(joinCode);
    if (!result.ok) {
      Alert.alert(t('profile.syncFailed'), result.error ?? t('profile.syncFailed'));
      return;
    }
    setJoinCode('');
    await initialize();
    const count = useAppStore.getState().babies.length;
    Alert.alert(
      t('profile.syncDone'),
      count > 0
        ? t('profile.joinLoadedBabies', { count })
        : t('profile.joinNoBabiesYet')
    );
  };

  const handleSignOutCloud = async () => {
    await signOutCloud();
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const outcome = await checkAndDownloadUpdate();
      if (outcome.status === 'unsupported') {
        Alert.alert(t('alerts.updatesUnsupported'), t('alerts.updatesUnsupportedMsg'));
        return;
      }
      if (outcome.status === 'up_to_date') {
        Alert.alert(t('alerts.updatesUpToDate'), t('alerts.updatesUpToDateMsg'));
        return;
      }
      if (outcome.status === 'error') {
        Alert.alert(t('alerts.updatesFailed'), outcome.message);
        return;
      }
      Alert.alert(t('alerts.updatesDownloaded'), t('alerts.updatesDownloadedMsg'), [
        { text: t('alerts.updatesLater'), style: 'cancel' },
        {
          text: t('alerts.updatesRestart'),
          onPress: () => {
            void reloadWithLatestUpdate();
          },
        },
      ]);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleOpenBuilds = () => {
    Alert.alert(t('alerts.installBuildTitle'), t('alerts.installBuildMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('alerts.installBuildConfirm'),
        onPress: () => {
          void (async () => {
            setOpeningBuilds(true);
            try {
              const outcome = await openLatestBuildInstall();
              if (outcome.status === 'no_build') {
                Alert.alert(t('alerts.noPreviewBuild'), t('alerts.noPreviewBuildMsg'));
                return;
              }
              if (outcome.status === 'error') {
                Alert.alert(t('alerts.updatesFailed'), outcome.message);
                return;
              }
              // Close so iOS/Android can replace the binary without a crash loop
              setTimeout(() => {
                exitAppAfterInstallTrigger();
              }, 400);
            } finally {
              setOpeningBuilds(false);
            }
          })();
        },
      },
    ]);
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
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
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
            Sleep schedule
          </Text>
          <Text style={[styles.napGoalHint, { color: colors.textSecondary }]}>
            {t('profile.routineHint')}
          </Text>
          <View style={styles.modeRow}>
            {(
              [
                ['auto', 'Automatic'],
                ['routine', 'Set routine'],
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
                Naps before bedtime
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

        <Card style={styles.formCard}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            {t('profile.app')}
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('profile.language')}
          </Text>
          <View style={styles.modeRow}>
            {(
              [
                ['system', t('profile.langSystem')],
                ['en', t('profile.langEn')],
                ['de', t('profile.langDe')],
              ] as const
            ).map(([code, label]) => (
              <Pressable
                key={code}
                onPress={() => setLocale(code as AppLocale)}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: locale === code ? colors.tint : colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <Text
                  style={{
                    color: locale === code ? '#FFF' : colors.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <InfoRow label={t('profile.appVersion')} value={versionInfo.appVersion} />
          {versionInfo.runtimeVersion ? (
            <InfoRow label={t('profile.runtimeVersion')} value={versionInfo.runtimeVersion} />
          ) : null}
          {versionInfo.channel ? (
            <InfoRow label={t('profile.updateChannel')} value={versionInfo.channel} />
          ) : null}
          {formatUpdateId(versionInfo.updateId) ? (
            <InfoRow label={t('profile.updateId')} value={formatUpdateId(versionInfo.updateId)!} />
          ) : null}
          <Text style={[styles.importHint, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {t('profile.downloadBuildHint')}
          </Text>
          <BigButton
            title={checkingUpdates ? t('profile.checkingUpdates') : t('profile.checkUpdates')}
            onPress={handleCheckUpdates}
            loading={checkingUpdates}
            disabled={checkingUpdates}
            style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}
          />
          <BigButton
            title={t('profile.downloadBuild')}
            variant="secondary"
            onPress={handleOpenBuilds}
            loading={openingBuilds}
            disabled={openingBuilds}
          />
        </Card>

        {baby ? (
          <Card style={styles.infoCard}>
            <InfoRow label="Age" value={ageLabel} />
            <InfoRow
              label="Sleep schedule"
              value={
                resolvedSchedule
                  ? formatNapScheduleLabel(resolvedSchedule)
                  : 'Automatic'
              }
            />
            <InfoRow
              label="Reference wake window"
              value={`${wakeRange.min}–${wakeRange.max} min`}
              subtitle="General reference, not medical advice"
            />
          </Card>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t('profile.cloudSync')}
        </Text>
        <Text style={[styles.importHint, { color: colors.textSecondary }]}>
          {authConfigured ? t('profile.cloudSyncHint') : t('profile.cloudNotConfigured')}
        </Text>

        {authConfigured ? (
          <Card style={{ marginBottom: spacing.lg }}>
            {authUser ? (
              <>
                <Text style={[styles.exportSummary, { color: colors.text }]}>
                  {t('profile.signedInAs', {
                    email: authUser.email ?? authUser.id.slice(0, 8),
                  })}
                </Text>
                {householdId && inviteCode ? (
                  <>
                    <Text style={[styles.importHint, { color: colors.textSecondary }]}>
                      {lastSyncedAt
                        ? t('profile.lastSynced', {
                            time: formatTime(new Date(lastSyncedAt)),
                          })
                        : t('profile.neverSynced')}
                    </Text>
                    {householdName ? (
                      <InfoRow label={t('profile.householdName')} value={householdName} />
                    ) : null}
                    <InfoRow label={t('profile.inviteCode')} value={inviteCode} />
                    <Text
                      style={[
                        styles.importHint,
                        { color: colors.textSecondary, marginBottom: spacing.sm },
                      ]}>
                      {t('profile.inviteCodeHint')}
                    </Text>
                    <BigButton
                      title={isSyncing ? t('profile.syncing') : t('profile.syncNow')}
                      onPress={handleSyncNow}
                      loading={isSyncing}
                      disabled={isSyncing}
                      style={{ marginBottom: spacing.sm }}
                    />
                    {lastSyncError ? (
                      <Text style={[styles.importHint, { color: colors.danger, marginBottom: spacing.sm }]}>
                        {lastSyncError}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.importHint,
                        { color: colors.textSecondary, marginBottom: spacing.sm },
                      ]}>
                      {t('profile.noHouseholdYet')}
                    </Text>
                    <Text
                      style={[
                        styles.label,
                        { color: colors.textSecondary, marginBottom: spacing.xs },
                      ]}>
                      {t('profile.householdName')}
                    </Text>
                    <TextInput
                      value={newHouseholdName}
                      onChangeText={setNewHouseholdName}
                      placeholder={t('profile.householdNamePlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          marginBottom: spacing.sm,
                        },
                      ]}
                    />
                    <BigButton
                      title={
                        isSyncing
                          ? t('profile.creatingHousehold')
                          : t('profile.createHousehold')
                      }
                      onPress={handleCreateHousehold}
                      loading={isSyncing}
                      disabled={isSyncing || !newHouseholdName.trim()}
                      style={{ marginBottom: spacing.sm }}
                    />
                  </>
                )}
                <Text
                  style={[
                    styles.label,
                    { color: colors.textSecondary, marginBottom: spacing.xs },
                  ]}>
                  {t('profile.joinHousehold')}
                </Text>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder={t('profile.joinCodePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                      marginBottom: spacing.sm,
                    },
                  ]}
                />
                <BigButton
                  title={t('profile.join')}
                  variant="secondary"
                  onPress={handleJoinHousehold}
                  disabled={isSyncing || joinCode.trim().length < 6}
                  style={{ marginBottom: spacing.sm }}
                />
                <BigButton
                  title={t('profile.signOut')}
                  variant="secondary"
                  onPress={handleSignOutCloud}
                />
              </>
            ) : Platform.OS === 'ios' && appleAvailable ? (
              <AppleSignInButton
                label={t('profile.signInApple')}
                loading={isSigningIn}
                onPress={() => {
                  if (!isSigningIn) void handleSignInApple();
                }}
              />
            ) : (
              <Text style={[styles.importHint, { color: colors.textSecondary }]}>
                {t('profile.appleOnlyIos')}
              </Text>
            )}
          </Card>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.data')}</Text>
        <Text style={[styles.importHint, { color: colors.textSecondary }]}>
          {baby ? t('profile.dataHint') : t('profile.dataHintNoProfile')}
        </Text>
        {exportSummary && exportSummary.total > 0 ? (
          <Text style={[styles.exportSummary, { color: colors.textSecondary }]}>
            {t('profile.exportReady', {
              total: exportSummary.total,
              sleep: exportSummary.sleep,
              feeds: exportSummary.feedings,
              diapers: exportSummary.diapers,
              baths: exportSummary.baths,
              wakes: exportSummary.wakes,
            })}
          </Text>
        ) : null}
        {baby ? (
          <BigButton
            title={exporting ? t('profile.exporting') : t('profile.exportCsv')}
            onPress={handleExport}
            loading={exporting}
            disabled={exporting || !exportSummary?.total}
            style={{ marginBottom: spacing.sm }}
          />
        ) : null}
        <BigButton
          title={t('profile.importData')}
          variant="secondary"
          onPress={handleImportData}
          style={{ marginBottom: spacing.lg }}
        />

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

      <ImportPreviewModal
        visible={importModalVisible}
        parsed={parsedCsv}
        autoDetect={autoDetect}
        preview={importPreview}
        manualMapping={manualMapping}
        importing={importing}
        onManualMappingChange={setManualMapping}
        onBuildPreview={handleBuildPreview}
        onConfirmImport={handleConfirmImport}
        onClose={handleCloseImport}
      />
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
  exportSummary: { fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
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
