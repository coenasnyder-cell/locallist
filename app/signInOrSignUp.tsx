import { useLocalSearchParams, useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, getAuth, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Header from '../components/Header';
import { app } from '../firebase';
import { getAuthErrorMessage, getPostAuthRoute, isPasswordAccountUnverified } from '../utils/auth-helpers';

const ACTION_URL = 'https://app.locallist.biz/auth-action';

export const unstable_settings = {
  headerShown: false,
};

export const screenOptions = {
  headerShown: false,
};

export default function SignInOrSignUp() {
  const router = useRouter();
  const { listingId, mode: modeParam, returnTo: returnToParam, email: emailParam } = useLocalSearchParams();
  const initialMode = (Array.isArray(modeParam) ? modeParam[0] : modeParam) === 'signup' ? 'signup' : 'login';
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;
  const initialEmail = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [error, setError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const mode: 'login' | 'signup' = initialMode;

  const isZipCodeApproved = async (zip: string): Promise<boolean> => {
    try {
      const db = getFirestore(app);
      const collectionsToCheck = ['zipCode', 'zipCodes', 'approved_zips'];
      for (const collectionName of collectionsToCheck) {
        const zipCodesRef = collection(db, collectionName);
        const snapshot = await getDocs(zipCodesRef);
        for (const zipDoc of snapshot.docs) {
          const data = zipDoc.data();
          if (data.zip === zip || data.zipCode === zip) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const routeAfterAuth = (isNewUser: boolean = false) => {
    router.replace(
      getPostAuthRoute({
        isNewUser,
        listingId: listingId ? String(listingId) : undefined,
        returnTo: returnTo ? String(returnTo) : undefined,
      }) as any
    );
  };

  const handleAuth = async () => {
    setError('');
    const auth = getAuth(app);
    // Validation for signup
    if (mode === 'signup') {
      if (!name.trim() || !email.trim() || !password.trim() || !zipCode.trim()) {
        setError('Name, Email, Password, and Zip Code are required');
        return;
      }
      if (accountType === 'business' && !businessName.trim()) {
        setError('Business name is required for business accounts');
        return;
      }
      if (!/^[0-9]{5}$/.test(zipCode.trim())) {
        setError('Please enter a valid 5-digit ZIP code');
        return;
      }
      if (!acceptTerms) {
        setError('Please accept the Terms and Privacy Policy to continue');
        return;
      }
    }
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        const user = auth.currentUser;
        if (!user) {
          setError('Authentication failed');
          return;
        }
        if (isPasswordAccountUnverified(user)) {
          setError('Please verify your email before continuing.');
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
      } else {
        const approved = await isZipCodeApproved(zipCode.trim());
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const db = getFirestore(app);

        await setDoc(doc(db, 'users', user.uid), {
          name: name.trim(),
          email: user.email,
          accountType: accountType,
          businessName: accountType === 'business' ? businessName.trim() : null,
          businessDescription: null,
          businessPhone: null,
          businessWebsite: null,
          subscriptionPlan: 'free',
          subscriptionStatus: 'active',
          subscriptionStartedAt: serverTimestamp(),
          subscriptionExpiresAt: null,
          zipCode: zipCode.trim(),
          zipApproved: approved,
          status: approved ? 'approved' : 'pending',
          isDisabled: false,
          isBanned: false,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          termsAcceptedAt: serverTimestamp(),
          digestNotification: true,
          listingUpNotification: true,
          messageNotification: true,
          phone: '',
        });

        if (!approved) {
          await setDoc(doc(db, 'pendingApprovals', user.uid), {
            userId: user.uid,
            name: name.trim(),
            email: user.email,
            zipCode: zipCode.trim(),
            requestedAt: serverTimestamp(),
            status: 'pending',
          });
        }

        await sendEmailVerification(user, { url: ACTION_URL });
        router.replace({
          pathname: '/verify-email',
          params: { email: user.email, isNewUser: 'true' },
        });
        return;
      }
      routeAfterAuth();
    } catch (e: any) {
      setError(getAuthErrorMessage(e, mode));
    }
  };

  const handleResetPassword = () => {
    router.push('/forgot-password');
  };

  const openTerms = () => {
    router.push('/(app)/termsOfUse');
  };

  const openPrivacy = () => {
    router.push('/(app)/privacy');
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
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
        {mode === 'signup' && (
          <View style={styles.accountTypeContainer}>
            <Text style={styles.accountTypeLabel}>Account Type</Text>
            <View style={styles.accountTypeButtonsRow}>
              <TouchableOpacity 
                style={[styles.accountTypeButton, accountType === 'personal' && styles.accountTypeButtonActive]}
                onPress={() => setAccountType('personal')}
              >
                <Text style={[styles.accountTypeButtonText, accountType === 'personal' && styles.accountTypeButtonTextActive]}>
                  Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.accountTypeButton, accountType === 'business' && styles.accountTypeButtonActive]}
                onPress={() => setAccountType('business')}
              >
                <Text style={[styles.accountTypeButtonText, accountType === 'business' && styles.accountTypeButtonTextActive]}>
                  Business
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        {mode === 'signup' && accountType === 'business' && (
          <TextInput
            style={styles.input}
            placeholder="Business Name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {mode === 'signup' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Zip Code"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
            />
            <Text style={styles.disclosureText}>
              We use your ZIP code to verify local eligibility and show nearby listings.
            </Text>
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxTapTarget}
                onPress={() => setAcceptTerms(!acceptTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptTerms }}
              >
                <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]} />
              </TouchableOpacity>
              <Text style={styles.checkboxLabel}>
                I agree to the <Text style={styles.checkboxLink} onPress={openTerms}>Terms</Text> and <Text style={styles.checkboxLink} onPress={openPrivacy}>Privacy Policy</Text>
              </Text>
            </View>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {mode === 'login' && error ? (
          <TouchableOpacity style={styles.resetLinkInline} onPress={handleResetPassword}>
            <Text style={styles.resetLinkText}>Forgot Your Password</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.authActionRow}>
          <TouchableOpacity style={[styles.button, styles.primaryActionButton]} onPress={handleAuth}>
            <Text style={styles.buttonText}>{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelActionButton} onPress={handleCancel}>
            <Text style={styles.cancelActionButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        {mode === 'login' && (
          <TouchableOpacity style={styles.resetLinkBottom} onPress={handleResetPassword}>
            <Text style={styles.resetLinkText}>Forgot Your Password</Text>
          </TouchableOpacity>
        )}
        {mode === 'login' && (
          <TouchableOpacity style={styles.troubleLink} onPress={() => router.push('/(app)/contactus')}>
            <Text style={styles.troubleLinkText}>Trouble logging in? Contact Us</Text>
          </TouchableOpacity>
        )}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    height: 32,
  },
  arrowButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
    zIndex: 2,
  },
  titleCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  input: { width: '100%', maxWidth: 320, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16 },
button: { backgroundColor: '#475569', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, marginBottom: 16 },
secondaryButton: { borderColor: '#475569', borderWidth: 1, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, marginBottom: 16 },
secondaryButtonText: { color: '#475569', fontWeight: 'bold', fontSize: 15, textAlign: 'center' },
buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
authActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 16 },
primaryActionButton: { flex: 1, marginBottom: 0, paddingHorizontal: 16 },
cancelActionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#475569', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
cancelActionButtonText: { color: '#475569', fontSize: 16, fontWeight: '600' },
resetLinkInline: { marginBottom: 12, alignItems: 'center' },
resetLinkBottom: { marginBottom: 12, alignItems: 'center' },
resetLinkText: { color: '#475569', textDecorationLine: 'underline', fontSize: 14 },
troubleLink: { marginBottom: 12, alignItems: 'center' },
troubleLinkText: { color: '#475569', textDecorationLine: 'underline', fontSize: 14, fontWeight: '600' },
link: { color: '#475569', textDecorationLine: 'underline', marginBottom: 16, fontSize: 16, textAlign: 'center' },
backLink: { color: '#888', textDecorationLine: 'underline', fontSize: 15 },
error: { color: 'red', marginBottom: 12, textAlign: 'center' },
disclosureText: { color: '#555', fontSize: 12, marginBottom: 12, maxWidth: 320 },
checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, maxWidth: 320 },
checkboxTapTarget: { marginRight: 8, paddingVertical: 2 },
checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#475569', marginRight: 8, borderRadius: 3, backgroundColor: '#fff' },
checkboxChecked: { backgroundColor: '#475569' },
checkboxLabel: { color: '#333', fontSize: 14, flex: 1 },
checkboxLink: { color: '#475569', textDecorationLine: 'underline', fontWeight: '600' },
  accountTypeContainer: { marginBottom: 20 },
  accountTypeLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  accountTypeButtonsRow: { flexDirection: 'row', gap: 12 },
  accountTypeButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#fff', alignItems: 'center' },
  accountTypeButtonActive: { borderColor: '#475569', backgroundColor: '#e3f2fd' },
    accountTypeButtonText: { fontSize: 14, fontWeight: '600', color: '#666' },
    accountTypeButtonTextActive: { color: '#475569' },
  });
