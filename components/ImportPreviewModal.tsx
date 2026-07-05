import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { ColumnMapPicker } from '@/components/ColumnMapPicker';
import {
  type ColumnMapping,
  type ImportPreview,
  type ParsedCsv,
  type AutoDetectResult,
  isCompleteMapping,
} from '@/lib/importNapper';

type Props = {
  visible: boolean;
  parsed: ParsedCsv | null;
  autoDetect: AutoDetectResult | null;
  preview: ImportPreview | null;
  manualMapping: Partial<ColumnMapping>;
  importing: boolean;
  onManualMappingChange: (mapping: Partial<ColumnMapping>) => void;
  onBuildPreview: (mapping: ColumnMapping) => void;
  onConfirmImport: () => void;
  onClose: () => void;
};

function importableCount(preview: ImportPreview): number {
  return (
    preview.sleepReadyCount +
    preview.sleepOngoingCount +
    preview.feedingReadyCount +
    preview.feedingOngoingCount +
    preview.diaperReadyCount +
    preview.bathReadyCount +
    preview.wakeReadyCount
  );
}

function PreviewTable({ preview }: { preview: ImportPreview }) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const previewRows = preview.rows.filter((r) => r.preview).slice(0, 5);
  const skippedRows = preview.rows.filter(
    (r) => r.outcome !== 'ready' && r.outcome !== 'ongoing'
  );

  return (
    <>
      <View style={styles.summaryGrid}>
        <SummaryItem label="Total rows" value={String(preview.totalRows)} colors={colors} />
        <SummaryItem label="Sleep" value={String(preview.sleepReadyCount + preview.sleepOngoingCount)} colors={colors} />
        <SummaryItem label="Feeding" value={String(preview.feedingReadyCount + preview.feedingOngoingCount)} colors={colors} />
        <SummaryItem label="Diaper" value={String(preview.diaperReadyCount)} colors={colors} />
        <SummaryItem label="Bath" value={String(preview.bathReadyCount)} colors={colors} />
        <SummaryItem label="Wake" value={String(preview.wakeReadyCount)} colors={colors} />
        <SummaryItem label="Unrecognized" value={String(preview.skippedUnrecognized)} colors={colors} />
        <SummaryItem label="Failed" value={String(preview.skippedFailed + preview.skippedOpenOld)} colors={colors} />
      </View>

      <Text style={[styles.note, { color: colors.textSecondary }]}>{preview.timezoneNote}</Text>
      <Text style={[styles.note, { color: colors.textSecondary, marginBottom: spacing.md }]}>
        Mapping: {preview.mappingSource === 'auto' ? 'auto-detected' : 'manual'}
      </Text>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Preview (first 5)</Text>
      <View style={[styles.table, { borderColor: colors.border }]}>
        <View style={[styles.tableHeader, { backgroundColor: colors.card }]}>
          <Text style={[styles.cell, styles.headerCell, { color: colors.textSecondary }]}>Kind</Text>
          <Text style={[styles.cell, styles.headerCell, { color: colors.textSecondary }]}>Start</Text>
          <Text style={[styles.cell, styles.headerCell, { color: colors.textSecondary }]}>End</Text>
        </View>
        {previewRows.length === 0 ? (
          <Text style={[styles.emptyPreview, { color: colors.textSecondary }]}>
            No importable rows to preview
          </Text>
        ) : (
          previewRows.map((row) => (
            <View key={row.rowIndex} style={[styles.tableRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.cell, { color: colors.text }]}>
                {row.preview!.kind}: {row.preview!.label}
              </Text>
              <Text style={[styles.cell, { color: colors.text }]}>{row.preview!.start}</Text>
              <Text style={[styles.cell, { color: colors.text }]}>{row.preview!.end}</Text>
            </View>
          ))
        )}
      </View>

      {skippedRows.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg }]}>
            Skipped rows ({skippedRows.length})
          </Text>
          {skippedRows.slice(0, 10).map((row) => (
            <Text key={row.rowIndex} style={[styles.skippedRow, { color: colors.textSecondary }]}>
              Row {row.rowIndex}: {row.reason}
            </Text>
          ))}
        </>
      )}
    </>
  );
}

function SummaryItem({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.summaryItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function ImportPreviewModal({
  visible,
  parsed,
  autoDetect,
  preview,
  manualMapping,
  importing,
  onManualMappingChange,
  onBuildPreview,
  onConfirmImport,
  onClose,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const showMapping = parsed && autoDetect && !preview;

  const handleMappingConfirm = () => {
    if (!parsed || !isCompleteMapping(manualMapping)) return;
    onBuildPreview(manualMapping);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {showMapping ? (
          <ColumnMapPicker
            headers={parsed.headers}
            initialMapping={autoDetect.mapping}
            ambiguousFields={autoDetect.ambiguous}
            missingFields={autoDetect.missing}
            mapping={manualMapping}
            onMappingChange={onManualMappingChange}
            onConfirm={handleMappingConfirm}
            onCancel={onClose}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={[styles.title, { color: colors.text }]}>Import preview</Text>
            {preview && <PreviewTable preview={preview} />}
            <View style={styles.actions}>
              <BigButton title="Cancel" variant="secondary" onPress={onClose} disabled={importing} style={{ flex: 1 }} />
              {preview && (
                <BigButton
                  title={importing ? 'Importing…' : 'Confirm import'}
                  onPress={onConfirmImport}
                  loading={importing}
                  disabled={importing || importableCount(preview) === 0}
                  style={{ flex: 1, marginLeft: spacing.sm }}
                />
              )}
            </View>
            {importing && <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: spacing.md }} />}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.lg },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  summaryItem: { flex: 1, minWidth: '30%', padding: spacing.md, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700' },
  summaryLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  note: { fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: spacing.sm },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: spacing.sm },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: spacing.sm },
  cell: { flex: 1, fontSize: 13, paddingHorizontal: spacing.sm },
  headerCell: { fontWeight: '600', fontSize: 12 },
  emptyPreview: { padding: spacing.lg, textAlign: 'center' },
  skippedRow: { fontSize: 13, marginBottom: spacing.xs, lineHeight: 18 },
  actions: { flexDirection: 'row', marginTop: spacing.xl },
});
