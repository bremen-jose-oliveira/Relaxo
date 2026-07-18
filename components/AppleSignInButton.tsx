import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { SymbolView } from 'expo-symbols';
import { spacing, touchTarget } from '@/constants/Colors';
import { canRenderNativeAppleAuthButton } from '@/lib/auth';

type Props = {
  onPress: () => void;
  loading?: boolean;
  /** Visible label for the custom fallback button (i18n). */
  label: string;
};

/**
 * Official Apple button when the native view exists (preview / production / dev client).
 * Custom black button otherwise — never mounts the unimplemented Expo Go view.
 */
export function AppleSignInButton({ onPress, loading = false, label }: Props) {
  if (Platform.OS !== 'ios') return null;

  if (canRenderNativeAppleAuthButton()) {
    return (
      <View style={styles.wrap}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={14}
          style={[styles.nativeBtn, loading && styles.disabled]}
          onPress={() => {
            if (!loading) onPress();
          }}
        />
        {loading ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#FFF" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fallback,
        (pressed || loading) && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <>
          <SymbolView
            name={{ ios: 'apple.logo', android: 'phone_iphone', web: 'phone_iphone' }}
            tintColor="#FFF"
            size={20}
          />
          <Text style={styles.fallbackLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: touchTarget.minHeight,
    position: 'relative',
  },
  nativeBtn: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  fallback: {
    width: '100%',
    minHeight: touchTarget.minHeight,
    borderRadius: 14,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fallbackLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
