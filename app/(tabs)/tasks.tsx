import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/Card';
import { BigButton } from '@/components/BigButton';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';
import { formatDate } from '@/lib/dateUtils';
import type { ChoreRecurrence, DailyChore } from '@/types';

export default function TasksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);

  const baby = useActiveBaby();
  const dailyChores = useAppStore((s) => s.dailyChores);
  const completedChoreIdsToday = useAppStore((s) => s.completedChoreIdsToday);
  const refreshChores = useAppStore((s) => s.refreshChores);
  const addDailyChore = useAppStore((s) => s.addDailyChore);
  const toggleDailyChore = useAppStore((s) => s.toggleDailyChore);
  const removeDailyChore = useAppStore((s) => s.removeDailyChore);

  const [newTitle, setNewTitle] = useState('');
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>('daily');
  const [adding, setAdding] = useState(false);

  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    void refreshChores();
  }, [refreshChores, baby?.id]);

  const completedSet = useMemo(
    () => new Set(completedChoreIdsToday),
    [completedChoreIdsToday]
  );

  const doneCount = dailyChores.filter((c) => completedSet.has(c.id)).length;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await addDailyChore(newTitle, recurrence);
      setNewTitle('');
    } finally {
      setAdding(false);
    }
  };

  const renderItem = ({ item }: { item: DailyChore }) => {
    const done = completedSet.has(item.id);
    return (
      <Pressable
        onPress={() => void toggleDailyChore(item.id, !done)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: done ? colors.tint : colors.border,
              backgroundColor: done ? colors.tint : 'transparent',
            },
          ]}>
          {done ? (
            <SymbolView
              name={{ ios: 'checkmark', android: 'check', web: 'check' }}
              tintColor="#FFF"
              size={14}
            />
          ) : null}
        </View>
        <View style={styles.titleBlock}>
          <Text
            style={[
              styles.rowTitle,
              {
                color: colors.text,
                textDecorationLine: done ? 'line-through' : 'none',
                opacity: done ? 0.55 : 1,
              },
            ]}>
            {item.title}
          </Text>
          {item.recurrence === 'once' ? (
            <View style={[styles.onceBadge, { backgroundColor: colors.tint + '22' }]}>
              <Text style={[styles.onceBadgeText, { color: colors.tint }]}>
                {t('tasks.badgeOnce')}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={() => void removeDailyChore(item.id)}
          hitSlop={12}
          style={styles.deleteBtn}>
          <SymbolView
            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
            tintColor={colors.textSecondary}
            size={18}
          />
        </Pressable>
      </Pressable>
    );
  };

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('tasks.setupProfile')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={dailyChores}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>
                {formatDate(today)}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('tasks.subtitle')}
              </Text>
              {dailyChores.length > 0 ? (
                <Card style={styles.progressCard}>
                  <Text style={[styles.progressText, { color: colors.text }]}>
                    {t('tasks.progress', { done: doneCount, total: dailyChores.length })}
                  </Text>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('tasks.emptyTitle')}</Text>
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                {t('tasks.emptyHint')}
              </Text>
            </Card>
          }
        />

        <View style={[styles.addBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder={t('tasks.addPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={() => void handleAdd()}
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
            ]}
          />
          <View style={styles.recurrenceRow}>
            {(
              [
                ['daily', t('tasks.recurrenceDaily')],
                ['once', t('tasks.recurrenceOnce')],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setRecurrence(value)}
                style={[
                  styles.recurrenceChip,
                  {
                    backgroundColor: recurrence === value ? colors.tint : colors.card,
                    borderColor: colors.border,
                  },
                ]}>
                <Text
                  style={{
                    color: recurrence === value ? '#FFF' : colors.text,
                    fontWeight: '700',
                    fontSize: 14,
                  }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <BigButton
            title={t('tasks.add')}
            onPress={() => void handleAdd()}
            loading={adding}
            disabled={!newTitle.trim() || adding}
            style={styles.addBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  progressCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  onceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  onceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    minWidth: touchTarget.minHeight / 2,
    minHeight: touchTarget.minHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  addBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    minHeight: touchTarget.minHeight,
  },
  recurrenceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recurrenceChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: '100%',
  },
});
