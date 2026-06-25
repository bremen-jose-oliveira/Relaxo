import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, spacing } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { formatDate, formatTime } from '@/lib/dateUtils';
import type { TimelineItem } from '@/types';

type Props = {
  item: TimelineItem;
  onPress?: () => void;
  onLongPress?: () => void;
};

function getMeta(item: TimelineItem, colors: (typeof Colors)['light']) {
  switch (item.kind) {
    case 'sleep': {
      const e = item.data;
      return {
        icon: '💤',
        color: colors.tint,
        label: e.type === 'nap' ? 'Nap' : 'Bedtime',
        subtitle: `${formatDate(new Date(e.startTime))} · ${formatTime(new Date(e.startTime))}${
          e.endTime ? ` – ${formatTime(new Date(e.endTime))}` : ' – ongoing'
        }`,
        badge: !e.endTime ? 'Ongoing' : null,
      };
    }
    case 'feeding': {
      const e = item.data;
      const typeLabel =
        e.feedType === 'breast' ? 'Breast' : e.feedType === 'bottle' ? 'Bottle' : 'Solid';
      const side =
        e.feedType === 'breast' && e.side
          ? ` · ${e.side === 'both' ? 'both sides' : e.side}`
          : '';
      const amount =
        e.amount != null && e.unit ? ` · ${e.amount}${e.unit}` : '';
      return {
        icon: '🍼',
        color: colors.feeding,
        label: `${typeLabel} feed${side}${amount}`,
        subtitle: `${formatDate(new Date(e.startTime))} · ${formatTime(new Date(e.startTime))}${
          e.endTime ? ` – ${formatTime(new Date(e.endTime))}` : e.feedType === 'breast' ? ' – ongoing' : ''
        }`,
        badge: e.feedType === 'breast' && !e.endTime ? 'Ongoing' : null,
      };
    }
    case 'diaper': {
      const e = item.data;
      const label =
        e.diaperType === 'wet' ? 'Wet diaper' : e.diaperType === 'dirty' ? 'Dirty diaper' : 'Mixed diaper';
      return {
        icon: '👶',
        color: colors.diaper,
        label,
        subtitle: `${formatDate(new Date(e.time))} · ${formatTime(new Date(e.time))}`,
        badge: null,
      };
    }
    case 'wake': {
      const e = item.data;
      const isMorning = e.wakeType === 'morning';
      return {
        icon: isMorning ? '☀️' : '🌙',
        color: colors.wake,
        label: isMorning ? 'Start day' : 'Night waking',
        subtitle: `${formatDate(new Date(e.time))} · ${formatTime(new Date(e.time))}${
          e.endTime ? ` – ${formatTime(new Date(e.endTime))}` : ''
        }`,
        badge: null,
      };
    }
  }
}

export function TimelineEntry({ item, onPress, onLongPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const meta = getMeta(item, colors);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <View
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}>
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
          <Text style={styles.icon}>{meta.icon}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
            {meta.badge && (
              <Text style={[styles.badge, { color: colors.asleep }]}>{meta.badge}</Text>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.text }]}>{meta.subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: { fontSize: 22 },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: { fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 12, fontWeight: '600' },
  subtitle: { fontSize: 14 },
});
