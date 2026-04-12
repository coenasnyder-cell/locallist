import { AntDesign } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    sendEmailVerification,
    signInWithCredential,
    updateProfile,
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
import PasswordTextInputRow from '../components/PasswordTextInputRow';
import { app, auth } from '../firebase';
import { profileNeedsServiceArea } from '../hooks/useAccountStatus';
import { getAuthErrorMessage } from '../utils/auth-helpers';
import {
    configureNativeGoogleSignIn,
    getNativeGoogleIdToken,
    getNativeGoogleSignInErrorMessage,
} from '../utils/nativeGoogleAuth';
import { writePersonalUserAndPending } from '../utils/signupProfile';
import { isZipInApprovedServiceArea } from '../utils/zipApproval';

export const unstable_settings = {
  headerShown: false,
};

export const screenOptions = {
  headerShown: false,
};

const ACTION_URL = 'https://app.locallist.biz/auth-action';

type LocationPermissionState = 'not_requested' | 'granted' | 'denied' | 'unavailable';
type LocationReview = {
  zip: string;
  approved: boolean;
};

function extractUsZip(postalCode: string | null | undefined): string {
  const digits = String(postalCode || '').replace(/\D/g, '');
  return digits.length >= 5 ? digits.slice(0, 5) : '';
}

export default function SignUpScreen() {
  const router = useRouter();
  const { returnTo: returnToParam } = useLocalSearchParams();
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
  const [error, setError] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState('');
  const [locationPermission, setLocationPermission] = useState<LocationPermissionState>(
    Platform.OS === 'web' ? 'unavailable' : 'not_requested'
  );
  const [locationReview, setLocationReview] = useState<LocationReview | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [zipCode, setZipCode] = useState('');

  const isNative = Platform.OS !== 'web';

  const routeAfterAuth = () => {
    if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
      router.replace(returnTo as any);
      return;
    }

    router.replace('/(tabs)/index' as any);
  };

  useEffect(() => {
    if (isNative) {
      configureNativeGoogleSignIn();
    }
  }, [isNative]);

  const handleGoogleButtonPress = async () => {
    if (!isNative || googleBusy || submitting) {
      return;
    }

    setError('');
    setGoogleBusy(true);

    try {
      const idToken = await getNativeGoogleIdToken();

      const credential = GoogleAuthProvider.credential(idToken);
      const { user } = await signInWithCredential(auth, credential);

      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const profileData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
      const fallbackName = String(user.displayName || user.email?.split('@')[0] || 'User').trim();
      const needsSetup = !snap.exists() || profileNeedsServiceArea(profileData as any);

      if (needsSetup) {
        await setDoc(
          userRef,
          {
            email: user.email || '',
            accountType: 'personal',
            ...(fallbackName ? { name: fallbackName, displayName: fallbackName } : {}),
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            publicProfileEnabled: false,
          },
          { merge: true }
        );
        router.replace({
          pathname: '/zipCodeverify' as any,
          params: typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : undefined,
        });
        return;
      }

      await setDoc(
        userRef,
        {
          email: user.email || '',
          lastLoginAt: serverTimestamp(),
        },
        { merge: true }
      );

      routeAfterAuth();
    } catch (googleError) {
      console.error('Google sign-up error:', googleError);
      const message = getNativeGoogleSignInErrorMessage(googleError);
      if (message) {
        setError(message);
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const suggestZipFromLocation = async () => {
    if (!isNative) {
      setLocationPermission('unavailable');
      setLocationHint('Location lookup is not available in this browser. Please enter your ZIP manually.');
      return;
    }

    setError('');
    setLocationHint('');
    setLocating(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationPermission('denied');
        setLocationReview(null);
        setLocationHint('Location permission was not granted. You can still enter your ZIP manually.');
        return;
      }

      setLocationPermission('granted');

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const results = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const suggestedZip = extractUsZip(results[0]?.postalCode);

      if (!suggestedZip) {
        setLocationReview(null);
        setLocationHint('We could not read a ZIP from your location. Please enter a 5-digit ZIP manually.');
        return;
      }

      const approved = await isZipInApprovedServiceArea(suggestedZip);
      setLocationReview({ zip: suggestedZip, approved });
      setZipCode(suggestedZip);
      setLocationHint(
        approved
          ? `ZIP ${suggestedZip} was filled from your current area.`
          : `Your location appears to be outside our approved Harrison-area service area. You can still sign up, but your account will be pending admin approval.`
      );
    } catch {
      setLocationReview(null);
      setLocationHint('Could not detect your location. Please enter your ZIP manually.');
    } finally {
      setLocating(false);
    }
  };

  const handleEmailSignup = async () => {
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedZip = zipCode.trim();
    const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim();

    setError('');

    if (!trimmedFirstName) {
      setError('Please enter your first name.');
      return;
    }

    if (!trimmedLastName) {
      setError('Please enter your last name.');
      return;
    }

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/^[0-9]{5}$/.test(trimmedZip)) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }

    setSubmitting(true);

    try {
      const zipApproved = await isZipInApprovedServiceArea(trimmedZip);
      const locationOutsideArea = locationReview?.approved === false;
      const approved = zipApproved && !locationOutsideArea;
      const pendingReason = locationOutsideArea && !zipApproved
        ? 'zip_and_location_outside_area'
        : locationOutsideArea
          ? 'location_outside_area'
          : !zipApproved
            ? 'zip_not_approved'
            : undefined;

      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const { user } = userCredential;
      const db = getFirestore(app);

      await writePersonalUserAndPending(db, user.uid, {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        name: fullName,
        email: user.email,
        zipCode: trimmedZip,
        approved,
        authProvider: 'password',
        pendingReason,
        locationZip: locationReview?.zip ?? null,
        locationPermission,
      });

      try {
        await updateProfile(user, { displayName: fullName });
      } catch (profileError) {
        console.warn('Profile display name update failed after signup:', profileError);
      }

      try {
        await sendEmailVerification(user, { url: ACTION_URL });
      } catch (verificationError) {
        console.warn('Verification email failed after signup:', verificationError);
      }

      routeAfterAuth();
    } catch (signupError) {
      setError(getAuthErrorMessage(signupError, 'signup'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
                Sign up with Google or create an email account for Local List. We&apos;ll use your ZIP to match you with
                listings in Harrison and nearby communities.
              </Text>

              {isNative ? (
                <TouchableOpacity
                  style={[styles.googleButton, (googleBusy || submitting) && styles.googleButtonDisabled]}
                  onPress={handleGoogleButtonPress}
                  disabled={googleBusy || submitting}
                  activeOpacity={0.88}
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
                    Google sign-up runs in the Local List Android or iOS app. You can still create an email account below.
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

              <View style={styles.rowFields}>
                <View style={styles.halfField}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    placeholder="First name"
                    editable={!submitting && !googleBusy}
                  />
                </View>

                <View style={styles.halfField}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    placeholder="Last name"
                    editable={!submitting && !googleBusy}
                  />
                </View>
              </View>

              <Text style={styles.label}>Email</Text>
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

              <Text style={styles.label}>Password</Text>
              <PasswordTextInputRow
                value={password}
                onChangeText={setPassword}
                placeholder="Create password"
                editable={!submitting && !googleBusy}
                textContentType="newPassword"
                containerStyle={styles.passwordRow}
                style={styles.passwordInput}
              />

              <Text style={styles.label}>Confirm Password</Text>
              <PasswordTextInputRow
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                editable={!submitting && !googleBusy}
                textContentType="newPassword"
                containerStyle={styles.passwordRow}
                style={styles.passwordInput}
              />

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerTitle}>About ZIP and location</Text>
                <Text style={styles.disclaimerText}>
                  We collect this information to provide local listings in Harrison and surrounding areas. If you allow
                  location access, we use it one time to suggest your ZIP. If not, you can enter your ZIP manually below.
                </Text>
              </View>

              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={styles.input}
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
                autoComplete="postal-code"
                placeholder="5-digit ZIP"
                maxLength={5}
                editable={!submitting && !googleBusy}
              />

              <TouchableOpacity
                style={[styles.secondaryButton, (submitting || googleBusy || locating) && styles.googleButtonDisabled]}
                onPress={suggestZipFromLocation}
                disabled={submitting || googleBusy || locating}
                activeOpacity={0.88}
              >
                {locating ? (
                  <ActivityIndicator size="small" color="#475569" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Use my location to set ZIP</Text>
                )}
              </TouchableOpacity>

              {locationHint ? <Text style={styles.locationHint}>{locationHint}</Text> : null}

              <View style={styles.pendingBox}>
                <Text style={styles.pendingText}>
                  Accounts outside the approved ZIP list, or detected outside the service area by location, are marked
                  pending and sent to admin for approval.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, (submitting || googleBusy) && styles.googleButtonDisabled]}
                onPress={handleEmailSignup}
                disabled={submitting || googleBusy}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.verificationText}>
                We&apos;ll send a verification email after signup. Please verify your email to access all features and receive updates about your account.
              </Text>

              <View style={styles.bottomLinks}>
                <TouchableOpacity
                  style={styles.inlineLinkRow}
                  onPress={() =>
                    router.push({
                      pathname: '/login' as any,
                      params: typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : undefined,
                    })
                  }
                >
                  <Text style={styles.bottomText}>Already have an account? </Text>
                  <Text style={styles.bottomLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
    maxWidth: 460,
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
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
  errorBox: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
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
    marginBottom: 12,
  },
  passwordRow: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  passwordInput: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  disclaimerBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  disclaimerTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  disclaimerText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 50,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 15,
  },
  locationHint: {
    color: '#0369a1',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  pendingBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  pendingText: {
    color: '#92400e',
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  verificationText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
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
