import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { NapExtension } from '@/types';

const OPTIONS: NapExtension[] = [
  'independent',
  'feeding',
  'rocking',
  'contact',
  'not_extended',
];

export function NapExtensionSheet({
  visible,
  onSelect,
  onSkip,
  t,
}: {
  visible: boolean;
  onSelect: (extension: NapExtension) => void;
  onSkip: () => void;
  t: (key: string) => string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={styles.backdrop} onPress={onSkip}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('home.extensionTitle')}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('home.extensionHint')}
          </Text>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={[styles.option, { borderColor: colors.border }]}>
              <Text style={[styles.optionText, { color: colors.text }]}>
                {t(`extension.${opt}`)}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={onSkip} style={styles.skip}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>
              {t('home.extensionSkip')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  option: {
    minHeight: touchTarget.minHeight,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  optionText: { fontSize: 16, fontWeight: '500' },
  skip: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { fontSize: 15 },
});
