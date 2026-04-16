import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import ImageUploader from './ImageUploader';

export default function EditBusinessProfileComp({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, profile, isBusinessAccount, isAdmin } = useAccountStatus();
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'phone' | 'email' | 'website' | 'local_list'>('email');
  const [allowLocalListMessaging, setAllowLocalListMessaging] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessZipcode, setBusinessZipcode] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState('');
  const [businessCoverImage, setBusinessCoverImage] = useState<string[]>([]);
  const [businessPhotoSingle, setBusinessPhotoSingle] = useState<string[]>([]);
  const [businessImages, setBusinessImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);

  const DEFAULT_BUSINESS_CATEGORIES = [
    'Restaurant',
    'Retail',
    'Salon',
    'Mechanic',
    'Contractor',
    'Home Services',
    'Food Truck',
    'Gym',
    'Church',
    'Thrift Store',
  ];

  const canManageBusinessProfile = isBusinessAccount || isAdmin;

  const formatCategoryLabel = (value: string): string => {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const fetchBusinessCategories = async () => {
    try {
      const db = getFirestore(app);
      const categorySet = new Set<string>();

      const hydrateFromSnapshot = (snapshot: Awaited<ReturnType<typeof getDocs>>) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          
          // Extract from field names and values
          Object.entries(data).forEach(([key, value]) => {
            // Prefer non-empty string values, but also use field names
            if (typeof value === 'string' && value.trim().length > 0) {
              const formatted = formatCategoryLabel(value);
              categorySet.add(formatted);
            } else if (Array.isArray(value)) {
              value.forEach((entry) => {
                if (typeof entry === 'string' && entry.trim().length > 0) {
                  const formatted = formatCategoryLabel(entry);
                  categorySet.add(formatted);
                }
              });
            } else if (key && key.trim().length > 0 && !key.startsWith('_')) {
              // Add field name as category if value is empty or not applicable
              const formatted = formatCategoryLabel(key);
              categorySet.add(formatted);
            }
          });
        });
      };

      const primarySnapshot = await getDocs(collection(db, 'businessCategory'));
      hydrateFromSnapshot(primarySnapshot);

      // Fallback to businessCategories collection if empty
      if (categorySet.size === 0) {
        try {
          const fallbackSnapshot = await getDocs(collection(db, 'businessCategories'));
          hydrateFromSnapshot(fallbackSnapshot);
        } catch {
          // Ignore fallback errors
        }
      }

      if (categorySet.size === 0) {
        DEFAULT_BUSINESS_CATEGORIES.forEach((category) => categorySet.add(category));
      }

      const list = Array.from(categorySet).sort((a, b) => a.localeCompare(b));
      setCategories(list);
    } catch (error) {
      console.error('Error fetching business categories:', error);
      setCategories([...DEFAULT_BUSINESS_CATEGORIES]);
    }
  };

  useEffect(() => {
    if (profile) {
      setAccountType(profile.accountType || null);
      setShowUpgradePrompt(!canManageBusinessProfile);
    }

    if (user && user.uid) {
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const db = getFirestore(app);
          const [userDoc, businessLocalDoc] = await Promise.all([
            getDoc(doc(db, 'users', user.uid)),
            getDoc(doc(db, 'businessLocal', user.uid)).catch(() => null),
          ]);

          if (userDoc.exists()) {
            const userData = userDoc.data() || {};
            const businessData = businessLocalDoc && businessLocalDoc.exists() ? (businessLocalDoc.data() || {}) : {};
            const data = { ...userData, ...businessData } as any;

            setAccountType(String(userData.accountType || data.accountType || null));
            setShowUpgradePrompt(!canManageBusinessProfile);

            setBusinessName(data.businessName || '');
            setBusinessDescription(data.businessDescription || '');
            setBusinessPhone(data.businessPhone || '');
            setBusinessWebsite(data.businessWebsite || '');
            const storedPreferred = String(data.preferredContactMethod || '').toLowerCase();
            if (storedPreferred === 'phone' || storedPreferred === 'website' || storedPreferred === 'local_list') {
              setPreferredContactMethod(storedPreferred);
            } else {
              setPreferredContactMethod('email');
            }
            setAllowLocalListMessaging(data.allowLocalListMessaging === true || data.preferredContactMethod === 'local_list');
            setFacebookUrl(data.facebookUrl || '');
            setYoutubeUrl(data.youtubeUrl || '');
            setBusinessAddress(data.businessAddress || data.address || '');
            setBusinessCity(data.businessCity || data.city || '');
            setBusinessState(data.businessState || data.state || '');
            setBusinessZipcode(data.businessZipcode || data.zipcode || '');
            setBusinessCategory(data.businessCategory || '');
            setBusinessHours(data.businessHours || '');
            const coverImage = data.businessCoverImage || '';
            setBusinessCoverImage(coverImage ? [coverImage] : []);
            const profileImage = data.businessPhotoSingle || data.businessPhotosingle || data.businessLogo || '';
            setBusinessPhotoSingle(profileImage ? [profileImage] : []);
            setBusinessImages(Array.isArray(data.businessImages) ? data.businessImages : []);
          } else {
            console.error('User document does not exist');
            Alert.alert('Error', 'User profile not found.');
            onClose();
          }
        } catch (e) {
          console.error('Error loading business profile:', e);
          Alert.alert('Error', 'Failed to load business profile: ' + (e as Error).message);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
      fetchBusinessCategories();
    }
  }, [user, onClose, profile, canManageBusinessProfile, isBusinessAccount]);

  const handleSave = async () => {
    if (!user || !user.uid) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }
    if (!canManageBusinessProfile) {
      Alert.alert('Access Denied', 'Only business accounts can update this information.');
      return;
    }
    if (!businessName.trim()) {
      Alert.alert('Required Field', 'Business name is required.');
      return;
    }
    if (!businessCategory.trim()) {
      Alert.alert('Required Field', 'Business category is required.');
      return;
    }
    if (!businessDescription.trim()) {
      Alert.alert('Required Field', 'Business description is required.');
      return;
    }
    if (!businessCity.trim()) {
      Alert.alert('Required Field', 'City is required.');
      return;
    }
    if (!businessState.trim()) {
      Alert.alert('Required Field', 'State is required.');
      return;
    }
    if (!businessZipcode.trim()) {
      Alert.alert('Required Field', 'Zip code is required.');
      return;
    }
    if (!preferredContactMethod) {
      Alert.alert('Required Field', 'Preferred contact method is required.');
      return;
    }

    const hasAtLeastOneImage = businessCoverImage.length > 0 || businessPhotoSingle.length > 0 || businessImages.length > 0;
    if (!hasAtLeastOneImage) {
      Alert.alert('Required', 'Please upload at least one image (cover, logo, or gallery).');
      return;
    }

    setSaving(true);
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const businessLocalRef = doc(db, 'businessLocal', user.uid);

      const businessData = {
        businessName: businessName.trim(),
        businessCategory: businessCategory.trim() || null,
        businessDescription: businessDescription.trim() || null,
        businessHours: businessHours.trim() || null,
        businessAddress: businessAddress.trim() || null,
        businessCity: businessCity.trim() || null,
        businessState: businessState.trim() || null,
        businessZipcode: businessZipcode.trim() || null,
        preferredContactMethod,
        allowLocalListMessaging,
        businessPhone: businessPhone.trim() || null,
        businessWebsite: businessWebsite.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        businessCoverImage: businessCoverImage.length > 0 ? businessCoverImage[0] : null,
        businessPhotoSingle: businessPhotoSingle.length > 0 ? businessPhotoSingle[0] : null,
        businessLogo: businessPhotoSingle.length > 0 ? businessPhotoSingle[0] : null,
        businessImages,
      };

      await updateDoc(userRef, businessData);
      await setDoc(businessLocalRef, {
        ...businessData,
        userId: user.uid,
        userEmail: user.email || null,
        accountType: 'business',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      Alert.alert('Success', 'Business profile updated successfully.');
      onClose();
    } catch (e) {
      const errorMessage = (e as Error).message || 'Unknown error';
      console.error('Error saving business profile:', e);
      Alert.alert('Error', 'Failed to update business profile: ' + errorMessage);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading business profile...</Text>
      </View>
    );
  }

  if (showUpgradePrompt || !canManageBusinessProfile) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.lockedContainer}>
        <Text style={styles.lockedTitle}>Add Or Update A Business</Text>
        <Text style={styles.lockedText}>
          Build your business profile so local customers can discover, trust, and contact you.
        </Text>

        <View style={styles.benefitsBox}>
          <Text style={styles.benefitsTitle}>Why create a business profile?</Text>
          <Text style={styles.benefitItem}>• Get found by local shoppers in Business Local and Services.</Text>
          <Text style={styles.benefitItem}>• Show your business details, branding, and contact options in one place.</Text>
          <Text style={styles.benefitItem}>• Build trust with a complete profile and verification options.</Text>
        </View>

        <Text style={styles.lockedText}>
          Only business accounts can add or update a business profile. Upgrade now using the button below.
        </Text>

        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => router.push('/(app)/upgrade-business')}
        >
          <Text style={styles.upgradeButtonText}>Upgrade To A Business Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
        >
          <Text style={styles.cancelButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Business Profile</Text>
      </View>

      <Text style={styles.description}>
        Create or update your business profile so people can discover and contact your business.
      </Text>

      <View style={styles.benefitsBox}>
        <Text style={styles.benefitsTitle}>Profile Benefits</Text>
        <Text style={styles.benefitItem}>• Show your business in Local Businesses listings.</Text>
        <Text style={styles.benefitItem}>• Add branding, hours, and contact preferences.</Text>
        <Text style={styles.benefitItem}>• Manage your visibility from the Business Hub.</Text>
      </View>

      {/* 1. Business Name */}
      <Text style={styles.label}>Business Name *</Text>
      <TextInput
        style={styles.input}
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Enter your business name"
      />

      {/* 2. Business Category */}
      <Text style={styles.label}>Business Category *</Text>
      <View style={categoryPickerOpen ? { zIndex: 3000, marginBottom: 230 } : undefined}>
        <DropDownPicker
          open={categoryPickerOpen}
          value={businessCategory || null}
          items={categories.map((c) => ({ label: c, value: c }))}
          setOpen={setCategoryPickerOpen}
          setValue={(callback) => {
            const next = typeof callback === 'function' ? callback(businessCategory || null) : callback;
            setBusinessCategory(typeof next === 'string' ? next : '');
          }}
          placeholder="Select a category..."
          style={{ borderColor: '#ccc', backgroundColor: '#f8f8f8' }}
          dropDownContainerStyle={{ borderColor: '#ccc' }}
          listMode="SCROLLVIEW"
          maxHeight={220}
        />
      </View>

      {/* 3. Business Description */}
      <Text style={styles.label}>Business Description *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={businessDescription}
        onChangeText={setBusinessDescription}
        placeholder="Describe your business"
        multiline
        numberOfLines={4}
      />

      {/* 4. Business Hours */}
      <Text style={styles.label}>Business Hours</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={businessHours}
        onChangeText={setBusinessHours}
        placeholder={'Mon-Fri: 9am-5pm\nSat: 10am-2pm\nSun: Closed'}
        multiline
        numberOfLines={3}
      />

      {/* 5. Location */}
      <Text style={styles.label}>Street Address (Optional)</Text>
      <TextInput
        style={styles.input}
        value={businessAddress}
        onChangeText={setBusinessAddress}
        placeholder="123 Main Street, Suite 100"
      />

      <Text style={styles.label}>City *</Text>
      <TextInput
        style={styles.input}
        value={businessCity}
        onChangeText={setBusinessCity}
        placeholder="Your city"
      />

      <Text style={styles.label}>State *</Text>
      <TextInput
        style={styles.input}
        value={businessState}
        onChangeText={setBusinessState}
        placeholder="State"
      />

      <Text style={styles.label}>Zip Code *</Text>
      <TextInput
        style={styles.input}
        value={businessZipcode}
        onChangeText={setBusinessZipcode}
        placeholder="Zip code"
        keyboardType="number-pad"
      />

      {/* 6. Preferred Contact Method */}
      <Text style={styles.label}>Preferred Contact Method *</Text>
      <View style={contactPickerOpen ? { zIndex: 2000, marginBottom: 200 } : undefined}>
        <DropDownPicker
          open={contactPickerOpen}
          value={preferredContactMethod || null}
          items={[
            { label: 'Phone', value: 'phone' },
            { label: 'Email', value: 'email' },
            { label: 'Website', value: 'website' },
            { label: 'Local List', value: 'local_list' },
          ]}
          setOpen={setContactPickerOpen}
          setValue={(callback) => {
            const next = typeof callback === 'function' ? callback(preferredContactMethod || null) : callback;
            if (next === 'phone' || next === 'email' || next === 'website' || next === 'local_list') {
              setPreferredContactMethod(next);
            }
          }}
          placeholder="Select contact method"
          style={{ borderColor: '#ccc', backgroundColor: '#f8f8f8' }}
          dropDownContainerStyle={{ borderColor: '#ccc' }}
          listMode="SCROLLVIEW"
          maxHeight={200}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>OK to message on Local List</Text>
        <Switch
          value={allowLocalListMessaging}
          onValueChange={setAllowLocalListMessaging}
          trackColor={{ false: '#cbd5e1', true: '#86efac' }}
          thumbColor={allowLocalListMessaging ? '#16a34a' : '#f8fafc'}
        />
      </View>

      {/* 7. Phone (Optional) */}
      <Text style={styles.label}>Phone (Optional)</Text>
      <TextInput
        style={styles.input}
        value={businessPhone}
        onChangeText={setBusinessPhone}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
      />

      {/* 8. Link / Website (Optional) */}
      <Text style={styles.label}>Website Link (Optional)</Text>
      <TextInput
        style={styles.input}
        value={businessWebsite}
        onChangeText={setBusinessWebsite}
        placeholder="https://www.example.com"
        keyboardType="url"
        autoCapitalize="none"
      />

      {/* 9. Facebook URL (Optional) */}
      <Text style={styles.label}>Facebook URL (Optional)</Text>
      <TextInput
        style={styles.input}
        value={facebookUrl}
        onChangeText={setFacebookUrl}
        placeholder="https://facebook.com/your-page"
        autoCapitalize="none"
      />

      {/* 10. YouTube URL (Optional) */}
      <Text style={styles.label}>YouTube URL (Optional)</Text>
      <TextInput
        style={styles.input}
        value={youtubeUrl}
        onChangeText={setYoutubeUrl}
        placeholder="https://youtube.com/@your-channel"
        autoCapitalize="none"
      />

      {/* 11. Cover Image */}
      <Text style={styles.label}>Cover Image</Text>
      <ImageUploader
        images={businessCoverImage}
        onChange={(images: string[]) => setBusinessCoverImage(images.slice(0, 1))}
      />

      {/* 12. Logo Image */}
      <Text style={styles.label}>Logo Image</Text>
      <ImageUploader
        images={businessPhotoSingle}
        onChange={(images: string[]) => setBusinessPhotoSingle(images.slice(0, 1))}
      />

      {/* 13. Gallery */}
      <Text style={styles.label}>Gallery Images</Text>
      <ImageUploader
        images={businessImages}
        onChange={(images: string[]) => setBusinessImages(images)}
      />

      <Text style={styles.imageNote}>* At least one image is required (cover, logo, or gallery)</Text>

      <TouchableOpacity 
        style={[styles.saveButton, (saving || loading) && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={saving || loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Loading...' : saving ? 'Saving...' : 'Save Business Profile'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
  },
  description: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  benefitsBox: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 6,
  },
  benefitItem: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 3,
    lineHeight: 19,
  },
  label: {
    fontSize: 15,
    color: '#555',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 32,
    marginBottom: 24,
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imageNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  switchRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  switchLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#475569',
  },
  lockedContainer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'left',
  },
  lockedText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    textAlign: 'left',
    marginBottom: 14,
  },
  upgradeButton: {
    backgroundColor: '#475569',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
});

