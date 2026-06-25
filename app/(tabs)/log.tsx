import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { DatePickerField } from '@/components/DatePickerField';
import { TimelineEntry } from '@/components/TimelineEntry';
import { FeedingLogModal } from '@/components/FeedingLogModal';
import { DiaperLogModal } from '@/components/DiaperLogModal';
import { SleepLogModal } from '@/components/SleepLogModal';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { buildTimeline, filterTimelineForWakeDay } from '@/lib/timeline';
import { getWakeDayBounds, formatWakeDayRange } from '@/lib/dayAnchor';
import { isSameDay, startOfDay } from '@/lib/dateUtils';
import type { DiaperEvent, FeedingEvent, SleepEvent, TimelineItem } from '@/types';

export default function LogScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const wakes = useAppStore((s) => s.wakes);
  const removeSleepEvent = useAppStore((s) => s.removeSleepEvent);
  const addSleepEvent = useAppStore((s) => s.addSleepEvent);
  const editSleepEvent = useAppStore((s) => s.editSleepEvent);
  const removeFeeding = useAppStore((s) => s.removeFeeding);
  const removeDiaper = useAppStore((s) => s.removeDiaper);
  const removeWake = useAppStore((s) => s.removeWake);
  const editDiaper = useAppStore((s) => s.editDiaper);
  const addDiaper = useAppStore((s) => s.addDiaper);
  const baby = useActiveBaby();

  const [feedingOpen, setFeedingOpen] = useState(false);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [selectedWakeDay, setSelectedWakeDay] = useState(new Date());
  const [editingSleep, setEditingSleep] = useState<SleepEvent | null>(null);
  const [editingFeeding, setEditingFeeding] = useState<FeedingEvent | null>(null);
  const [editingDiaper, setEditingDiaper] = useState<DiaperEvent | null>(null);

  const now = useMemo(() => new Date(), []);

  const wakeDayBounds = useMemo(
    () => getWakeDayBounds(events, wakes, selectedWakeDay, now),
    [events, wakes, selectedWakeDay, now]
  );

  const timeline = useMemo(
    () =>
      filterTimelineForWakeDay(
        buildTimeline(events, feedings, diapers, wakes),
        events,
        wakes,
        selectedWakeDay,
        now
      ),
    [events, feedings, diapers, wakes, selectedWakeDay, now]
  );

  const shiftWakeDay = (delta: number) => {
    const next = new Date(selectedWakeDay);
    next.setDate(next.getDate() + delta);
    const today = startOfDay(new Date());
    if (startOfDay(next).getTime() > today.getTime()) return;
    setSelectedWakeDay(next);
  };

  const handleDelete = (item: TimelineItem) => {
    const labels = { sleep: 'sleep', feeding: 'feeding', diaper: 'diaper', wake: 'wake' };
    Alert.alert('Delete entry', `Remove this ${labels[item.kind]} event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (item.kind === 'sleep') removeSleepEvent(item.id);
          if (item.kind === 'feeding') removeFeeding(item.id);
          if (item.kind === 'diaper') removeDiaper(item.id);
          if (item.kind === 'wake') removeWake(item.id);
        },
      },
    ]);
  };

  const openEdit = (item: TimelineItem) => {
    if (item.kind === 'sleep') {
      setEditingSleep(item.data);
      setSleepOpen(true);
    } else if (item.kind === 'feeding') {
      setEditingFeeding(item.data);
      setFeedingOpen(true);
    } else if (item.kind === 'diaper') {
      setEditingDiaper(item.data);
      setDiaperOpen(true);
    } else if (item.kind === 'wake') {
      Alert.alert('Wake event', 'Wake events can be deleted with a long press.');
    }
  };

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Set up a baby profile to log events.
        </Text>
      </SafeAreaView>
    );
  }

  const canGoForward = !isSameDay(selectedWakeDay, new Date());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={timeline}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.wakeDayNav}>
              <Pressable
                onPress={() => shiftWakeDay(-1)}
                style={[styles.navBtn, { borderColor: colors.border }]}>
                <Text style={[styles.navBtnText, { color: colors.text }]}>‹</Text>
              </Pressable>
              <View style={styles.wakeDayCenter}>
                <DatePickerField
                  label="Wake day"
                  value={selectedWakeDay}
                  onChange={setSelectedWakeDay}
                  maximumDate={new Date()}
                  style={{ marginBottom: 0 }}
                />
              </View>
              <Pressable
                onPress={() => shiftWakeDay(1)}
                disabled={!canGoForward}
                style={[
                  styles.navBtn,
                  {
                    borderColor: colors.border,
                    opacity: canGoForward ? 1 : 0.35,
                  },
                ]}>
                <Text style={[styles.navBtnText, { color: colors.text }]}>›</Text>
              </Pressable>
            </View>
            <Text style={[styles.wakeDayRange, { color: colors.textSecondary }]}>
              {formatWakeDayRange(wakeDayBounds.start, wakeDayBounds.end)}
            </Text>
            <Text style={[styles.wakeDayHint, { color: colors.textSecondary }]}>
              Shows everything from morning wake until the next one — not midnight to midnight.
            </Text>
            <View style={styles.headerActions}>
              <BigButton
                title="+ Sleep"
                variant="secondary"
                onPress={() => {
                  setEditingSleep(null);
                  setSleepOpen(true);
                }}
                style={{ flex: 1, marginRight: spacing.xs }}
              />
              <BigButton
                title="+ Feeding"
                variant="secondary"
                onPress={() => {
                  setEditingFeeding(null);
                  setFeedingOpen(true);
                }}
                style={{ flex: 1, marginHorizontal: spacing.xs }}
              />
              <BigButton
                title="+ Diaper"
                variant="secondary"
                onPress={() => {
                  setEditingDiaper(null);
                  setDiaperOpen(true);
                }}
                style={{ flex: 1, marginLeft: spacing.xs }}
              />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TimelineEntry
            item={item}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            No events in this wake-day. Tap + Sleep, + Feeding, or + Diaper to log.
          </Text>
        }
      />

      <SleepLogModal
        visible={sleepOpen}
        initial={editingSleep}
        babyId={baby.id}
        onSave={async (payload) => {
          if (editingSleep) await editSleepEvent({ ...payload, id: editingSleep.id });
          else await addSleepEvent(payload);
          setSleepOpen(false);
          setEditingSleep(null);
        }}
        onClose={() => {
          setSleepOpen(false);
          setEditingSleep(null);
        }}
      />

      <FeedingLogModal
        visible={feedingOpen}
        initial={editingFeeding}
        babyId={baby.id}
        onClose={() => {
          setFeedingOpen(false);
          setEditingFeeding(null);
        }}
      />

      <DiaperLogModal
        visible={diaperOpen}
        initial={editingDiaper}
        babyId={baby.id}
        onSave={async (payload) => {
          if (editingDiaper) await editDiaper({ ...payload, id: editingDiaper.id });
          else await addDiaper(payload);
          setDiaperOpen(false);
          setEditingDiaper(null);
        }}
        onClose={() => {
          setDiaperOpen(false);
          setEditingDiaper(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  wakeDayNav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  wakeDayCenter: { flex: 1 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navBtnText: { fontSize: 28, fontWeight: '300', lineHeight: 32 },
  wakeDayRange: { fontSize: 14, marginBottom: spacing.xs },
  wakeDayHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.lg },
  headerActions: { flexDirection: 'row', marginBottom: spacing.lg },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 16 },
});
