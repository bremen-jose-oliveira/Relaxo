import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

import { BigButton } from '@/components/BigButton';
import { DatePickerField } from '@/components/DatePickerField';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors, spacing, touchTarget } from '@/constants/Colors';
import { formatDateKey } from '@/lib/dateUtils';
import { useTranslation } from '@/lib/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { AppleSignInButton } from '@/components/AppleSignInButton';

type Step = 'welcome' | 'baby' | 'cloud' | 'widget';

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const locale = useAppStore((s) => s.locale);
  const t = useTranslation(locale);
  const saveBaby = useAppStore((s) => s.saveBaby);
  const setOnboardingCompleted = useAppStore((s) => s.setOnboardingCompleted);
  const authConfigured = useAuthStore((s) => s.configured);
  const appleAvailable = useAuthStore((s) => s.appleAvailable);
  const authUser = useAuthStore((s) => s.user);
  const signInApple = useAuthStore((s) => s.signInApple);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);

  const [step, setStep] = useState<Step>('welcome');
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    await setOnboardingCompleted(true);
    router.replace('/(tabs)' as Href);
  };

  const onSaveBaby = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await saveBaby({
        name: trimmed,
        birthDate: formatDateKey(birthDate),
        napGoal: null,
        trackFeedingDuration: false,
        easilyOverstimulated: false,
        highNeed: false,
      });
      setStep('cloud');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'welcome' ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.welcomeTitle')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t('onboarding.welcomeBody')}
            </Text>
            <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>
              {t('legal.medicalDisclaimer')}
            </Text>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => router.push('/legal/privacy' as Href)} hitSlop={8}>
                <Text style={[styles.legalLink, { color: colors.tint }]}>{t('legal.privacy')}</Text>
              </Pressable>
              <Text style={{ color: colors.textSecondary }}> · </Text>
              <Pressable onPress={() => router.push('/legal/terms' as Href)} hitSlop={8}>
                <Text style={[styles.legalLink, { color: colors.tint }]}>{t('legal.terms')}</Text>
              </Pressable>
            </View>
            <Text style={[styles.legalHint, { color: colors.textSecondary }]}>
              {t('onboarding.legalLinksHint')}
            </Text>
            <Pressable
              onPress={() => setAccepted((v) => !v)}
              style={styles.checkRow}>
              <Switch value={accepted} onValueChange={setAccepted} />
              <Text style={[styles.checkLabel, { color: colors.text }]}>
                {t('onboarding.acceptDisclaimer')}
              </Text>
            </Pressable>
            <BigButton
              title={t('onboarding.continue')}
              onPress={() => setStep('baby')}
              disabled={!accepted}
              style={{ marginTop: spacing.lg }}
            />
          </>
        ) : null}

        {step === 'baby' ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.createBabyTitle')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t('onboarding.createBabyBody')}
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {t('onboarding.babyName')}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.babyName')}
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
              ]}
            />
            <DatePickerField
              label={t('onboarding.birthDate')}
              value={birthDate}
              onChange={setBirthDate}
              maximumDate={new Date()}
            />
            <BigButton
              title={t('onboarding.saveBaby')}
              onPress={onSaveBaby}
              loading={saving}
              disabled={saving || !name.trim()}
              style={{ marginTop: spacing.md }}
            />
            <BigButton
              title={t('onboarding.skipBaby')}
              variant="secondary"
              onPress={() => setStep('cloud')}
              style={{ marginTop: spacing.sm }}
            />
            <Text style={[styles.disclaimer, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {t('onboarding.importTip')}
            </Text>
          </>
        ) : null}

        {step === 'cloud' ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.cloudTitle')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t('onboarding.cloudBody')}
            </Text>
            {authConfigured && appleAvailable && !authUser ? (
              <View style={{ marginBottom: spacing.md }}>
                <AppleSignInButton
                  label={t('profile.signInApple')}
                  loading={isSigningIn}
                  onPress={() => {
                    if (!isSigningIn) void signInApple();
                  }}
                />
              </View>
            ) : null}
            {authUser ? (
              <Text style={[styles.body, { color: colors.tint }]}>
                {t('profile.signedInAs', {
                  email: authUser.email ?? authUser.id.slice(0, 8),
                })}
              </Text>
            ) : null}
            <BigButton
              title={t('onboarding.cloudSkip')}
              onPress={() => setStep('widget')}
              style={{ marginTop: spacing.md }}
            />
          </>
        ) : null}

        {step === 'widget' ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{t('onboarding.widgetTitle')}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              {t('onboarding.widgetBody')}
            </Text>
            <BigButton title={t('onboarding.done')} onPress={finish} style={{ marginTop: spacing.lg }} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: 26, fontWeight: '800', marginBottom: spacing.sm },
  body: { fontSize: 16, lineHeight: 24, marginBottom: spacing.md },
  disclaimer: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm, fontStyle: 'italic' },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  legalLink: { fontSize: 15, fontWeight: '600' },
  legalHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.md },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    fontSize: 18,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget.minHeight,
    marginBottom: spacing.md,
  },
});
