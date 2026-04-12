import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import ImageUploader from './ImageUploader';

export default function EditBusinessProfileComp({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, profile, isBusinessAccount, isAdmin } = useAccountStatus();
  const [businessName, setBusinessName] = useState('');
  const [listingType, setListingType] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessWebsite, setBusinessWebsite] = useState('');
  const [preferredContactMethod, setPreferredContactMethod] = useState<'email' | 'phone' | 'local_list'>('email');
  const [allowLocalListMessaging, setAllowLocalListMessaging] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCity, setBusinessCity] = useState('');
  const [businessState, setBusinessState] = useState('');
  const [businessZipcode, setBusinessZipcode] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState('');
  const [businessLogo, setBusinessLogo] = useState<string[]>([]);
  const [businessImages, setBusinessImages] = useState<string[]>([]);
  const [businessTier, setBusinessTier] = useState('free');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

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
            setListingType(data.listingType || '');
            setBusinessDescription(data.businessDescription || '');
            setBusinessEmail(data.businessEmail || user.email || '');
            setBusinessPhone(data.businessPhone || '');
            setBusinessWebsite(data.businessWebsite || '');
            setPreferredContactMethod((data.preferredContactMethod as 'email' | 'phone' | 'local_list') || 'email');
            setAllowLocalListMessaging(data.allowLocalListMessaging === true || data.preferredContactMethod === 'local_list');
            setFacebookUrl(data.facebookUrl || '');
            setInstagramUrl(data.instagramUrl || '');
            setTiktokUrl(data.tiktokUrl || '');
            setYoutubeUrl(data.youtubeUrl || '');
            setBusinessAddress(data.businessAddress || data.address || '');
            setBusinessCity(data.businessCity || data.city || '');
            setBusinessState(data.businessState || data.state || '');
            setBusinessZipcode(data.businessZipcode || data.zipcode || '');
            setBusinessCategory(data.businessCategory || '');
            setBusinessHours(data.businessHours || '');
            setBusinessLogo(data.businessLogo ? [data.businessLogo] : []);
            setBusinessImages(Array.isArray(data.businessImages) ? data.businessImages : []);
            setBusinessTier(data.businessTier || 'free');
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
    if (!listingType) {
      Alert.alert('Required Field', 'Listing type is required.');
      return;
    }
    if (!businessDescription.trim()) {
      Alert.alert('Required Field', 'Business description is required.');
      return;
    }
    if (!businessCategory.trim()) {
      Alert.alert('Required Field', 'Business category is required.');
      return;
    }
    if (!preferredContactMethod) {
      Alert.alert('Required Field', 'Preferred contact method is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (businessEmail.trim() && !emailRegex.test(businessEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid business contact email.');
      return;
    }

    if (preferredContactMethod === 'phone' && !businessPhone.trim()) {
      Alert.alert('Missing Phone', 'Add a phone number if you want users to contact you by phone.');
      return;
    }

    if (preferredContactMethod === 'email' && !businessEmail.trim()) {
      Alert.alert('Missing Email', 'Add an email if you want users to contact you by email.');
      return;
    }

    setSaving(true);
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      const businessLocalRef = doc(db, 'businessLocal', user.uid);

      const businessData = {
        businessName: businessName.trim(),
        listingType: listingType || null,
        businessDescription: businessDescription.trim() || null,
        businessEmail: businessEmail.trim() || null,
        businessPhone: businessPhone.trim() || null,
        businessWebsite: businessWebsite.trim() || null,
        preferredContactMethod,
        allowLocalListMessaging: allowLocalListMessaging || preferredContactMethod === 'local_list',
        facebookUrl: facebookUrl.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        tiktokUrl: tiktokUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        businessAddress: businessAddress.trim() || null,
        businessCity: businessCity.trim() || null,
        businessState: businessState.trim() || null,
        businessZipcode: businessZipcode.trim() || null,
        businessCategory: businessCategory.trim() || null,
        businessHours: businessHours.trim() || null,
        businessLogo: businessLogo.length > 0 ? businessLogo[0] : null,
        businessImages,
      };

      await updateDoc(userRef, businessData);
      await setDoc(businessLocalRef, {
        ...businessData,
        userId: user.uid,
        userEmail: user.email || null,
        accountType: 'business',
        businessTier: businessTier === 'premium' ? 'premium' : 'free',
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
          onPress={() => router.push('/upgrade-business')}
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

      <Text style={styles.label}>Business Name *</Text>
      <TextInput
        style={styles.input}
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Enter your business name"
      />

      <Text style={styles.label}>Listing Type *</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={listingType}
          onValueChange={(value) => setListingType(value)}
          style={styles.picker}
        >
          <Picker.Item label="Select where to display..." value="" />
          <Picker.Item label="Shop Local Only - Retail & physical products" value="shopLocal" />
          <Picker.Item label="Services Only - Professional services" value="services" />
          <Picker.Item label="Both - Shop Local & Services" value="both" />
        </Picker>
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

      <Text style={styles.label}>Business Contact Email</Text>
      <TextInput
        style={styles.input}
        value={businessEmail}
        onChangeText={setBusinessEmail}
        placeholder="your-business@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Business Phone</Text>
      <TextInput
        style={styles.input}
        value={businessPhone}
        onChangeText={setBusinessPhone}
        placeholder="(555) 123-4567"
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

      <Text style={styles.label}>Preferred Contact Method *</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={preferredContactMethod}
          onValueChange={(value) => setPreferredContactMethod(value as 'email' | 'phone' | 'local_list')}
          style={styles.picker}
        >
          <Picker.Item label="Email" value="email" />
          <Picker.Item label="Phone" value="phone" />
          <Picker.Item label="Local List Message" value="local_list" />
        </Picker>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Allow Local List Messaging</Text>
        <Switch
          value={allowLocalListMessaging}
          onValueChange={setAllowLocalListMessaging}
          trackColor={{ false: '#cbd5e1', true: '#86efac' }}
          thumbColor={allowLocalListMessaging ? '#16a34a' : '#f8fafc'}
        />
      </View>

      <Text style={styles.label}>Facebook URL</Text>
      <TextInput
        style={styles.input}
        value={facebookUrl}
        onChangeText={setFacebookUrl}
        placeholder="https://facebook.com/your-page"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Instagram URL</Text>
      <TextInput
        style={styles.input}
        value={instagramUrl}
        onChangeText={setInstagramUrl}
        placeholder="https://instagram.com/your-handle"
        autoCapitalize="none"
      />

      <Text style={styles.label}>TikTok URL</Text>
      <TextInput
        style={styles.input}
        value={tiktokUrl}
        onChangeText={setTiktokUrl}
        placeholder="https://tiktok.com/@your-handle"
        autoCapitalize="none"
      />

      <Text style={styles.label}>YouTube URL</Text>
      <TextInput
        style={styles.input}
        value={youtubeUrl}
        onChangeText={setYoutubeUrl}
        placeholder="https://youtube.com/@your-channel"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Business Address</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={businessAddress}
        onChangeText={setBusinessAddress}
        placeholder={'123 Main Street, Suite 100\nYour City, State 12345'}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={businessCity}
        onChangeText={setBusinessCity}
        placeholder="Your city"
      />

      <Text style={styles.label}>State</Text>
      <TextInput
        style={styles.input}
        value={businessState}
        onChangeText={setBusinessState}
        placeholder="State"
      />

      <Text style={styles.label}>Zip Code</Text>
      <TextInput
        style={styles.input}
        value={businessZipcode}
        onChangeText={setBusinessZipcode}
        placeholder="Zip code"
      />

      <Text style={styles.label}>Business Category</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={businessCategory}
          onValueChange={(value) => setBusinessCategory(value)}
          style={styles.picker}
        >
          <Picker.Item label="Select a category..." value="" />
          {categories.map((category) => (
            <Picker.Item key={category} label={category} value={category} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Business Hours</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={businessHours}
        onChangeText={setBusinessHours}
        placeholder={'Mon-Fri: 9am-5pm\nSat: 10am-2pm\nSun: Closed'}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Business Logo</Text>
      <ImageUploader
        images={businessLogo}
        onChange={(images: string[]) => setBusinessLogo(images)}
      />

      <Text style={styles.label}>Business Images</Text>
      <ImageUploader
        images={businessImages}
        onChange={(images: string[]) => setBusinessImages(images)}
      />

      <Text style={styles.label}>Business Tier</Text>
      <View style={styles.tierDisplay}>
        <Text style={styles.tierText}>{businessTier.charAt(0).toUpperCase() + businessTier.slice(1)}</Text>
        <Text style={styles.tierNote}>(Managed by admin)</Text>
      </View>

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
  tierDisplay: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  tierText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  tierNote: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
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

