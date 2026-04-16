import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Text, TextInput } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Header from '@/components/Header';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePathname } from 'expo-router';
import { getAuth } from 'firebase/auth';
import React, { useEffect } from 'react';
import { app } from '../firebase';
import { MessagesProvider } from '../providers/MessagesProvider';

const globalFontStyle = { fontFamily: 'Inter' as const };

(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = [globalFontStyle, (Text as any).defaultProps.style];

(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.style = [globalFontStyle, (TextInput as any).defaultProps.style];

if (process.env.NODE_ENV === 'development') {
  LogBox.ignoreLogs([
    'SafeAreaView has been deprecated',
    'react-native-safe-area-context',
    "Can't perform a React state update on a component that hasn't mounted yet",
  ]);
}

const HIDE_HEADER_ROUTES = [
  '/login',
  '/signInOrSignUp',
  '/signup',
  '/zipCodeverify',
  '/verify-email',
  '/forgot-password',
  '/account-restricted',
  '/threadchat',
  '/publiclanding',
];

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  const hideHeader =
    HIDE_HEADER_ROUTES.some((r) => pathname.includes(r)) ||
    (pathname === '/' && !getAuth(app).currentUser);

  useEffect(() => {
    console.log('[RootLayout] mounted');
    return () => console.log('[RootLayout] unmounted');
  }, []);

  return (
    <StripeProvider publishableKey="">
      <MessagesProvider>
        <SafeAreaProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {!hideHeader && <Header />}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signInOrSignUp" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="zipCodeverify" options={{ gestureEnabled: false, animation: 'none' }} />
              <Stack.Screen name="verify-email" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="account-restricted" />
              <Stack.Screen name="privacy" />
              <Stack.Screen name="termsOfUse" />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SafeAreaProvider>
      </MessagesProvider>
    </StripeProvider>
  );
}