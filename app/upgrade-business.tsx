import { Stack, useRouter } from 'expo-router';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Header from '../components/Header';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

export default function UpgradeBusinessScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [claimOwnershipRequest, setClaimOwnershipRequest] = useState(false);
  const [businessTier, setBusinessTier] = useState<'free' | 'premium'>('free');
  const [upgradingAccount, setUpgradingAccount] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile) {
      return;
    }

    setBusinessName(profile.businessName || '');
    setBusinessDescription(profile.businessDescription || '');
    setBusinessPhone(profile.businessPhone || '');
    setBusinessWebsite(profile.businessWebsite || '');
    setClaimOwnershipRequest(Boolean((profile as any).claimOwnershipRequest));
    setBusinessTier(profile.businessTier === 'premium' ? 'premium' : 'free');
  }, [profile]);

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/listbutton' as any);
  };

  const handleUpgradeToBusiness = async () => {
    if (!user?.uid) {
      setError('Please sign in to upgrade your account.');
      return;
    }
    if (!businessName.trim()) {
      setError('Business name is required to upgrade.');
      return;
    }

    setError('');
    setUpgradingAccount(true);
    try {
      const db = getFirestore(app);
      await setDoc(
        doc(db, 'users', user.uid),
        {
          accountType: 'business',
          businessTier,
          upgradedAt: serverTimestamp(),
          businessName: businessName.trim(),
          businessDescription: businessDescription.trim() || null,
          businessPhone: businessPhone.trim() || null,
          businessWebsite: businessWebsite.trim() || null,
          claimOwnershipRequest,
        },
        { merge: true }
      );

      Alert.alert('Success', 'Your account has been upgraded to a business account.');
      router.replace('/(tabs)/businesshubbutton' as any);
    } catch (upgradeError) {
      console.error('Error upgrading account:', upgradeError);
      setError('Could not upgrade account. Please try again.');
    } finally {
      setUpgradingAccount(false);
    }
  };

  const handleSignIn = () => {
    router.push({
      pathname: '/signInOrSignUp' as any,
      params: {
        mode: 'login',
        returnTo: '/upgrade-business',
      },
    });
  };

  if (loading || waitingForProfile) {
    return (
      <View style={styles.centeredState}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.stateText}>Loading your account...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Sign in to upgrade</Text>
          <Text style={styles.stateText}>
            Use your normal account sign in first, then complete the business upgrade form.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSignIn}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (profile?.accountType === 'business') {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <View style={styles.centeredState}>
          <Text style={styles.stateTitle}>Business account active</Text>
          <Text style={styles.stateText}>
            This account is already marked as a business account.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/businesshubbutton' as any)}
          >
            <Text style={styles.primaryButtonText}>Open Business Hub</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <Header showTitle={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.formCard}>
            <Text style={styles.title}>Upgrade your account</Text>
            <Text style={styles.description}>
              Keep using your normal sign in. This form adds the business profile details and marks your account as a business account.
            </Text>

            <Text style={styles.claimInstruction}>
              If you want to claim a business that is already listed, please upgrade to a business account first.
            </Text>

            <Text style={styles.label}>Business Name *</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter your business name"
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Claim ownership to a business already listed</Text>
              <Switch
                value={claimOwnershipRequest}
                onValueChange={setClaimOwnershipRequest}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={claimOwnershipRequest ? '#16a34a' : '#f8fafc'}
              />
            </View>

            <Text style={styles.label}>Business Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={businessDescription}
              onChangeText={setBusinessDescription}
              placeholder="Describe your business"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Business Phone</Text>
            <TextInput
              style={styles.input}
              value={businessPhone}
              onChangeText={setBusinessPhone}
              placeholder="Enter business phone number"
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Business Website</Text>
            <TextInput
              style={styles.input}
              value={businessWebsite}
              onChangeText={setBusinessWebsite}
              placeholder="https://www.example.com"
              keyboardType="url"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Business Tier</Text>
            <View style={styles.tierSelector}>
              <TouchableOpacity
                style={[styles.tierOption, businessTier === 'free' && styles.tierOptionActive]}
                onPress={() => setBusinessTier('free')}
              >
                <Text
                  style={[
                    styles.tierOptionText,
                    businessTier === 'free' && styles.tierOptionTextActive,
                  ]}
                >
                  Free
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tierOption, businessTier === 'premium' && styles.tierOptionActive]}
                onPress={() => setBusinessTier('premium')}
              >
                <Text
                  style={[
                    styles.tierOptionText,
                    businessTier === 'premium' && styles.tierOptionTextActive,
                  ]}
                >
                  Premium
                </Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, upgradingAccount && styles.primaryButtonDisabled]}
              onPress={handleUpgradeToBusiness}
              disabled={upgradingAccount}
            >
              <Text style={styles.primaryButtonText}>
                {upgradingAccount ? 'Upgrading...' : 'Complete Upgrade'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
  },
  description: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  claimInstruction: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#92400e',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  switchRow: {
    marginTop: 12,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 108,
    textAlignVertical: 'top',
  },
  tierSelector: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  tierOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tierOptionActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0fdf4',
  },
  tierOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  tierOptionTextActive: {
    color: '#2f855a',
  },
  errorText: {
    marginTop: 16,
    color: '#b91c1c',
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  stateText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    textAlign: 'center',
  },
});