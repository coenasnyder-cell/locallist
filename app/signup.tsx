import { AntDesign } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Header from '../components/Header';
import { GOOGLE_AUTH_CONFIG } from '../constants/googleAuth';
import { app, auth } from '../firebase';
import { profileNeedsServiceArea } from '../hooks/useAccountStatus';
import { getPostAuthRoute, GOOGLE_SIGN_IN_GENERIC_MESSAGE } from '../utils/auth-helpers';

export const unstable_settings = {
  headerShown: false,
};

export const screenOptions = {
  headerShown: false,
};

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);

  const isNative = Platform.OS !== 'web';

  const [request, , promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_AUTH_CONFIG.clientId,
    androidClientId: GOOGLE_AUTH_CONFIG.androidClientId,
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
  });

  const handleGoogleButtonPress = async () => {
    setError('');
    setGoogleBusy(true);

    try {
      const result = await promptAsync();

      if (result?.type !== 'success') {
        return;
      }

      const idToken = result.authentication?.idToken ?? result.params?.id_token;

      if (!idToken) {
        setError(GOOGLE_SIGN_IN_GENERIC_MESSAGE);
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const { user } = await signInWithCredential(auth, credential);

      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const isNewProfile = !snap.exists();

      if (isNewProfile) {
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
      }

      await setDoc(
        userRef,
        {
          email: user.email || '',
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );

      const latestSnap = await getDoc(userRef);
      const firestoreProfile = latestSnap.exists() ? latestSnap.data() : null;

      if (profileNeedsServiceArea(firestoreProfile as Parameters<typeof profileNeedsServiceArea>[0])) {
        router.replace('/zipCodeverify' as any);
        return;
      }

      router.replace(getPostAuthRoute({ isNewUser: isNewProfile }) as any);
    } catch {
      setError(GOOGLE_SIGN_IN_GENERIC_MESSAGE);
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <>
      <Header />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={Keyboard.dismiss}
          >
            <View style={styles.card}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Harrison&apos;s local marketplace</Text>
              <Text style={styles.lead}>
                Use your Google account. You&apos;ll add your name and ZIP on the next screen so we can match you to
                nearby listings.
              </Text>

              {isNative ? (
                <TouchableOpacity
                  style={[styles.googleButton, (!request || googleBusy) && styles.googleButtonDisabled]}
                  onPress={handleGoogleButtonPress}
                  disabled={!request || googleBusy}
                  activeOpacity={0.88}
                >
                  <View style={styles.googleButtonContent}>
                    <View style={styles.googleIconBadge}>
                      <AntDesign name="google" size={18} color="#4285F4" />
                    </View>
                    <Text style={styles.googleButtonText}>
                      {googleBusy ? 'Signing in…' : 'Continue with Google'}
                    </Text>
                    {googleBusy ? <ActivityIndicator size="small" color="#64748b" /> : null}
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.webNotice}>
                  <Text style={styles.webNoticeText}>
                    Google sign-up runs in the Local List Android or iOS app. Install the app from Play internal testing
                    or TestFlight to create an account.
                  </Text>
                </View>
              )}

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.bottomLinks}>
                <TouchableOpacity style={styles.inlineLinkRow} onPress={() => router.push('/login')}>
                  <Text style={styles.bottomText}>Already have an account? </Text>
                  <Text style={styles.bottomLink}>Sign in</Text>
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
  flex: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 220,
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
    maxWidth: 400,
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
    marginBottom: 12,
    color: '#64748b',
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#334155',
    marginBottom: 22,
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
    marginBottom: 8,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 24,
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
    marginBottom: 8,
  },
  webNoticeText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
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
});
