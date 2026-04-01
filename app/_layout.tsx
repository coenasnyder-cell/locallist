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

const AUTH_ROUTES = new Set(['login', 'signInOrSignUp', 'forgot-password', 'verify-email', 'auth-action', 'account-restricted']);
const PUBLIC_TAB_ROUTES = new Set(['index', 'browsebutton', 'communitybutton', 'supporthubbutton']);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { user, loading, isVerified, isBanned, isDisabled } = useAccountStatus();

  useEffect(() => {
    if (loading) return;

    const topSegment = segments[0] || '';
    const childSegment = segments[1] || 'index';
    const inAuthRoute = AUTH_ROUTES.has(topSegment);
    const inTabsGroup = topSegment === '(tabs)';
    const inAppGroup = topSegment === '(app)';

    if (!user) {
      if (inAppGroup || (inTabsGroup && !PUBLIC_TAB_ROUTES.has(childSegment))) {
        if (pathname !== '/login') {
          router.replace('/login');
        }
      }
      return;
    }

    if (isBanned || isDisabled) {
      if (pathname !== '/account-restricted') {
        router.replace('/account-restricted');
      }
      return;
    }

    if (pathname === '/account-restricted') {
      router.replace('/(tabs)');
      return;
    }

    if (!isVerified && topSegment !== 'verify-email' && topSegment !== 'auth-action') {
      router.replace({
        pathname: '/verify-email',
        params: {
          email: user.email || '',
          isNewUser: 'false',
        },
      });
      return;
    }

    if (isVerified && inAuthRoute && topSegment !== 'auth-action') {
      router.replace('/(tabs)');
    }
  }, [isBanned, isDisabled, isVerified, loading, pathname, router, segments, user]);

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