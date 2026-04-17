import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth, sendEmailVerification } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

const ACTION_URL = 'https://local-list-wski21.firebaseapp.com';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { email: emailParam, isNewUser: isNewUserParam } = useLocalSearchParams();
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
  const isNewUser = Array.isArray(isNewUserParam) ? isNewUserParam[0] : isNewUserParam;
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      const auth = getAuth(app);
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser, { url: ACTION_URL });
        Alert.alert('Success', 'Verification email sent! Check your inbox.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Verify Email',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>Verify Your Email</Text>
            
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>📧</Text>
            </View>

            <Text style={styles.message}>
              We've sent a verification link to:
            </Text>
            
            <Text style={styles.email}>{email}</Text>

            <Text style={styles.instructions}>
              Click the link in the email to verify your account. This helps us keep your account secure.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={handleResendVerification}
              disabled={resending}
            >
              <Text style={styles.buttonText}>
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryLink}
              onPress={() => router.replace(isNewUser === 'true' ? '/(tabs)/profilebutton' : '/(tabs)')}
            >
              <Text style={styles.tertiaryLinkText}>
                {isNewUser === 'true' ? 'Complete Your Profile' : 'Continue Browsing'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
  },
  message: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f0f8fc',
    borderRadius: 8,
    width: '100%',
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#475569',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    borderColor: '#475569',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 15,
  },
  tertiaryLink: {
    padding: 8,
  },
  tertiaryLinkText: {
    color: '#475569',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
