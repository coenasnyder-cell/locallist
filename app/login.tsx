import { AntDesign } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  type User
} from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
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
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuth';
import { app, auth } from '../firebase';
import { profileNeedsServiceArea } from '../hooks/useAccountStatus';
import {
  getAuthErrorMessage,
  getPostAuthRoute,
  GOOGLE_SIGN_IN_GENERIC_MESSAGE,
  isPasswordAccountUnverified,
} from '../utils/auth-helpers';

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
  androidClientId: GOOGLE_AUTH_CONFIG.androidClientId,
  iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
  webClientId: GOOGLE_AUTH_CONFIG.clientId,
});

  function routeAfterAuth(isNewUser: boolean) {
    router.replace(getPostAuthRoute({ isNewUser }) as any);
  }

  const handleAuthSuccess = async (user: User, isGoogleUser: boolean) => {
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const profileSnapshot = await getDoc(userRef);
    const isNewUser = !profileSnapshot.exists();

    if (isNewUser && isGoogleUser) {
      await setDoc(
        userRef,
        {
          email: user.email || '',
          accountType: 'personal',
          lastLoginAt: serverTimestamp(),
          publicProfileEnabled: false,
        },
        { merge: true }
      );
      router.replace('/zipCodeverify' as any);
      return;
    }

if (!profileSnapshot.exists()) {
  await setDoc(
    userRef,
    {
      email: user.email || email.trim().toLowerCase(),
      accountType: 'personal',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );

  router.replace('/zipCodeverify');
  return;
}

    const firestoreProfile = profileSnapshot.data();

    await setDoc(userRef, {
      email: user.email || '',
      lastLoginAt: serverTimestamp(),
    }, { merge: true });

    // Match useAccountStatus / zip gate: 5-digit ZIP + name (not the loose email+zip+name check).
    if (profileNeedsServiceArea(firestoreProfile as Parameters<typeof profileNeedsServiceArea>[0])) {
      router.replace('/zipCodeverify' as any);
      return;
    }

    routeAfterAuth(false);
  };

  const goToSignup = () => {
    router.push('/signup');
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
      if (isPasswordAccountUnverified(userCredential.user)) {
        setError('Please verify your email before continuing.');
        return;
      }
      await handleAuthSuccess(userCredential.user, false);
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

              <TouchableOpacity
                style={[styles.googleButton, !request && styles.disabledButton]}
                onPress={async () => {
                  try {
                    const result = await promptAsync();
                
                    console.log("PROMPT RESULT:", result);
                
                    if (result?.type !== 'success') return;
                
                    const idToken =
                      result.authentication?.idToken ?? result.params?.id_token;
                
                    if (!idToken) {
                      setError(GOOGLE_SIGN_IN_GENERIC_MESSAGE);
                      return;
                    }
                
                    const credential = GoogleAuthProvider.credential(idToken);
                    const userCredential = await signInWithCredential(auth, credential);
                
                    await handleAuthSuccess(userCredential.user, true);
                
                  } catch (e) {
                    setError(GOOGLE_SIGN_IN_GENERIC_MESSAGE);
                  }
                }}
                disabled={!request || submitting}
              >
                <View style={styles.googleButtonContent}>
                  <View style={styles.googleIconBadge}>
                    <AntDesign name="google" size={18} color="#4285F4" />
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              </TouchableOpacity>

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
                  editable={!submitting}
                />
              </View>

              <View style={styles.fieldBlock}>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="Password"
                  editable={!submitting}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, submitting && styles.disabledButton]}
                onPress={handleEmailLogin}
                disabled={submitting}
              >
                <Text style={styles.loginButtonText}>{submitting ? 'Logging In...' : 'Log In'}</Text>
              </TouchableOpacity>

              <View style={styles.bottomLinks}>
                <TouchableOpacity style={styles.inlineLinkRow} onPress={goToSignup}>
                  <Text style={styles.bottomText}>Don't have an account? </Text>
                  <Text style={styles.bottomLink}>Sign up</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
                  <Text style={styles.bottomLink}>Forgot password?</Text>
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
