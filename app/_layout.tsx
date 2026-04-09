import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccountStatus } from '@/hooks/useAccountStatus';
export const unstable_settings = {
  anchor: '(tabs)',
};

const AUTH_ROUTES = new Set([
  'login',
  'signup',
  'signInOrSignUp',
  'zipCodeverify',
  'forgot-password',
  'verify-email',
  'auth-action',
  'account-restricted',
]);
const PUBLIC_TAB_ROUTES = new Set(['index', 'browsebutton', 'communitybutton', 'supporthubbutton']);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { user, loading, isVerified, isBanned, isDisabled, needsServiceAreaProfile } = useAccountStatus();
  useEffect(() => {
    if (loading) return;

    // Not logged in → allow auth/onboarding screens; otherwise send to login
    if (!user) {
      const segment = (pathname ?? '').replace(/^\//, '').split('/')[0] ?? '';
      if (!AUTH_ROUTES.has(segment)) {
        router.replace('/login');
      }
      return;
    }
  
    // 🚨 Banned / disabled
    if (isBanned || isDisabled) {
      if (pathname !== '/account-restricted') {
        router.replace('/account-restricted');
      }
      return;
    }
  
    const onZipPage = pathname === '/zipCodeverify';
  
    // 🔥 FORCE ZIP PAGE if profile incomplete
    if (isVerified && needsServiceAreaProfile && !onZipPage) {
      router.replace('/zipCodeverify');
      return;
    }
  
    // 🔥 PREVENT leaving ZIP page until complete
    if (isVerified && needsServiceAreaProfile && onZipPage) {
      return; // stay here
    }
  
    // 🔥 AFTER completion → go to app
    if (isVerified && !needsServiceAreaProfile && pathname === '/zipCodeverify') {
      router.replace('/');
      return;
    }
  
  }, [user, loading, isBanned, isDisabled, isVerified, needsServiceAreaProfile, pathname, router]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
  {/* App pages with header */}
  <Stack.Screen name="(app)" options={{ headerShown: false }} />
  
  {/* Auth pages use in-app universal header component */}
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen
  name="login"
  options={{
    headerShown: false,
  }}
/>
  <Stack.Screen
  name="signInOrSignUp"
  options={{
    headerShown: false,
  }}
/>
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