import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { deleteUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { useAuth } from '../hooks/useAuth';

type DigestPreferences = {
  marketplaceWeeklyDigest: boolean;
  eventsDigest: boolean;
  yardSalesDigest: boolean;
  whatsHappeningMonthlyDigest: boolean;
  whatsHappeningWeeklyDigest: boolean;
  jobsWeeklyDigest: boolean;
};

const DEFAULT_DIGEST_PREFERENCES: DigestPreferences = {
  marketplaceWeeklyDigest: false,
  eventsDigest: false,
  yardSalesDigest: false,
  whatsHappeningMonthlyDigest: false,
  whatsHappeningWeeklyDigest: false,
  jobsWeeklyDigest: false,
};

export default function SimpleSettingsPage({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [digestNotification, setDigestNotification] = useState(false);
  const [digestPreferences, setDigestPreferences] = useState<DigestPreferences>(DEFAULT_DIGEST_PREFERENCES);
  const [listingUpNotification, setListingUpNotification] = useState(false);
  const [messageNotification, setMessageNotification] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const fetchProfile = async () => {
        try {
          const db = getFirestore(app);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setName(data.name || user.displayName || '');
            setEmail(data.email || user.email || '');
            setPhone(data.phone || '');
            setZipCode(data.zipCode || '');
            setPhotoUrl(data.profileimage || '');
            setDigestNotification(data.digestNotification ?? false);
            const stored = data.digestPreferences || {};
            setDigestPreferences({
              marketplaceWeeklyDigest: !!stored?.marketplaceWeeklyDigest || !!stored?.marketplace?.weekly,
              eventsDigest: !!stored?.eventsDigest || !!stored?.events?.weekly || !!stored?.events?.monthly,
              yardSalesDigest: !!stored?.yardSalesDigest || !!stored?.yardSale?.weekly || !!stored?.yardSale?.monthly,
              whatsHappeningMonthlyDigest: !!stored?.whatsHappeningMonthlyDigest,
              whatsHappeningWeeklyDigest: !!stored?.whatsHappeningWeeklyDigest,
              jobsWeeklyDigest: !!stored?.jobsWeeklyDigest || !!stored?.jobs?.weekly,
            });
            setListingUpNotification(data.listingUpNotification ?? false);
            setMessageNotification(data.messageNotification ?? false);
          }
        } catch (e) {
          setName(user.displayName || '');
          setEmail(user.email || '');
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const hasDigestEnabled = Object.values(digestPreferences).some(Boolean);
      // Only allow users to update: phone, zipCode, and notification preferences
      // Protected fields (cannot be modified by users): email, name, status, role/admin, bannedZip
      await updateDoc(userRef, {
        phone,
        zipCode,
        digestNotification: hasDigestEnabled || digestNotification,
        digestPreferences,
        listingUpNotification,
        messageNotification,
      });
      Alert.alert('Profile updated', 'Your profile has been updated successfully.', [
        {
          text: 'OK',
          onPress: onClose,
        },
      ]);
    } catch (e) {
      Alert.alert('Error', 'There was a problem updating your profile.');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photo library to upload a profile photo.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
            allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!user?.uid) return;
    
    setUploading(true);
    try {
      const response = await fetch(uri);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const blob = await response.blob();
      
      const storage = getStorage(app);
      const photoRef = ref(storage, `profilePhotos/${user.uid}/picture`);
      
      console.log('Starting upload to:', `profilePhotos/${user.uid}/picture`);
      console.log('Blob size:', blob.size, 'Blob type:', blob.type);
      
      await uploadBytes(photoRef, blob);
      console.log('Upload successful, getting download URL...');
      
      const downloadUrl = await getDownloadURL(photoRef);
      console.log('Download URL obtained:', downloadUrl);
      
      setPhotoUrl(downloadUrl);
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      console.log('Updating Firestore user document with profileimage field');
      await updateDoc(userRef, { profileimage: downloadUrl });
      
      Alert.alert('Success', 'Profile photo updated');
    } catch (e) {
      console.error('Full upload error:', e);
      const errorMessage = e instanceof Error ? e.message : JSON.stringify(e);
      Alert.alert('Error', `Failed to upload photo:\n${errorMessage}`);
    }
    setUploading(false);
  };

  const deleteCollectionDocsForUser = async (collectionName: string, userId: string) => {
    const db = getFirestore(app);
    const snapshot = await getDocs(query(collection(db, collectionName), where('userId', '==', userId)));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  };

  const deleteThreadsForUser = async (userId: string) => {
    const db = getFirestore(app);
    const snapshot = await getDocs(query(collection(db, 'threads'), where('participantIds', 'array-contains', userId)));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  };

  const handleDeleteAccount = () => {
    if (!user?.uid) return;

    Alert.alert(
      'Delete account',
      'This permanently deletes your account and profile data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final confirmation',
              'Are you sure you want to permanently delete your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete permanently',
                  style: 'destructive',
                  onPress: async () => {
                    if (!user) return;

                    setDeletingAccount(true);
                    try {
                      const db = getFirestore(app);

                      // Remove user-linked records first, then the profile document.
                      await Promise.all([
                        deleteCollectionDocsForUser('listings', user.uid),
                        deleteCollectionDocsForUser('services', user.uid),
                        deleteCollectionDocsForUser('jobBoard', user.uid),
                        deleteCollectionDocsForUser('deals', user.uid),
                        deleteCollectionDocsForUser('events', user.uid),
                        deleteCollectionDocsForUser('yardSales', user.uid),
                        deleteCollectionDocsForUser('pets', user.uid),
                        deleteCollectionDocsForUser('featurePurchases', user.uid),
                        deleteCollectionDocsForUser('premiumPurchases', user.uid),
                        deleteCollectionDocsForUser('saveListings', user.uid),
                        deleteThreadsForUser(user.uid),
                        deleteDoc(doc(db, 'businessLocal', user.uid)).catch(() => {}),
                        deleteDoc(doc(db, 'shopLocal', user.uid)).catch(() => {}),
                      ]);

                      await deleteDoc(doc(db, 'users', user.uid));
                      await deleteUser(user);

                      Alert.alert('Account deleted', 'Your account has been permanently deleted.');
                      onClose();
                    } catch (e: any) {
                      const code = e?.code || '';
                      if (code === 'auth/requires-recent-login') {
                        Alert.alert(
                          'Re-authentication required',
                          'For security, please sign out, sign back in, and try deleting your account again.'
                        );
                      } else {
                        Alert.alert('Delete failed', 'Could not delete your account right now. Please try again.');
                      }
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const setDigestToggle = (key: keyof DigestPreferences, value: boolean) => {
    setDigestPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.photoSection}>
        <TouchableOpacity 
          style={styles.photoContainer} 
          onPress={pickImage}
          disabled={uploading}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photoImage} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Feather name="user" size={80} color="#bbb" />
            </View>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          <View style={styles.photoEditButton}>
            <Feather name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Tap to change profile photo</Text>
      </View>
      <Text style={styles.label}>Name</Text>
      <Text style={styles.disabledInput}>{name}</Text>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.disabledInput}>{email}</Text>
      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="Enter phone number"
      />
      <Text style={styles.label}>Zip Code</Text>
      <TextInput
        style={styles.input}
        value={zipCode}
        onChangeText={setZipCode}
        keyboardType="number-pad"
        placeholder="Enter zip code"
      />
      <Text style={styles.sectionTitle}>Notification Preferences</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Messages Notification</Text>
        <Switch
          value={messageNotification}
          onValueChange={setMessageNotification}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Daily Digest</Text>
        <Switch
          value={digestNotification}
          onValueChange={setDigestNotification}
        />
      </View>

      <Text style={styles.sectionTitle}>Digest Subscriptions</Text>
      <Text style={styles.digestHelpText}>Choose exactly which digest streams you want.</Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Marketplace Weekly Digest</Text>
        <Switch
          value={digestPreferences.marketplaceWeeklyDigest}
          onValueChange={(value) => setDigestToggle('marketplaceWeeklyDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Events Digest</Text>
        <Switch
          value={digestPreferences.eventsDigest}
          onValueChange={(value) => setDigestToggle('eventsDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Yard Sales Digest</Text>
        <Switch
          value={digestPreferences.yardSalesDigest}
          onValueChange={(value) => setDigestToggle('yardSalesDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Monthly What's Happening Digest</Text>
        <Switch
          value={digestPreferences.whatsHappeningMonthlyDigest}
          onValueChange={(value) => setDigestToggle('whatsHappeningMonthlyDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Weekly What's Happening Digest</Text>
        <Switch
          value={digestPreferences.whatsHappeningWeeklyDigest}
          onValueChange={(value) => setDigestToggle('whatsHappeningWeeklyDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Jobs Digest Weekly</Text>
        <Switch
          value={digestPreferences.jobsWeeklyDigest}
          onValueChange={(value) => setDigestToggle('jobsWeeklyDigest', value)}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Listing Notifications (Expiration reminders & Updates)</Text>
        <Switch
          value={listingUpNotification}
          onValueChange={setListingUpNotification}
        />
      </View>
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
      <View style={styles.policyInfoBox}>
        <Text style={styles.policyInfoText}>
          Need more details before deleting? Review our account deletion and data handling policies.
        </Text>
        <View style={styles.policyLinkRow}>
          <TouchableOpacity onPress={() => router.push('/(app)/privacy')}>
            <Text style={styles.policyLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
          <Text style={styles.policyLinkSeparator}>|</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/termsOfUse')}>
            <Text style={styles.policyLinkText}>Terms of Use</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.deleteButton, deletingAccount && styles.disabledButton]}
        onPress={handleDeleteAccount}
        disabled={deletingAccount}
      >
        <Text style={styles.deleteButtonText}>{deletingAccount ? 'Deleting account...' : 'Delete account'}</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  tabNavigation: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
    paddingHorizontal: 0,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#2980b9',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabButtonTextActive: {
    color: '#2980b9',
  },
  label: {
    fontSize: 13, // Smaller font size
    color: '#555',
    marginBottom: 2,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8, // Smaller padding
    fontSize: 14, // Smaller font size
    backgroundColor: '#f8f8f8',
    width: '100%',
  },
  disabledInput: {
    fontSize: 14, // Smaller font size
    color: '#888',
    backgroundColor: '#f0f0f0',
    padding: 8, // Smaller padding
    borderRadius: 6,
    width: '100%',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 'bold',
    fontSize: 14, // Smaller font size
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    width: '100%',
  },
  switchLabel: {
    flex: 1,
    fontSize: 12, // Smaller font size
    color: '#333',
    marginRight: 8,
  },
  digestHelpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#2980b9',
    paddingVertical: 12, // Smaller padding
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14, // Smaller font size
  },
  cancelButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 14,
  },
  policyInfoBox: {
    marginTop: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  policyInfoText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  policyLinkRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policyLinkText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  policyLinkSeparator: {
    fontSize: 12,
    color: '#94a3b8',
  },
  deleteButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fff1f2',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  deleteButtonText: {
    color: '#b91c1c',
    fontWeight: 'bold',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  photoContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  photoEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2980b9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  photoHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 4, // Reduced margin
    paddingVertical: 4, // Reduced padding
    backgroundColor: '#fff',
  },
  exitText: {
    fontSize: 16,
    color: '#2980b9',
    fontWeight: 'bold',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14, // Smaller font size for Edit Profile
    fontWeight: 'bold',
    color: '#333',
  },
  settingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  settingLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingLinkText: {
    flex: 1,
  },
  settingLinkTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  settingLinkSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
