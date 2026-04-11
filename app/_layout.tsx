import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccountStatus } from '@/hooks/useAccountStatus';

export const unstable_settings = {
  anchor: '(tabs)',
};

const PUBLIC_ROUTES = new Set([
  '',
  'index',
  'publiclanding',
  'login',
  'signup',
  'signInOrSignUp',
  'zipCodeverify',
  'forgot-password',
  'verify-email',
  'auth-action',
  'account-restricted',
  'contactus',
]);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isBanned, isDisabled, needsServiceAreaProfile } = useAccountStatus();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      const segment = (pathname ?? '').replace(/^\//, '').split('/')[0] ?? '';
      if (!PUBLIC_ROUTES.has(segment)) {
        router.replace('/');
      }
      return;
    }

    if (isBanned || isDisabled) {
      if (pathname !== '/account-restricted') {
        router.replace('/account-restricted');
      }
      return;
    }

    if (needsServiceAreaProfile && pathname !== '/zipCodeverify') {
      router.replace('/zipCodeverify');
    }
  }, [user, loading, isBanned, isDisabled, needsServiceAreaProfile, pathname, router]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signInOrSignUp" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen
            name="zipCodeverify"
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'none',
            }}
          />
          <Stack.Screen name="verify-email" options={{ headerShown: false }} />
          <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="account-restricted" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
