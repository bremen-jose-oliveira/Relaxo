import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LegalMarkdown } from '@/components/LegalMarkdown';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { TERMS_URL, IMPRESSUM_URL } from '@/constants/legal';
import { TERMS_OF_USE_MARKDOWN } from '@/lib/legal/content';
import { useTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';

export default function TermsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LegalMarkdown markdown={TERMS_OF_USE_MARKDOWN} />
        <Pressable
          onPress={() => void Linking.openURL(IMPRESSUM_URL)}
          style={[styles.linkBtn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.tint, fontWeight: '700' }}>{t('legal.impressum')}</Text>
        </Pressable>
        {TERMS_URL ? (
          <Pressable
            onPress={() => void Linking.openURL(TERMS_URL)}
            style={[styles.linkBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.tint, fontWeight: '700' }}>
              {t('legal.openInBrowser')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  linkBtn: {
    marginTop: spacing.md,
    minHeight: touchTarget.minHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
});
