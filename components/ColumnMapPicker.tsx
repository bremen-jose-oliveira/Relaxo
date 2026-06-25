import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  type ColumnMapping,
  type MappingField,
  MAPPING_FIELD_LABELS,
  REQUIRED_FIELDS,
} from '@/lib/importNapper';
import { BigButton } from '@/components/BigButton';

type Props = {
  headers: string[];
  initialMapping: Partial<ColumnMapping>;
  ambiguousFields: MappingField[];
  missingFields: MappingField[];
  mapping: Partial<ColumnMapping>;
  onMappingChange: (mapping: Partial<ColumnMapping>) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const ALL_FIELDS: MappingField[] = ['startTime', 'endTime', 'eventType', 'date'];

export function ColumnMapPicker({
  headers,
  ambiguousFields,
  missingFields,
  mapping,
  onMappingChange,
  onConfirm,
  onCancel,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const isValid = REQUIRED_FIELDS.every((f) => mapping[f]);

  const assignField = (field: MappingField, header: string | null) => {
    const next = { ...mapping };
    if (header) next[field] = header;
    else delete next[field];
    onMappingChange(next);
  };

  const getSelectedHeader = (field: MappingField): string | null => {
    return mapping[field] ?? null;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Map CSV columns</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        We couldn't auto-detect all columns. Assign each field to a CSV header below.
      </Text>

      {(ambiguousFields.length > 0 || missingFields.length > 0) && (
        <View style={[styles.notice, { backgroundColor: colors.awake + '33' }]}>
          {ambiguousFields.length > 0 && (
            <Text style={[styles.noticeText, { color: colors.text }]}>
              Ambiguous: {ambiguousFields.map((f) => MAPPING_FIELD_LABELS[f]).join(', ')}
            </Text>
          )}
          {missingFields.length > 0 && (
            <Text style={[styles.noticeText, { color: colors.text }]}>
              Missing: {missingFields.map((f) => MAPPING_FIELD_LABELS[f]).join(', ')}
            </Text>
          )}
        </View>
      )}

      {ALL_FIELDS.map((field) => (
        <View key={field} style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            {MAPPING_FIELD_LABELS[field]}
            {REQUIRED_FIELDS.includes(field as (typeof REQUIRED_FIELDS)[number]) ? ' *' : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {!REQUIRED_FIELDS.includes(field as (typeof REQUIRED_FIELDS)[number]) && (
              <Pressable
                onPress={() => assignField(field, null)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: !getSelectedHeader(field) ? colors.tint : colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <Text
                  style={{
                    color: !getSelectedHeader(field) ? '#FFF' : colors.text,
                    fontWeight: '600',
                  }}>
                  None
                </Text>
              </Pressable>
            )}
            {headers.map((header) => {
              const selected = getSelectedHeader(field) === header;
              return (
                <Pressable
                  key={`${field}-${header}`}
                  onPress={() => assignField(field, header)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.tint : colors.card,
                      borderColor: colors.border,
                    },
                  ]}>
                  <Text
                    style={{
                      color: selected ? '#FFF' : colors.text,
                      fontWeight: '600',
                    }}>
                    {header}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}

      <View style={styles.actions}>
        <BigButton title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <BigButton
          title="Preview import"
          onPress={onConfirm}
          disabled={!isValid}
          style={{ flex: 1, marginLeft: spacing.sm }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  notice: { padding: spacing.md, borderRadius: 12, marginBottom: spacing.lg },
  noticeText: { fontSize: 14, marginBottom: 4 },
  fieldBlock: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 16, fontWeight: '600', marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: spacing.sm,
    minHeight: touchTarget.minHeight - 16,
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.xxl },
});
