import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { signOutNativeGoogle } from '../utils/nativeGoogleAuth';

export default function AccountRestrictedPage() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await Promise.allSettled([signOut(getAuth(app)), signOutNativeGoogle()]);
      router.replace('./index');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Account Restricted</Text>
          <Text style={styles.body}>
            Your account currently cannot access the app. This can happen if the account is disabled
            or blocked by an administrator.
          </Text>
          <Text style={styles.body}>
            If you think this is a mistake, please contact support from a verified email account.
          </Text>

          <TouchableOpacity
            onPress={handleSignOut}
            style={[styles.button, signingOut && styles.buttonDisabled]}
            disabled={signingOut}
          >
            {signingOut ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Sign Out</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#475569',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
