import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { WakeDayPicker } from '@/components/WakeDayPicker';
import { TimelineEntry } from '@/components/TimelineEntry';
import { FeedingLogModal } from '@/components/FeedingLogModal';
import { DiaperLogModal } from '@/components/DiaperLogModal';
import { BathLogModal } from '@/components/BathLogModal';
import { SleepLogModal } from '@/components/SleepLogModal';
import { useAppStore, useActiveBaby } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';
import { buildTimeline, filterTimelineForDayView } from '@/lib/timeline';
import type { BathEvent, DiaperEvent, FeedingEvent, SleepEvent, TimelineItem } from '@/types';

export default function LogScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);

  const events = useAppStore((s) => s.events);
  const feedings = useAppStore((s) => s.feedings);
  const diapers = useAppStore((s) => s.diapers);
  const baths = useAppStore((s) => s.baths);
  const wakes = useAppStore((s) => s.wakes);
  const removeSleepEvent = useAppStore((s) => s.removeSleepEvent);
  const addSleepEvent = useAppStore((s) => s.addSleepEvent);
  const editSleepEvent = useAppStore((s) => s.editSleepEvent);
  const removeFeeding = useAppStore((s) => s.removeFeeding);
  const removeDiaper = useAppStore((s) => s.removeDiaper);
  const removeWake = useAppStore((s) => s.removeWake);
  const editDiaper = useAppStore((s) => s.editDiaper);
  const addDiaper = useAppStore((s) => s.addDiaper);
  const addBath = useAppStore((s) => s.addBath);
  const editBath = useAppStore((s) => s.editBath);
  const removeBath = useAppStore((s) => s.removeBath);
  const baby = useActiveBaby();

  const [feedingOpen, setFeedingOpen] = useState(false);
  const [diaperOpen, setDiaperOpen] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [editingSleep, setEditingSleep] = useState<SleepEvent | null>(null);
  const [editingFeeding, setEditingFeeding] = useState<FeedingEvent | null>(null);
  const [editingDiaper, setEditingDiaper] = useState<DiaperEvent | null>(null);
  const [editingBath, setEditingBath] = useState<BathEvent | null>(null);

  const now = useMemo(() => new Date(), []);

  const timeline = useMemo(
    () =>
      filterTimelineForDayView(
        buildTimeline(events, feedings, diapers, baths, wakes),
        events,
        wakes,
        selectedDay,
        now
      ),
    [events, feedings, diapers, baths, wakes, selectedDay, now]
  );

  const handleDelete = (item: TimelineItem) => {
    const labels = {
      sleep: 'sleep',
      feeding: 'feeding',
      diaper: 'diaper',
      bath: 'bath',
      wake: 'wake',
    };
    Alert.alert('Delete entry', `Remove this ${labels[item.kind]} event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (item.kind === 'sleep') removeSleepEvent(item.id);
          if (item.kind === 'feeding') removeFeeding(item.id);
          if (item.kind === 'diaper') removeDiaper(item.id);
          if (item.kind === 'bath') removeBath(item.id);
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
    } else if (item.kind === 'bath') {
      setEditingBath(item.data);
      setBathOpen(true);
    } else if (item.kind === 'wake') {
      Alert.alert('Wake event', 'Wake events can be deleted with a long press.');
    }
  };

  if (!baby) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t('log.setupProfile')}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={timeline}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <WakeDayPicker
              label={t('log.day')}
              selectedDay={selectedDay}
              onSelectedDayChange={setSelectedDay}
              events={events}
              wakes={wakes}
              now={now}
            />
            <Text style={[styles.wakeDayHint, { color: colors.textSecondary }]}>
              {t('log.dayHint')}
            </Text>
            <View style={styles.headerActions}>
              <BigButton
                title={t('log.addSleep')}
                variant="secondary"
                onPress={() => {
                  setEditingSleep(null);
                  setSleepOpen(true);
                }}
                style={styles.actionBtn}
              />
              <BigButton
                title={t('log.addFeeding')}
                variant="secondary"
                onPress={() => {
                  setEditingFeeding(null);
                  setFeedingOpen(true);
                }}
                style={styles.actionBtn}
              />
              <BigButton
                title={t('log.addDiaper')}
                variant="secondary"
                onPress={() => {
                  setEditingDiaper(null);
                  setDiaperOpen(true);
                }}
                style={styles.actionBtn}
              />
              <BigButton
                title={t('log.addBath')}
                variant="secondary"
                onPress={() => {
                  setEditingBath(null);
                  setBathOpen(true);
                }}
                style={styles.actionBtn}
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
            {t('log.noEvents')}
            {'\n'}
            {t('log.noEventsHint')}
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

      <BathLogModal
        visible={bathOpen}
        initial={editingBath}
        babyId={baby.id}
        onSave={async (payload) => {
          if (editingBath) await editBath({ ...payload, id: editingBath.id });
          else await addBath(payload);
          setBathOpen(false);
          setEditingBath(null);
        }}
        onClose={() => {
          setBathOpen(false);
          setEditingBath(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  wakeDayHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.lg },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: '47%',
  },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: 16 },
});
