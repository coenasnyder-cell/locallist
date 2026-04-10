import PasswordTextInputRow from '@/components/PasswordTextInputRow';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Header from '../components/Header';
import { app, auth } from '../firebase';
import { getAuthErrorMessage } from '../utils/auth-helpers';

export const unstable_settings = {
  headerShown: false,
};

export const screenOptions = {
  headerShown: false,
};

export default function SignInOrSignUp() {
  const router = useRouter();
  const { email: emailParam, returnTo: returnToParam } = useLocalSearchParams();
  const initialEmail = Array.isArray(emailParam) ? emailParam[0] : emailParam;
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;

  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const routeAfterAuth = () => {
    if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as any);
      return;
    }

    router.replace('/(tabs)/profilebutton' as any);
  };

  const handleAuth = async () => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      if (!user) {
        setError('Authentication failed');
        return;
      }
      const db = getFirestore(app);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          email: user.email,
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );
      routeAfterAuth();
    } catch (e: unknown) {
      setError(getAuthErrorMessage(e, 'login'));
    }
  };

  const handleResetPassword = () => {
    router.push('/forgot-password');
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as any);
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <>
      <Header />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.container}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            contentInset={{ bottom: 240 }}
            scrollIndicatorInsets={{ bottom: 240 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <View style={styles.formWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <PasswordTextInputRow
                containerStyle={styles.passwordRow}
                style={styles.passwordInput}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {error ? (
                <TouchableOpacity style={styles.resetLinkInline} onPress={handleResetPassword}>
                  <Text style={styles.resetLinkText}>Forgot Your Password</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.authActionRow}>
                <TouchableOpacity style={[styles.button, styles.primaryActionButton]} onPress={handleAuth}>
                  <Text style={styles.buttonText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelActionButton} onPress={handleCancel}>
                  <Text style={styles.cancelActionButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.resetLinkBottom} onPress={handleResetPassword}>
                <Text style={styles.resetLinkText}>Forgot Your Password</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.troubleLink} onPress={() => router.push('/(app)/contactus')}>
                <Text style={styles.troubleLinkText}>Trouble logging in? Contact Us</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signupLink}
                onPress={() =>
                  router.push({
                    pathname: '/signup' as any,
                    params: typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : undefined,
                  })
                }
              >
                <Text style={styles.signupLinkText}>Don&apos;t have an account? Create one</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 220,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  formWrapper: {
    width: '100%',
    maxWidth: 350,
    alignSelf: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  passwordRow: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 16,
    paddingRight: 2,
    backgroundColor: '#fff',
  },
  passwordInput: { paddingVertical: 12, paddingHorizontal: 12, fontSize: 16 },
  button: { backgroundColor: '#475569', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  authActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 },
  primaryActionButton: { flex: 1, marginBottom: 0, paddingHorizontal: 16 },
  cancelActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionButtonText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  resetLinkInline: { marginBottom: 12, alignItems: 'center' },
  resetLinkBottom: { marginBottom: 12, alignItems: 'center' },
  resetLinkText: { color: '#475569', textDecorationLine: 'underline', fontSize: 14 },
  troubleLink: { marginBottom: 16, alignItems: 'center' },
  troubleLinkText: { color: '#475569', textDecorationLine: 'underline', fontSize: 14, fontWeight: '600' },
  signupLink: { marginBottom: 12, alignItems: 'center' },
  signupLinkText: { color: '#475569', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  error: { color: 'red', marginBottom: 12, textAlign: 'center' },
});
