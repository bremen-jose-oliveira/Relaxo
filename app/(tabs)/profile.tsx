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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { Card, InfoRow } from '@/components/Card';
import { DatePickerField } from '@/components/DatePickerField';
import { ImportPreviewModal } from '@/components/ImportPreviewModal';
import type { AppLocale, NapGoal } from '@/types';
import { ageInWeeks, formatDateKey } from '@/lib/dateUtils';
import { getAgeWakeWindowRange } from '@/lib/predictNextSleep';
import { formatNapScheduleLabel, resolveNapGoal } from '@/lib/napSchedule';
import {
  prepareImportFromCsv,
  buildImportPreview,
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
import { useTranslation } from '@/lib/i18n';
import {
  checkAndDownloadUpdate,
  formatUpdateId,
  getAppVersionInfo,
  openLatestBuildInstall,
  reloadWithLatestUpdate,
} from '@/lib/appUpdates';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';

const ROUTINE_NAP_OPTIONS: NapGoal[] = [2, 3, 4];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const saveBaby = useAppStore((s) => s.saveBaby);
  const setLocale = useAppStore((s) => s.setLocale);
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const importCareEvents = useAppStore((s) => s.importCareEvents);
  const events = useAppStore((s) => s.events);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const baths = useAppStore((s) => s.baths);
  const wakes = useAppStore((s) => s.wakes);
  const baby = useActiveBaby();

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

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [autoDetect, setAutoDetect] = useState<AutoDetectResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [manualMapping, setManualMapping] = useState<Partial<ColumnMapping>>({});
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [openingBuilds, setOpeningBuilds] = useState(false);

  const versionInfo = useMemo(() => getAppVersionInfo(), []);

  useEffect(() => {
    if (baby) {
      setName(baby.name);
      setBirthDate(new Date(baby.birthDate + 'T00:00:00'));
      setScheduleMode(baby.napGoal == null ? 'auto' : 'routine');
      setRoutineNaps(baby.napGoal ?? 3);
      setTrackFeedingDuration(baby.trackFeedingDuration ?? false);
      setEasilyOverstimulated(baby.easilyOverstimulated ?? false);
      setHighNeed(baby.highNeed ?? false);
    }
  }, [baby]);

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
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('profile.nameRequired'), t('profile.nameRequiredMsg'));
      return;
    }

    setSaving(true);
    try {
      const dateStr = formatDateKey(birthDate);
      await saveBaby({
        id: baby?.id,
        name: name.trim(),
        birthDate: dateStr,
        napGoal: scheduleMode === 'auto' ? null : routineNaps,
        trackFeedingDuration,
        easilyOverstimulated,
        highNeed,
      });
      Alert.alert(t('profile.saved'), t('profile.savedMsg'));
    } finally {
      setSaving(false);
    }
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
    if (!baby) {
      Alert.alert('Profile required', 'Create a baby profile before importing.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const csvText = await FileSystem.readAsStringAsync(asset.uri);

      const prepared = prepareImportFromCsv(csvText, baby.id);

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
    if (!parsedCsv || !baby) return;
    const preview = buildImportPreview(parsedCsv, mapping, baby.id, 'manual');
    setImportPreview(preview);
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;

    setImporting(true);
    try {
      const result = await importCareEvents(importPreview);
      setImportModalVisible(false);
      resetImportState();

      Alert.alert(
        'Import complete',
        `${result.sleepAdded} sleep, ${result.feedingAdded} feeding, ${result.diaperAdded} diaper, ${result.bathAdded} bath, ${result.wakeAdded} wake added. ${result.duplicatesSkipped} duplicates skipped, ${result.failedSkipped} rows skipped.`
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

  const handleOpenBuilds = async () => {
    setOpeningBuilds(true);
    try {
      const outcome = await openLatestBuildInstall();
      if (outcome.status === 'no_build') {
        Alert.alert(t('alerts.noPreviewBuild'), t('alerts.noPreviewBuildMsg'));
        return;
      }
      if (outcome.status === 'error') {
        Alert.alert(t('alerts.updatesFailed'), outcome.message);
      }
    } finally {
      setOpeningBuilds(false);
    }
  };

  const weeks = ageInWeeks(formatDateKey(birthDate), new Date());
  const wakeRange = getAgeWakeWindowRange(weeks);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Baby Profile</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Used for age-based wake window defaults
        </Text>

        <Card style={styles.formCard}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Baby's name"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
            ]}
          />

          <DatePickerField
            label="Birth date"
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

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>
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
        </Card>

        <Card style={styles.formCard}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
            {t('profile.app')}
          </Text>
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

        {baby && (
          <>
            <Card style={styles.infoCard}>
              <InfoRow label="Age" value={`${weeks} weeks`} />
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

            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.data')}</Text>
            <Text style={[styles.importHint, { color: colors.textSecondary }]}>
              {t('profile.dataHint')}
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
            <BigButton
              title={exporting ? t('profile.exporting') : t('profile.exportCsv')}
              onPress={handleExport}
              loading={exporting}
              disabled={exporting || !exportSummary?.total}
              style={{ marginBottom: spacing.sm }}
            />
            <BigButton
              title={t('profile.importData')}
              variant="secondary"
              onPress={handleImportData}
              style={{ marginBottom: spacing.lg }}
            />
          </>
        )}

        <BigButton
          title={baby ? t('profile.saveChanges') : t('profile.createProfile')}
          onPress={handleSave}
          loading={saving}
        />
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
