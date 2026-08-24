import { Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';

export function SettingsHeaderButton() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel={t('tabs.settings')}
      hitSlop={12}
      style={{ marginRight: 4, padding: 6 }}>
      <SymbolView
        name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
        tintColor={colors.text}
        size={22}
      />
    </Pressable>
  );
}
