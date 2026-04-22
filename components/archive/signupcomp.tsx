// Archived: legacy signup flow kept for reference; current auth uses SignInOrSignUp.
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, getAuth, sendEmailVerification } from 'firebase/auth';
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { app } from '../../firebase';
import FormInput from '../FormInput';

const SignupComp: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const router = useRouter();
  // Check email verification status
  const checkVerification = async () => {
    setCheckingVerification(true);
    try {
      const auth = getAuth(app);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setIsVerified(auth.currentUser.emailVerified);
        if (auth.currentUser.emailVerified) {
          Alert.alert('Verified', 'Your email is verified! You can now submit listings.');
        } else {
          Alert.alert('Not Verified', 'Your email is still not verified. Please check your inbox and click the verification link.');
        }
      } else {
        Alert.alert('Error', 'No user is currently signed in.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check verification status.');
    } finally {
      setCheckingVerification(false);
    }
  };

  // Check if zip code is approved
  const isZipCodeApproved = async (zip: string): Promise<boolean> => {
    try {
      const db = getFirestore(app);
      const zipCodesRef = collection(db, 'zipCodes');
      const snapshot = await getDocs(zipCodesRef);

      // Check if any document's zip field matches
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.zip === zip || data.zipCode === zip) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking zip code:', error);
      return false;
    }
  };

  async function handleSignup() {
    setSubmitting(true);
    try {
      // Validate zip code
      const approved = await isZipCodeApproved(zipCode);

      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const db = getFirestore(app);

      // Send email verification
      await sendEmailVerification(user);

      // Determine user status based on zip code approval
      const userStatus = approved ? 'approved' : 'pending';

      // Create user document
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        zipCode,
        status: userStatus,
        createdAt: serverTimestamp(),
        isBanned: false,
        isDisabled: false,
        isVerified: false, // Always false until user verifies email
        role: 'user',
        zipApproved: approved,
      });

      // If pending, add to pendingApprovals collection for admin review
      if (!approved) {
        await setDoc(doc(db, 'pendingApprovals', user.uid), {
          userId: user.uid,
          name,
          email,
          zipCode,
          requestedAt: serverTimestamp(),
          status: 'pending', // Can be: pending, approved, rejected
        });

        Alert.alert(
          'Pending Approval',
          `Your account with zip code ${zipCode} is pending admin approval. You'll be notified once approved.\n\nA verification email has been sent to ${email}. Please verify your email before logging in.`
        );
        router.push('./index'); // Redirect to home
      } else {
        Alert.alert('Success', `Account created! A verification email has been sent to ${email}. Please verify your email before logging in.`);
        router.push('./index');
      }
    } catch (error) {
      let message = 'Unknown error';
      if (typeof error === 'object' && error && 'message' in error) message = (error as any).message;
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.arrowButton}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.titleCenterWrapper}>
              <Text style={styles.title}>Sign Up</Text>
            </View>
          </View>
          <FormInput label="Name" value={name} onChangeText={setName} required />
          <FormInput label="Email" value={email} onChangeText={setEmail} required keyboardType="email-address" />
          <FormInput label="Password" value={password} onChangeText={setPassword} required secureTextEntry />
          <FormInput label="Zip Code" value={zipCode} onChangeText={setZipCode} required keyboardType="numeric" />
          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Create Account'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push('./login')}>
            <Text style={styles.loginButtonText}>Already have an account? Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#4caf50', marginTop: 8 }]} onPress={checkVerification} disabled={checkingVerification}>
            <Text style={styles.buttonText}>{checkingVerification ? 'Checking...' : 'Check Verification'}</Text>
          </TouchableOpacity>
          {isVerified && (
            <Text style={{ color: '#4caf50', fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>Your email is verified!</Text>
          )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 50,
    paddingTop: 80,
    backgroundColor: '#fff',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
