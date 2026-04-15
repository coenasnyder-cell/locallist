import { useAccountStatus } from '@/hooks/useAccountStatus';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

type BusinessSettingsData = {
  businessName?: string;
  businessCategory?: string;
  businessPhone?: string;
  businessWebsite?: string;
  businessDescription?: string;
  businessAddress?: string;
  businessHours?: string;
  businessLogo?: string;
  displayName?: string;
  profileimage?: string;
};

export default function BusinessSettingsScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && profile?.accountType === 'business';
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settings, setSettings] = useState<BusinessSettingsData | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setSettingsLoading(false);
        return;
      }

      try {
        setSettingsLoading(true);
        const db = getFirestore(app);

        const [userDoc, businessLocalDoc] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'businessLocal', user.uid)),
        ]);

        const userData = userDoc.exists() ? (userDoc.data() as BusinessSettingsData) : {};
        const businessData = businessLocalDoc.exists() ? (businessLocalDoc.data() as BusinessSettingsData) : {};

        setSettings({
          ...userData,
          ...businessData,
        });
      } catch (error) {
        setSettings({});
      } finally {
        setSettingsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const displayName = useMemo(() => {
    return settings?.displayName || user?.displayName || user?.email || 'Business User';
  }, [settings?.displayName, user?.displayName, user?.email]);

  const showLoading = loading || waitingForProfile || settingsLoading;

  const updatePersonalImage = async () => {
    if (!user?.uid || uploadingImage) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingImage(true);

      const imageUri = result.assets[0].uri;
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const storage = getStorage(app);
      const photoRef = ref(storage, `profilePhotos/${user.uid}/picture`);
      await uploadBytes(photoRef, blob);
      const downloadUrl = await getDownloadURL(photoRef);

      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', user.uid), { profileimage: downloadUrl });

      setSettings((prev) => ({ ...(prev || {}), profileimage: downloadUrl }));
      Alert.alert('Success', 'Your personal image was updated.');
    } catch (error) {
      Alert.alert('Error', 'Could not update your personal image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Business Settings</Text>
          <Text style={styles.heroSubtitle}>
            Review your business profile details, update your information, and open your public business profile from one page.
          </Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Back to Business Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#475569" />
            <Text style={styles.loadingText}>Loading your business settings...</Text>
          </View>
        ) : !hasBusinessAccess ? (
          <View style={styles.panel}>
            <Text style={styles.helperText}>Business settings are available for business accounts only.</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
                <Text style={styles.backBtnText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryAvatar}>
                {settings?.profileimage ? (
                  <Image source={{ uri: settings.profileimage }} style={styles.summaryAvatarImage} />
                ) : (
                  <Text style={styles.summaryAvatarText}>{String(displayName).trim().charAt(0).toUpperCase() || 'B'}</Text>
                )}
              </View>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryName}>{displayName}</Text>
                <Text style={styles.summaryEmail}>{user?.email || '-'}</Text>
                <TouchableOpacity
                  style={[styles.imageBtn, uploadingImage ? styles.imageBtnDisabled : null]}
                  onPress={updatePersonalImage}
                  disabled={uploadingImage}
                >
                  <Text style={styles.imageBtnText}>{uploadingImage ? 'Uploading...' : 'Update Personal Image'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Business Profile</Text>
                <View style={styles.ctaRow}>
                  <TouchableOpacity style={styles.btn} onPress={() => router.push('/businesslocal')}>
                    <Text style={styles.btnText}>Edit Business Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.secondaryBtn]}
                    onPress={() => router.push({ pathname: '/businessprofile', params: { id: user?.uid || '' } })}
                  >
                    <Text style={styles.btnText}>View Public Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <Field label="Business Name" value={settings?.businessName || settings?.displayName || 'Business account'} />
                <Field label="Category" value={settings?.businessCategory || '-'} />
                <Field label="Phone" value={settings?.businessPhone || '-'} />
                <Field label="Website" value={settings?.businessWebsite || '-'} />
                <Field full label="Description" value={settings?.businessDescription || '-'} />
                <Field full label="Address" value={settings?.businessAddress || '-'} />
                <Field full label="Hours" value={settings?.businessHours || '-'} />

                {settings?.businessLogo ? (
                  <View style={[styles.field, styles.full]}>
                    <Text style={styles.fieldLabel}>Logo</Text>
                    <Image source={{ uri: settings.businessLogo }} style={styles.businessLogo} resizeMode="contain" />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.helperText}>
                Use Edit Business Profile to change business-facing information like description, contact details, hours, logo, and address.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <View style={[styles.field, full ? styles.full : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 12,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
  },
  heroActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  backBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingWrap: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  summary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  summaryAvatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAvatarImage: {
    width: '100%',
    height: '100%',
  },
  summaryAvatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryName: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryEmail: {
    color: '#64748b',
    fontSize: 14,
  },
  imageBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderRadius: 7,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  imageBtnDisabled: {
    opacity: 0.65,
  },
  imageBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  panelHeader: {
    marginBottom: 12,
  },
  panelTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  btn: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryBtn: {
    backgroundColor: '#0f766e',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  field: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  full: {
    width: '100%',
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  fieldValue: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 21,
  },
  businessLogo: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe3eb',
    backgroundColor: '#fff',
  },
  helperText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
  },
});
