import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router, type Href } from 'expo-router';
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
  const initialize = useAppStore((s) => s.initialize);
  const isInitialized = useAppStore((s) => s.isInitialized);
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  const babies = useAppStore((s) => s.babies);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;
    if (!onboardingCompleted && babies.length === 0) {
      router.replace('/onboarding' as Href);
    }
  }, [isInitialized, onboardingCompleted, babies.length]);

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
        <Stack.Screen
          name="legal/privacy"
          options={{
            title: t('legal.privacy'),
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="legal/terms"
          options={{
            title: t('legal.terms'),
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
