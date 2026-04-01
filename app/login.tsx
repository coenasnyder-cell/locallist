import { AntDesign } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
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
import { getAuthErrorMessage, getPostAuthRoute, isPasswordAccountUnverified } from '../utils/auth-helpers';

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_AUTH_CONFIG.clientId,
    androidClientId: GOOGLE_AUTH_CONFIG.androidClientId,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
  });

  // Clear any persisted auth state when component mounts
  React.useEffect(() => {
    const clearAuth = async () => {
      try {
        if (auth.currentUser) {
          await signOut(auth);
        }
      } catch (err) {
        console.log('Note: No user to sign out');
      }
    };
    clearAuth();
  }, []);

  const routeAfterAuth = (isNewUser: boolean) => {
    router.replace(getPostAuthRoute({ isNewUser }) as any);
  };

  const handleAuthSuccess = async (user: User, isGoogleUser: boolean) => {
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    const profileSnapshot = await getDoc(userRef);
    const isNewUser = !profileSnapshot.exists();

    if (isNewUser && isGoogleUser) {
      const fallbackName = user.displayName || user.email?.split('@')[0] || 'User';
      await setDoc(userRef, {
        email: user.email || '',
        displayName: fallbackName,
        name: fallbackName,
        accountType: 'personal',
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
      router.replace('/(tabs)' as any);
      return;
    }

    if (!profileSnapshot.exists()) {
      router.push({
        pathname: '/signInOrSignUp',
        params: { mode: 'signup', email: user.email || email.trim().toLowerCase() },
      });
      return;
    }

    const profile = profileSnapshot.data() || {};
    const hasMinimumProfile = Boolean(
      profile.email && profile.zipCode && (profile.name || profile.displayName)
    );

    await setDoc(userRef, {
      email: user.email || '',
      lastLoginAt: serverTimestamp(),
    }, { merge: true });

    if (!hasMinimumProfile) {
      router.replace('/(tabs)/profilebutton');
      return;
    }

    if (isGoogleUser) {
      router.replace('/(tabs)' as any);
      return;
    }

    routeAfterAuth(false);
  };

  const goToSignup = () => {
    const nextEmail = email.trim().toLowerCase();
    router.push({
      pathname: '/signInOrSignUp',
      params: {
        mode: 'signup',
        ...(nextEmail ? { email: nextEmail } : {}),
      },
    });
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

  React.useEffect(() => {
    const finishGoogleSignIn = async () => {
      if (response?.type === 'error') {
        const googleError = (response as any)?.params?.error_description || 'Google authorization failed. Check OAuth setup and try again.';
        setError(googleError);
        return;
      }

      if (response?.type !== 'success') {
        return;
      }

      // Android may return the token in params while iOS/web often provide authentication.idToken.
      const idToken = response.authentication?.idToken ?? (response as any)?.params?.id_token;
      if (!idToken) {
        setError('Google sign-in failed: no ID token received.');
        return;
      }

      try {
        // Sign out any existing session to avoid conflicts
        try {
          if (auth.currentUser) {
            await signOut(auth);
          }
        } catch {
          // Ignore if no user to sign out
        }

        console.log('GOOGLE RESPONSE:', response);
        console.log('ID TOKEN:', idToken);
        const credential = GoogleAuthProvider.credential(idToken);
        const userCredential = await signInWithCredential(auth, credential);
        await handleAuthSuccess(userCredential.user, true);
      } catch (signInError: any) {
        console.error('Google sign-in error:', signInError?.code || signInError?.message);
        
        // Handle various Firebase Auth errors
        if (signInError?.code === 'auth/account-exists-with-different-credential') {
          setError('This email is already linked to a different sign-in method. Please use your original method or reset your password.');
        } else if (signInError?.code === 'auth/email-already-in-use') {
          setError('This email is already in use. Please log in with your password instead.');
        } else if (signInError?.code === 'auth/user-disabled') {
          setError('This account has been disabled. Please contact support.');
        } else if (signInError?.code === 'auth/invalid-credential') {
          setError('The authentication failed. Please try again.');
        } else if (signInError?.code === 'auth/credential-already-in-use') {
          setError('This Google account is already linked to another account. Please use your original sign-in method.');
        } else if (signInError?.message?.includes('already exists')) {
          setError('This account already exists. Please sign in with your email and password instead.');
        } else {
          const message = signInError?.message || 'Google sign-in failed. Please try again.';
          setError(message);
        }
      }
    };

    finishGoogleSignIn();
  }, [response]);

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
                onPress={() => promptAsync()}
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
