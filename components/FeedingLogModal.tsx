import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BigButton } from '@/components/BigButton';
import { DateTimePickerField } from '@/components/DateTimePickerField';
import { useAppStore, useActiveBaby, useOngoingFeeding } from '@/store/useAppStore';
import { isInstantFeeding } from '@/lib/feedingUtils';
import { getLastBreastSide, suggestNextBreastSide } from '@/lib/breastSide';
import { formatTime } from '@/lib/dateUtils';
import { useTranslation } from '@/lib/i18n';
import type { FeedingEvent } from '@/types';

type Props = {
  visible: boolean;
  initial?: FeedingEvent | null;
  babyId: string;
  onClose: () => void;
};

type Mode = 'pick' | 'breast' | 'bottle' | 'solid';

export function FeedingLogModal({ visible, initial, babyId, onClose }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const baby = useActiveBaby();
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const trackDuration = baby?.trackFeedingDuration ?? false;
  const feedings = useAppStore((s) => s.feedings);
  const ongoing = useOngoingFeeding();
  const startBreastFeed = useAppStore((s) => s.startBreastFeed);
  const endBreastFeed = useAppStore((s) => s.endBreastFeed);
  const addFeeding = useAppStore((s) => s.addFeeding);
  const editFeeding = useAppStore((s) => s.editFeeding);

  const [mode, setMode] = useState<Mode>('pick');
  const [side, setSide] = useState<FeedingEvent['side']>('left');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<'ml' | 'oz' | 'g'>('ml');
  const [feedTime, setFeedTime] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  const suggestedSide = suggestNextBreastSide(feedings);
  const lastBreastSide = getLastBreastSide(feedings);

  const sideLabel = (s: 'left' | 'right' | 'both') =>
    s === 'both' ? t('common.both') : s === 'left' ? t('common.left') : t('common.right');

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setMode(initial.feedType);
      setSide(initial.side ?? 'left');
      setAmount(initial.amount?.toString() ?? '');
      setUnit(initial.unit ?? (initial.feedType === 'solid' ? 'g' : 'ml'));
      const start = new Date(initial.startTime);
      setStartTime(start);
      setFeedTime(start);
      setEndTime(initial.endTime ? new Date(initial.endTime) : new Date());
    } else {
      setMode('pick');
      setSide(suggestNextBreastSide(feedings));
      setAmount('');
      setUnit('ml');
      const now = new Date();
      setFeedTime(now);
      setStartTime(now);
      setEndTime(now);
    }
  }, [visible, initial, feedings]);

  if (!visible) return null;

  const logInstantBreast = async () => {
    const now = new Date().toISOString();
    await addFeeding({
      babyId,
      feedType: 'breast',
      startTime: now,
      endTime: now,
      side,
      amount: null,
      unit: null,
      notes: null,
    });
    onClose();
  };

  const saveInstant = async (feedType: 'bottle' | 'solid') => {
    const parsed = parseFloat(amount);
    const now = new Date().toISOString();
    const payload: Omit<FeedingEvent, 'id'> = {
      babyId,
      feedType,
      startTime: initial?.startTime ?? now,
      endTime: initial?.endTime ?? now,
      side: null,
      amount: Number.isFinite(parsed) ? parsed : null,
      unit: feedType === 'solid' ? 'g' : unit,
      notes: initial?.notes ?? null,
    };
    if (initial) await editFeeding({ ...payload, id: initial.id });
    else await addFeeding(payload);
    onClose();
  };

  const saveEdited = async () => {
    if (!initial) return;
    const parsed = parseFloat(amount);
    const instant = isInstantFeeding(initial) || initial.feedType !== 'breast';
    const timeIso = feedTime.toISOString();
    await editFeeding({
      ...initial,
      side: initial.feedType === 'breast' ? side : null,
      startTime: instant ? timeIso : startTime.toISOString(),
      endTime: instant ? timeIso : endTime.toISOString(),
      amount: Number.isFinite(parsed) ? parsed : null,
      unit: initial.feedType === 'solid' ? 'g' : initial.feedType === 'bottle' ? unit : null,
    });
    onClose();
  };

  const startBreast = async () => {
    await startBreastFeed(side);
    onClose();
  };

  const endBreast = async () => {
    await endBreastFeed();
    onClose();
  };

  const editingInstant =
    initial &&
    (initial.feedType !== 'breast' || isInstantFeeding(initial) || !trackDuration);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {initial ? t('feeding.editTitle') : t('feeding.title')}
        </Text>

        {initial ? (
          <View>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
              {initial.feedType === 'breast'
                ? t('feeding.breastFeed')
                : initial.feedType === 'bottle'
                  ? t('feeding.bottleFeed')
                  : t('feeding.solidFeed')}
            </Text>
            {initial.feedType === 'breast' && (
              <View style={styles.chips}>
                {(['left', 'right', 'both'] as const).map((s) => (
                  <Chip
                    key={s}
                    label={sideLabel(s)}
                    selected={side === s}
                    color={colors.feeding}
                    onPress={() => setSide(s)}
                    colors={colors}
                  />
                ))}
              </View>
            )}
            {(initial.feedType === 'bottle' || initial.feedType === 'solid') && (
              <AmountInput
                amount={amount}
                unit={initial.feedType === 'solid' ? 'g' : unit}
                onAmount={setAmount}
                onUnit={setUnit}
                solid={initial.feedType === 'solid'}
                colors={colors}
                amountLabel={t('feeding.amount')}
              />
            )}
            {editingInstant ? (
              <DateTimePickerField
                label={t('feeding.time')}
                value={feedTime}
                onChange={setFeedTime}
                maximumDate={new Date()}
              />
            ) : (
              <>
                <DateTimePickerField
                  label={t('feeding.start')}
                  value={startTime}
                  onChange={setStartTime}
                  maximumDate={new Date()}
                />
                <DateTimePickerField
                  label={t('feeding.end')}
                  value={endTime}
                  onChange={setEndTime}
                  minimumDate={startTime}
                  maximumDate={new Date()}
                  style={{ marginTop: spacing.md }}
                />
              </>
            )}
            <BigButton title={t('common.save')} onPress={saveEdited} style={{ marginTop: spacing.lg }} />
          </View>
        ) : mode === 'pick' ? (
          <View style={styles.pickGrid}>
            <BigButton title={t('feeding.breast')} onPress={() => {
              setSide(suggestNextBreastSide(feedings));
              setMode('breast');
            }} />
            <BigButton
              title={t('feeding.bottle')}
              variant="secondary"
              onPress={() => setMode('bottle')}
              style={{ marginTop: spacing.sm }}
            />
            <BigButton
              title={t('feeding.solid')}
              variant="secondary"
              onPress={() => {
                setUnit('g');
                setMode('solid');
              }}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : mode === 'breast' ? (
          <View>
            {trackDuration && ongoing ? (
              <>
                <Text style={[styles.hint, { color: colors.text }]}>
                  {t('home.feedingSince', {
                    time: formatTime(new Date(ongoing.startTime)),
                  })}
                  {ongoing.side ? ` · ${ongoing.side}` : ''}
                </Text>
                <BigButton title={t('feeding.endFeeding')} onPress={endBreast} style={{ marginTop: spacing.lg }} />
              </>
            ) : (
              <>
                {lastBreastSide ? (
                  <View style={[styles.suggestBanner, { backgroundColor: colors.feeding + '22', borderColor: colors.feeding }]}>
                    <Text style={[styles.suggestTitle, { color: colors.feeding }]}>
                      {t('feeding.suggestedSide', { side: sideLabel(suggestedSide) })}
                    </Text>
                    <Text style={[styles.suggestSub, { color: colors.textSecondary }]}>
                      {t('feeding.lastFeedSide', { side: sideLabel(lastBreastSide) })}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.section, { color: colors.textSecondary }]}>{t('feeding.side')}</Text>
                <View style={styles.chips}>
                  {(['left', 'right', 'both'] as const).map((s) => (
                    <Chip
                      key={s}
                      label={sideLabel(s)}
                      selected={side === s}
                      suggested={!initial && s === suggestedSide && s !== 'both'}
                      color={colors.feeding}
                      onPress={() => setSide(s)}
                      colors={colors}
                    />
                  ))}
                </View>
                <Text style={[styles.hintSmall, { color: colors.textSecondary }]}>
                  {trackDuration ? t('feeding.trackHint') : t('feeding.instantHint')}
                </Text>
                <BigButton
                  title={trackDuration ? t('feeding.startFeeding') : t('feeding.logBreastNow')}
                  onPress={trackDuration ? startBreast : logInstantBreast}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            )}
          </View>
        ) : (
          <View>
            <AmountInput
              amount={amount}
              unit={mode === 'solid' ? 'g' : unit}
              onAmount={setAmount}
              onUnit={setUnit}
              solid={mode === 'solid'}
              colors={colors}
              amountLabel={t('feeding.amount')}
            />
            <BigButton
              title={t('feeding.logNow')}
              onPress={() => saveInstant(mode)}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        )}

        <BigButton
          title={t('common.cancel')}
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: spacing.md }}
        />
      </SafeAreaView>
    </Modal>
  );
}

function Chip({
  label,
  selected,
  suggested = false,
  color,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  suggested?: boolean;
  color: string;
  onPress: () => void;
  colors: (typeof Colors)['light'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? color : colors.card,
          borderColor: suggested && !selected ? color : colors.border,
          borderWidth: suggested && !selected ? 2 : 1,
        },
      ]}>
      <Text style={{ color: selected ? '#FFF' : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function AmountInput({
  amount,
  unit,
  onAmount,
  onUnit,
  solid,
  colors,
  amountLabel,
}: {
  amount: string;
  unit: 'ml' | 'oz' | 'g';
  onAmount: (v: string) => void;
  onUnit: (u: 'ml' | 'oz') => void;
  solid: boolean;
  colors: (typeof Colors)['light'];
  amountLabel: string;
}) {
  return (
    <View>
      <Text style={[styles.section, { color: colors.textSecondary }]}>{amountLabel}</Text>
      <TextInput
        value={amount}
        onChangeText={onAmount}
        keyboardType="decimal-pad"
        placeholder={solid ? 'g' : 'ml'}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
        ]}
      />
      {!solid && (
        <View style={[styles.chips, { marginTop: spacing.sm }]}>
          {(['ml', 'oz'] as const).map((u) => (
            <Chip
              key={u}
              label={u}
              selected={unit === u}
              color={colors.feeding}
              onPress={() => onUnit(u)}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  title: { fontSize: 24, fontWeight: '700', marginBottom: spacing.lg },
  pickGrid: {},
  section: { fontSize: 14, fontWeight: '500', marginBottom: spacing.sm },
  hint: { fontSize: 17, lineHeight: 24 },
  hintSmall: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  suggestBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  suggestTitle: { fontSize: 16, fontWeight: '700' },
  suggestSub: { fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    minHeight: touchTarget.minHeight - 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    fontSize: 18,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget.minHeight,
  },
});
