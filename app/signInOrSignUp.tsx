import PasswordTextInputRow from '@/components/PasswordTextInputRow';
import { AntDesign } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { profileNeedsServiceArea } from '../hooks/useAccountStatus';
import { getAuthErrorMessage } from '../utils/auth-helpers';
import {
  configureNativeGoogleSignIn,
  getNativeGoogleIdToken,
  getNativeGoogleSignInErrorMessage,
} from '../utils/nativeGoogleAuth';

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
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState('');
  const canUseNativeGoogle = Platform.OS !== 'web';

  useEffect(() => {
    if (canUseNativeGoogle) {
      configureNativeGoogleSignIn();
    }
  }, [canUseNativeGoogle]);

  function routeAfterAuth() {
    if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as any);
      return;
    }

    router.replace('/(tabs)/profilebutton' as any);
  }

  const handleAuthSuccess = async (user: User) => {
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const profileSnapshot = await getDoc(userRef);
    const profileData = profileSnapshot.exists() ? (profileSnapshot.data() as Record<string, unknown>) : null;
    const fallbackEmail = user.email || email.trim().toLowerCase();
    const fallbackName = String(user.displayName || fallbackEmail.split('@')[0] || 'User').trim();
    const needsSetup = !profileSnapshot.exists() || profileNeedsServiceArea(profileData as any);

    if (!profileSnapshot.exists()) {
      await setDoc(
        userRef,
        {
          email: fallbackEmail,
          accountType: 'personal',
          name: fallbackName,
          displayName: fallbackName,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          publicProfileEnabled: false,
        },
        { merge: true }
      );
    } else {
      await setDoc(
        userRef,
        {
          email: fallbackEmail,
          lastLoginAt: serverTimestamp(),
          ...(fallbackName ? { displayName: fallbackName } : {}),
        },
        { merge: true }
      );
    }

    if (needsSetup) {
      router.replace({
        pathname: '/zipCodeverify' as any,
        params: typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : undefined,
      });
      return;
    }

    routeAfterAuth();
  };

  const goToSignup = () => {
    router.push({
      pathname: '/signup' as any,
      params: typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : undefined,
    });
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

  const handleGoogleLogin = async () => {
    if (!canUseNativeGoogle || submitting || googleBusy) {
      return;
    }

    setError('');
    setGoogleBusy(true);

    try {
      const idToken = await getNativeGoogleIdToken();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      await handleAuthSuccess(userCredential.user);
    } catch (googleError) {
      console.error('Google login error:', googleError);
      const message = getNativeGoogleSignInErrorMessage(googleError);
      if (message) {
        setError(message);
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleEmailLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await handleAuthSuccess(userCredential.user);
    } catch (authError) {
      setError(getAuthErrorMessage(authError, 'login'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <View style={styles.card}>
              <Text style={styles.title}>Welcome to Local List</Text>
              <Text style={styles.subtitle}>Find everything happening around you</Text>

              {canUseNativeGoogle ? (
                <TouchableOpacity
                  style={[styles.googleButton, (googleBusy || submitting) && styles.disabledButton]}
                  onPress={handleGoogleLogin}
                  disabled={googleBusy || submitting}
                >
                  <View style={styles.googleButtonContent}>
                    <View style={styles.googleIconBadge}>
                      <AntDesign name="google" size={18} color="#4285F4" />
                    </View>
                    <Text style={styles.googleButtonText}>
                      {googleBusy ? 'Signing in...' : 'Continue with Google'}
                    </Text>
                    {googleBusy ? <ActivityIndicator size="small" color="#64748b" /> : null}
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.webNotice}>
                  <Text style={styles.webNoticeText}>
                    Google sign-in runs in the Local List Android or iOS app. Use email login here on the web.
                  </Text>
                </View>
              )}

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldBlock}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="Email"
                  editable={!submitting && !googleBusy}
                />
              </View>

              <View style={styles.fieldBlock}>
                <PasswordTextInputRow
                  containerStyle={styles.passwordRow}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  editable={!submitting && !googleBusy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, (submitting || googleBusy) && styles.disabledButton]}
                onPress={handleEmailLogin}
                disabled={submitting || googleBusy}
              >
                <Text style={styles.loginButtonText}>{submitting ? 'Logging In...' : 'Log In'}</Text>
              </TouchableOpacity>

              <View style={styles.bottomLinks}>
                <TouchableOpacity style={styles.inlineLinkRow} onPress={goToSignup}>
                  <Text style={styles.bottomText}>Don&apos;t have an account? </Text>
                  <Text style={styles.bottomLink}>Sign up</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
                  <Text style={styles.bottomLink}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/(app)/contactus')}>
                  <Text style={styles.bottomLink}>Trouble logging in? Contact Us</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 220,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    color: '#475569',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#64748b',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  webNotice: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  webNoticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: 1,
    fontSize: 12,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  passwordRow: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingRight: 2,
  },
  passwordInput: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  loginButton: {
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  bottomLinks: {
    marginTop: 20,
    alignItems: 'center',
  },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  bottomText: {
    color: '#64748b',
    fontSize: 14,
  },
  bottomLink: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  forgotLink: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelLink: {
    marginTop: 4,
    alignItems: 'center',
  },
  cancelLinkText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
