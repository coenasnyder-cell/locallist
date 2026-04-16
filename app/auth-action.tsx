import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { applyActionCode, confirmPasswordReset, getAuth, verifyPasswordResetCode } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

function buildNativeAppUrl(pathname: string, queryParams: Record<string, string>) {
  const normalizedPath = pathname.replace(/^\//, '');
  const search = new URLSearchParams(queryParams).toString();
  return `myapp://${normalizedPath}${search ? `?${search}` : ''}`;
}

export default function AuthActionPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const oobCode = Array.isArray(params.oobCode) ? params.oobCode[0] : params.oobCode;
  const checkout = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  const itemType = Array.isArray(params.itemType) ? params.itemType[0] : params.itemType;
  const listingId = Array.isArray(params.listingId) ? params.listingId[0] : params.listingId;
  const serviceId = Array.isArray(params.serviceId) ? params.serviceId[0] : params.serviceId;
  const featureCanceled = Array.isArray(params.featureCanceled) ? params.featureCanceled[0] : params.featureCanceled;
  const premiumCanceled = Array.isArray(params.premiumCanceled) ? params.premiumCanceled[0] : params.premiumCanceled;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const redirectToNativeApp = (pathname: string, queryParams: Record<string, string>) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return false;
    }

    window.location.replace(buildNativeAppUrl(pathname, queryParams));
    return true;
  };


  useEffect(() => {
    if (checkout === 'featured') {
      if (itemType === 'service') {
        if (redirectToNativeApp('/create-service-listing', {
          ...(serviceId ? { serviceId } : {}),
          posted: '1',
          checkout: 'featured',
        })) {
          return;
        }

        router.replace({
          pathname: '/create-service-listing',
          params: {
            ...(serviceId ? { serviceId } : {}),
            posted: '1',
            checkout: 'featured',
          },
        });
        return;
      }

      if (redirectToNativeApp('/(app)/listing-posted', {
        ...(listingId ? { listingId } : {}),
        checkout: 'featured',
      })) {
        return;
      }

      router.replace({
        pathname: '/(app)/listing-posted',
        params: {
          ...(listingId ? { listingId } : {}),
          checkout: 'featured',
        },
      });
      return;
    }

    if (checkout === 'premium') {
      if (redirectToNativeApp('/(app)/premium-upgrade', { checkout: 'premium' })) {
        return;
      }

      router.replace({
        pathname: '/(app)/premium-upgrade',
        params: {
          checkout: 'premium',
        },
      });
      return;
    }

    if (featureCanceled === '1') {
      if (itemType === 'service') {
        if (redirectToNativeApp('/create-service-listing', {
          ...(serviceId ? { serviceId } : {}),
          posted: '1',
          featureCanceled: '1',
        })) {
          return;
        }

        router.replace({
          pathname: '/create-service-listing',
          params: {
            ...(serviceId ? { serviceId } : {}),
            posted: '1',
            featureCanceled: '1',
          },
        });
        return;
      }

      if (redirectToNativeApp('/(app)/create-listing', {
        featureCanceled: '1',
      })) {
        return;
      }

      router.replace({
        pathname: '/(app)/create-listing',
        params: {
          featureCanceled: '1',
        },
      });
      return;
    }

    if (premiumCanceled === '1') {
      if (redirectToNativeApp('/(app)/premium-upgrade', { premiumCanceled: '1' })) {
        return;
      }

      router.replace({
        pathname: '/(app)/premium-upgrade',
        params: {
          premiumCanceled: '1',
        },
      });
      return;
    }

    if (!mode || !oobCode) {
      setError('Invalid link. Missing required parameters.');
      setLoading(false);
      return;
    }

    handleAction();
  }, [checkout, featureCanceled, itemType, listingId, mode, oobCode, premiumCanceled, router, serviceId]);

  const handleAction = async () => {
    const auth = getAuth(app);

    try {
      if (mode === 'verifyEmail') {
        // Apply the email verification code
        await applyActionCode(auth, oobCode);
        setLoading(false);
        Alert.alert(
          'Email Verified',
          'Your email has been verified successfully! You can now log in.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login')
            }
          ]
        );
      } else if (mode === 'resetPassword') {
        // Verify the password reset code is valid
        await verifyPasswordResetCode(auth, oobCode);
        setLoading(false);
        setShowPasswordForm(true);
      } else {
        setError('Unknown action type.');
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      const errorCode = err.code;
      
      if (errorCode === 'auth/expired-action-code') {
        setError('This link has expired. Please request a new one.');
      } else if (errorCode === 'auth/invalid-action-code') {
        setError('This link is invalid or has already been used.');
      } else if (errorCode === 'auth/user-disabled') {
        setError('This account has been disabled.');
      } else if (errorCode === 'auth/user-not-found') {
        setError('No account found for this email.');
      } else {
        setError('An error occurred. Please try again.');
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    try {
      const auth = getAuth(app);
      await confirmPasswordReset(auth, oobCode, newPassword);
      setShowPasswordForm(false);
      setResetComplete(true);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: mode === 'verifyEmail' ? 'Verify Email' : 'Reset Password',
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
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#475569" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.buttonText}>Go to Home</Text>
              </TouchableOpacity>
            </View>
          )}

          {showPasswordForm && (
            <View style={styles.formContainer}>
              <Text style={styles.title}>Reset Your Password</Text>
              <Text style={styles.subtitle}>Enter your new password below.</Text>
              
              <TextInput
                style={styles.input}
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              
              <TouchableOpacity
                style={styles.button}
                onPress={handlePasswordReset}
              >
                <Text style={styles.buttonText}>Reset Password</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/login')}
              >
                <Text style={styles.secondaryButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {resetComplete && (
            <View style={styles.successContainer}>
              <Text style={styles.successTitle}>Password Updated</Text>
              <Text style={styles.successText}>
                Your password was changed successfully. You can now return to the app and log in.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  router.push('/login');
                }}
              >
                <Text style={styles.buttonText}>Go to Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  router.push('/');
                }}
              >
                <Text style={styles.secondaryButtonText}>Return to Home</Text>
              </TouchableOpacity>
            </View>
          )}
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  formContainer: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  successContainer: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
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
  },
  secondaryButton: {
    borderColor: '#475569',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
