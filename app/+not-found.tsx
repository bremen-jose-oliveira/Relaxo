import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function NotFoundScreen() {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: colors.tint }]}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
