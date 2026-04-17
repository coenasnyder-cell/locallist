import { Stack, useRouter } from 'expo-router';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import FormInput from '../components/FormInput';
import { app } from '../firebase';

const ACTION_URL = 'https://local-list-wski21.firebaseapp.com';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const normalizeAuthCode = (error: any) => {
    const code = typeof error === 'object' && error ? error.code : undefined;
    if (code) return code as string;
    const message = typeof error === 'object' && error ? String(error.message || '') : '';
    const match = message.match(/auth\/[a-z-]+/i);
    return match ? match[0] : undefined;
  };

  const getAuthErrorMessage = (error: any) => {
    const code = normalizeAuthCode(error);
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account found with this email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Please try again later.';
    }
    return 'Failed to send reset email. Please try again.';
  };

  async function handleResetPassword() {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, email.trim(), { url: ACTION_URL });
      Alert.alert(
        'Password Reset Sent',
        'Check your email for instructions to reset your password. If you don\'t see it, check your spam folder.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reset Password',
          headerShown: true,
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.info}>
              Enter your email address and we'll send you instructions to reset your password.
            </Text>
            
            <FormInput 
              label="Email" 
              value={email} 
              onChangeText={setEmail} 
              required 
              keyboardType="email-address"
            />
            
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleResetPassword} 
              disabled={submitting}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backLink} 
              onPress={() => router.back()}
            >
              <Text style={styles.backLinkText}>Back to Login</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#475569',
  },
  info: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    color: '#555',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#475569',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  backLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  backLinkText: {
    color: '#475569',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
