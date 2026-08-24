import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/Colors';
import { installHouseholdAutoSyncHooks } from '@/lib/autoSync';
import { installHouseholdRealtimeSync } from '@/lib/realtimeSync';
import { setupSleepLiveActivityLinking } from '@/lib/sleepLiveActivityLinking';
import { setupSleepWidgetInteractions } from '@/lib/sleepWidgetActions';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    return installHouseholdAutoSyncHooks();
  }, []);

  useEffect(() => {
    return installHouseholdRealtimeSync();
  }, []);

  useEffect(() => {
    return setupSleepLiveActivityLinking();
  }, []);

  useEffect(() => {
    return setupSleepWidgetInteractions();
  }, []);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return <RootLayoutNav />;
}

const RelaxoLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const RelaxoDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? RelaxoDarkTheme : RelaxoLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="tasks"
          options={{
            title: t('tabs.tasks'),
            presentation: 'card',
            headerBackTitle: t('tabs.log'),
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: t('tabs.settings'),
            presentation: 'card',
            headerBackTitle: t('tabs.home'),
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
