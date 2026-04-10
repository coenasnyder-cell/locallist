import { applyServiceAreaCompletion } from '@/utils/signupProfile';
import { isZipInApprovedServiceArea } from '@/utils/zipApproval';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getFirestore } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { app, auth } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

/**
 * Mandatory gate: name + ZIP for Harrison / local service area.
 * Optional: one-time device location → reverse geocode → suggested ZIP (not stored as coordinates).
 */
export default function ZipCodeVerifyScreen() {
  const router = useRouter();
  const { returnTo: returnToParam } = useLocalSearchParams();
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
  const insets = useSafeAreaInsets();
  const { user, profile, loading } = useAccountStatus();

  const [name, setName] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const locationAvailable = Platform.OS !== 'web';

  const openTerms = () => {
    router.push('/(app)/termsOfUse' as any);
  };

  const openPrivacy = () => {
    router.push('/(app)/privacy' as any);
  };

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    if (!user) return;
    if (profile) {
      const n = String(profile.name || profile.displayName || '').trim();
      const z = String(profile.zipCode || '').trim();
      if (n) setName((prev) => prev.trim() || n);
      if (z) setZip((prev) => prev.trim() || z);
    }
    const display = auth.currentUser?.displayName?.trim();
    if (display) {
      setName((prev) => prev.trim() || display);
    }
  }, [user, profile]);

  const extractUsZip = (postalCode: string | null | undefined): string => {
    const digits = String(postalCode || '').replace(/\D/g, '');
    return digits.length >= 5 ? digits.slice(0, 5) : '';
  };

  const suggestZipFromLocation = async () => {
    if (!locationAvailable) {
      setLocationHint('Location-based ZIP is not available in this browser. Please enter your ZIP manually.');
      return;
    }

    setError('');
    setLocationHint(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationHint('Location permission was not granted. You can still type your ZIP code below.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const results = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });

      const first = results[0];
      const suggested = extractUsZip(first?.postalCode);
      if (!suggested) {
        setLocationHint(
          'We could not read a ZIP from this location. Please enter your 5-digit ZIP manually.'
        );
        return;
      }

      setZip(suggested);
      setLocationHint(
        `We suggested ${suggested} from your area. Confirm or change it if needed — we only use this to match you to Harrison-area listings.`
      );
    } catch {
      setLocationHint('Could not detect location. Please enter your ZIP code manually.');
    } finally {
      setLocating(false);
    }
  };

  const handleContinue = async () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedZip = zip.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[0-9]{5}$/.test(trimmedZip)) {
      setError('Enter a valid 5-digit ZIP code.');
      return;
    }
    if (!acceptTerms) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setError('Not signed in. Please sign in again.');
      return;
    }

    setSubmitting(true);
    try {
      const approved = await isZipInApprovedServiceArea(trimmedZip);
      const isGoogle = firebaseUser.providerData?.some((p) => p.providerId === 'google.com');
      const db = getFirestore(app);

      await applyServiceAreaCompletion(db, firebaseUser.uid, {
        name: trimmedName,
        email: firebaseUser.email,
        zipCode: trimmedZip,
        approved,
        authProvider: isGoogle ? 'google' : 'password',
      });

      if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
        router.replace(returnTo as any);
      } else {
        router.replace('/(tabs)/index' as any);
      }
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : '';
      setError(message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#475569" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top, 24), paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Text style={styles.title}>Finish setting up your account</Text>

        <Text style={styles.lead}>
          After signing in, we need your name, ZIP, and agreement to our policies before you can use Local List. This screen
          stays open until you continue — there is no way to skip.
        </Text>

        <Text style={styles.leadSecondary}>
          Local List is built for <Text style={styles.em}>Harrison, NJ</Text> and nearby communities. Your ZIP helps us show
          relevant listings and confirm you&apos;re in the area we serve.
        </Text>

        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>Why we may ask for location (optional)</Text>
          <Text style={styles.calloutBody}>
            If you tap &quot;Suggest ZIP from my location,&quot; we use your device&apos;s location <Text style={styles.bold}>once</Text> to
            look up a nearby ZIP code and fill the field for you. We do <Text style={styles.bold}>not</Text> save your GPS coordinates
            on your profile — only the ZIP you confirm. You can always type your ZIP manually instead.
          </Text>
        </View>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          editable={!submitting}
        />

        <Text style={styles.label}>ZIP code</Text>
        <TextInput
          style={styles.input}
          placeholder="5-digit ZIP"
          value={zip}
          onChangeText={setZip}
          keyboardType="numeric"
          maxLength={5}
          editable={!submitting}
        />

        {locationAvailable ? (
          <TouchableOpacity
            style={[styles.secondaryButton, (submitting || locating) && styles.buttonDisabled]}
            onPress={suggestZipFromLocation}
            disabled={submitting || locating}
            activeOpacity={0.88}
          >
            {locating ? (
              <ActivityIndicator color="#475569" />
            ) : (
              <Text style={styles.secondaryButtonText}>Suggest ZIP from my location</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {locationHint ? <Text style={styles.hint}>{locationHint}</Text> : null}

        <View style={styles.checkboxRow}>
          <TouchableOpacity
            style={styles.checkboxTapTarget}
            onPress={() => !submitting && setAcceptTerms(!acceptTerms)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptTerms }}
            disabled={submitting}
          >
            <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]} />
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>
            I agree to the{' '}
            <Text style={styles.checkboxLink} onPress={openTerms}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.checkboxLink} onPress={openPrivacy}>
              Privacy Policy
            </Text>
          </Text>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Accounts outside our approved ZIP list may be reviewed before you can list or message. This helps keep the marketplace
            local to Harrison and surrounding towns we support.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Continue to Local List</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: { marginTop: 12, color: '#64748b', fontSize: 15 },
  scroll: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  leadSecondary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 16,
    textAlign: 'center',
  },
  em: { fontWeight: '700', color: '#334155' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  checkboxTapTarget: {
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#475569',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  checkboxLink: {
    color: '#1d4ed8',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  callout: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  calloutBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  bold: { fontWeight: '700', color: '#334155' },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#fff',
    color: '#0f172a',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: { opacity: 0.55 },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#0369a1',
    marginBottom: 14,
  },
  disclaimerBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#92400e',
  },
  error: {
    color: '#b91c1c',
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
