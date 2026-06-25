import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Pressable,
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
import type { NapGoal } from '@/types';
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
import { useAppStore, useActiveBaby } from '@/store/useAppStore';

const ROUTINE_NAP_OPTIONS: NapGoal[] = [2, 3, 4];

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const saveBaby = useAppStore((s) => s.saveBaby);
  const importCareEvents = useAppStore((s) => s.importCareEvents);
  const events = useAppStore((s) => s.events);
  const sleepPauses = useAppStore((s) => s.sleepPauses);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
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
  const [saving, setSaving] = useState(false);

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [autoDetect, setAutoDetect] = useState<AutoDetectResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [manualMapping, setManualMapping] = useState<Partial<ColumnMapping>>({});
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (baby) {
      setName(baby.name);
      setBirthDate(new Date(baby.birthDate + 'T00:00:00'));
      setScheduleMode(baby.napGoal == null ? 'auto' : 'routine');
      setRoutineNaps(baby.napGoal ?? 3);
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
      Alert.alert('Name required', "Please enter your baby's name.");
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
      });
      Alert.alert('Saved', 'Baby profile updated.');
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
      wakes,
    });
  }, [baby, events, sleepPauses, feedings, diapers, wakes]);

  const handleExport = async () => {
    if (!baby) {
      Alert.alert('Profile required', 'Create a baby profile before exporting.');
      return;
    }

    const summary = getExportSummary({
      baby,
      events,
      sleepPauses,
      feedings,
      diapers,
      wakes,
    });

    if (summary.total === 0) {
      Alert.alert('Nothing to export', 'Log some sleep, feeds, or diapers first.');
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
        wakes,
      });
      const filename = buildExportFilename(baby.name);
      await shareCsvFile(csv, filename);
    } catch (err) {
      Alert.alert(
        'Export failed',
        err instanceof Error ? err.message : 'Could not export your data.'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleImportFromNapper = async () => {
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
        `${result.sleepAdded} sleep, ${result.feedingAdded} feeding, ${result.diaperAdded} diaper, ${result.wakeAdded} wake added. ${result.duplicatesSkipped} duplicates skipped, ${result.failedSkipped} rows skipped.`
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
            Like Napper: automatic learns from your logs. Set a routine only if you want a fixed
            nap count.
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
              Predictions use: {formatNapScheduleLabel(resolvedSchedule)}
            </Text>
          )}
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

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data</Text>
            <Text style={[styles.importHint, { color: colors.textSecondary }]}>
              Export all logs as CSV (Napper-compatible). Import from a Napper export — safe to
              re-run, duplicates are skipped.
            </Text>
            {exportSummary && exportSummary.total > 0 ? (
              <Text style={[styles.exportSummary, { color: colors.textSecondary }]}>
                {exportSummary.total} events ready · {exportSummary.sleep} sleep ·{' '}
                {exportSummary.feedings} feeds · {exportSummary.diapers} diapers ·{' '}
                {exportSummary.wakes} wakes
              </Text>
            ) : null}
            <BigButton
              title={exporting ? 'Exporting…' : 'Export CSV'}
              onPress={handleExport}
              loading={exporting}
              disabled={exporting || !exportSummary?.total}
              style={{ marginBottom: spacing.sm }}
            />
            <BigButton
              title="Import from Napper"
              variant="secondary"
              onPress={handleImportFromNapper}
              style={{ marginBottom: spacing.lg }}
            />
          </>
        )}

        <BigButton
          title={baby ? 'Save changes' : 'Create profile'}
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
