import FormInput from '@/components/FormInput';
import ImageUploader from '@/components/ImageUploader';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

const CATEGORIES = [
  { id: 'home-repair',    label: 'Home Repair' },
  { id: 'lawn-garden',    label: 'Lawn & Garden' },
  { id: 'cleaning',       label: 'Cleaning' },
  { id: 'plumbing',       label: 'Plumbing' },
  { id: 'electrical',     label: 'Electrical' },
  { id: 'hvac',           label: 'HVAC' },
  { id: 'painting',       label: 'Painting' },
  { id: 'carpentry',      label: 'Carpentry' },
  { id: 'moving',         label: 'Moving & Hauling' },
  { id: 'childcare',      label: 'Childcare' },
  { id: 'tutoring',       label: 'Tutoring' },
  { id: 'pet-care',       label: 'Pet Care' },
  { id: 'beauty',         label: 'Beauty & Wellness' },
  { id: 'auto',           label: 'Auto Services' },
  { id: 'photography',    label: 'Photography' },
  { id: 'tech',           label: 'Tech Support' },
  { id: 'event-planning', label: 'Event Planning' },
  { id: 'construction',   label: 'Construction' },
  { id: 'food-catering',  label: 'Food & Catering' },
  { id: 'fitness',        label: 'Fitness & Training' },
  { id: 'other',          label: 'Other' },
];

const CATEGORY_OPTIONS = CATEGORIES.map((c) => c.label);

type ContactMethod = 'phone' | 'email' | 'website' | 'local_list';

const CONTACT_METHOD_OPTIONS = ['Phone', 'Email', 'Website', 'Local List'];
const CONTACT_LABEL_TO_VALUE: Record<string, ContactMethod> = {
  'Phone': 'phone',
  'Email': 'email',
  'Website': 'website',
  'Local List': 'local_list',
};
const CONTACT_VALUE_TO_LABEL: Record<ContactMethod, string> = {
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  local_list: 'Local List',
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export default function CreateServiceListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    checkout?: string | string[];
    featureCanceled?: string | string[];
    posted?: string | string[];
  }>();
  const { user, profile, loading, canPostListings, postingBlockedReason } = useAccountStatus();
  const hasPostingAccess = !!user;

  const [serviceName, setServiceName] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [serviceMotto, setServiceMotto] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [preferredContact, setPreferredContact] = useState<ContactMethod>('email');
  const [allowMessaging, setAllowMessaging] = useState(true);
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [coverImage, setCoverImage] = useState<string[]>([]);
  const [logoImage, setLogoImage] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [featureRequested, setFeatureRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  const checkoutParam = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  const featureCanceledParam = Array.isArray(params.featureCanceled) ? params.featureCanceled[0] : params.featureCanceled;
  const postedParam = Array.isArray(params.posted) ? params.posted[0] : params.posted;

  React.useEffect(() => {
    if (postedParam === '1') {
      setPosted(true);
    }
  }, [postedParam]);

  React.useEffect(() => {
    if (checkoutParam === 'featured') {
      Alert.alert(
        'Featured Checkout Started',
        'Your service was submitted and the featured payment was completed successfully.'
      );
    }
  }, [checkoutParam]);

  React.useEffect(() => {
    if (featureCanceledParam === '1') {
      Alert.alert(
        'Payment Canceled',
        'Your service was submitted, but featured checkout was canceled. It will remain a standard service listing.'
      );
    }
  }, [featureCanceledParam]);

  if (loading) return null;

  if (!hasPostingAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>List a Service</Text>
            <Text style={styles.heroSubtitle}>Please sign in to create a service listing.</Text>
          </View>
          <View style={styles.panel}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.replace('/login' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.cancelText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/browsebutton' as any);
  };

  const resolvedCategory = CATEGORIES.find(
    (c) => c.label === categoryLabel
  );

  const preferredContactValue =
    preferredContact === 'phone'
      ? contactPhone.trim()
      : preferredContact === 'website'
        ? contactWebsite.trim()
        : preferredContact === 'local_list'
          ? 'Local List'
          : '';

  const launchFeaturedCheckout = async (serviceId: string, serviceTitle: string) => {
    const functions = getFunctions(app);
    const createFeaturePaymentSheet = httpsCallable(functions, 'createFeaturePaymentSheet');
    const finalizeFeaturePurchase = httpsCallable(functions, 'finalizeFeaturePurchase');

    const result = await withTimeout(
      createFeaturePaymentSheet({
        itemType: 'service',
        serviceId,
        serviceTitle,
      }),
      20000,
      'Timed out while creating feature payment sheet.'
    );

    const data = result.data as {
      paymentIntentClientSecret?: string;
      customerEphemeralKeySecret?: string;
      customerId?: string;
      purchaseId?: string;
      paymentIntentId?: string;
    };

    if (!data?.paymentIntentClientSecret) {
      throw new Error('Missing PaymentIntent client secret');
    }

    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: 'Local List',
      paymentIntentClientSecret: data.paymentIntentClientSecret,
      customerId: data.customerId,
      customerEphemeralKeySecret: data.customerEphemeralKeySecret,
    });

    if (initError) {
      throw new Error(initError.message || 'Could not initialize payment sheet.');
    }

    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        router.replace({
          pathname: '/create-service-listing' as any,
          params: {
            posted: '1',
            featureCanceled: '1',
          },
        });
        return;
      }
      throw new Error(presentError.message || 'Payment failed.');
    }

    await withTimeout(
      finalizeFeaturePurchase({
        itemType: 'service',
        serviceId,
        serviceTitle,
        purchaseId: data.purchaseId || null,
        paymentIntentId: data.paymentIntentId || null,
        paymentIntentClientSecret: data.paymentIntentClientSecret,
      }),
      20000,
      'Timed out while finalizing featured purchase.'
    );

    router.replace({
      pathname: '/create-service-listing' as any,
      params: {
        posted: '1',
        checkout: 'featured',
      },
    });
  };

  const handleSubmit = async () => {
    if (!serviceName.trim()) {
      Alert.alert('Missing Field', 'Please enter a service business name.');
      return;
    }
    if (!resolvedCategory) {
      Alert.alert('Missing Field', 'Please select a service category.');
      return;
    }
    if (!serviceDescription.trim()) {
      Alert.alert('Missing Field', 'Please enter a service description.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Missing Field', 'City is required.');
      return;
    }
    if (!state.trim()) {
      Alert.alert('Missing Field', 'State is required.');
      return;
    }
    if (!zipCode.trim()) {
      Alert.alert('Missing Field', 'Zip code is required.');
      return;
    }
    if (!preferredContact) {
      Alert.alert('Missing Field', 'Please select a preferred contact method.');
      return;
    }

    const hasAtLeastOneImage = coverImage.length > 0 || logoImage.length > 0 || galleryImages.length > 0;
    if (!hasAtLeastOneImage) {
      Alert.alert('Missing Images', 'Please upload at least one image (cover, logo, or gallery).');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to post a service.');
      return;
    }
    if (!canPostListings) {
      Alert.alert('Account Action Required', postingBlockedReason || 'Your account is not eligible to post right now.');
      return;
    }

    try {
      setSubmitting(true);
      const db = getFirestore(app);
      const serviceImage = coverImage[0] || logoImage[0] || galleryImages[0] || '';

      const serviceDocRef = await addDoc(collection(db, 'services'), {
        userId: user.uid,
        serviceName: serviceName.trim(),
        category: resolvedCategory.label,
        categoryId: resolvedCategory.id,
        serviceMotto: serviceMotto.trim() || null,
        serviceDescription: serviceDescription.trim(),
        businessHours: businessHours.trim() || null,
        serviceImage,
        streetAddress: streetAddress.trim() || null,
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        preferredContactMethod: preferredContact,
        preferredContactValue,
        allowMessaging,
        contactPhone: contactPhone.trim() || null,
        contactWebsite: contactWebsite.trim() || null,
        facebookUrl: facebookUrl.trim() || null,
        youtubeUrl: youtubeUrl.trim() || null,
        coverImage: coverImage.length > 0 ? coverImage[0] : null,
        logoImage: logoImage.length > 0 ? logoImage[0] : null,
        galleryImages,
        isActive: true,
        isApproved: false,
        approvalStatus: 'pending',
        isFeatured: false,
        featureRequested,
        featureDurationDays: featureRequested ? 30 : null,
        featurePrice: featureRequested ? 10 : null,
        featurePaymentStatus: featureRequested ? 'pending' : 'not_requested',
        viewCount: 0,
        createdAt: serverTimestamp(),
      });

      if (featureRequested) {
        try {
          await launchFeaturedCheckout(serviceDocRef.id, serviceName.trim());
        } catch (checkoutError) {
          Alert.alert(
            'Checkout Not Started',
            'Your service was submitted, but we could not open Stripe checkout right now. Please try again later.'
          );
          setPosted(true);
        }
      } else {
        setPosted(true);
      }
    } catch {
      Alert.alert('Error', 'Could not post service listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setServiceName('');
    setCategoryLabel('');
    setServiceMotto('');
    setServiceDescription('');
    setBusinessHours('');
    setStreetAddress('');
    setCity('');
    setState('');
    setZipCode('');
    setPreferredContact('email');
    setAllowMessaging(true);
    setContactPhone('');
    setContactWebsite('');
    setFacebookUrl('');
    setYoutubeUrl('');
    setCoverImage([]);
    setLogoImage([]);
    setGalleryImages([]);
    setFeatureRequested(false);
    setPosted(false);
  };

  if (posted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrapper}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Service Posted!</Text>
            <Text style={styles.successMessage}>
              Your service listing has been submitted for review. It will be visible once approved.
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successPrimary}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.successPrimaryText}>Back To Services</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={resetForm}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Post Another Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>List a Service</Text>
          <Text style={styles.heroSubtitle}>Offer your skills to the local community</Text>
        </View>

        <View style={styles.panel}>
          {!canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}

          {/* 1. Service Business Name */}
          <FormInput
            label="Service Business Name"
            value={serviceName}
            onChangeText={setServiceName}
            required
            placeholder="e.g. Jane's Cleaning Co."
          />

          {/* 2. Category */}
          <FormInput
            label="Category"
            value={categoryLabel}
            onChangeText={setCategoryLabel}
            required
            type="picker"
            options={CATEGORY_OPTIONS}
            placeholder="Select a service category"
            dropdownZIndex={2000}
          />

          {/* 3. Motto (Optional) */}
          <FormInput
            label="Motto (Optional)"
            value={serviceMotto}
            onChangeText={setServiceMotto}
            placeholder="e.g. Quality work you can trust"
          />

          {/* 4. Description */}
          <FormInput
            label="Description"
            value={serviceDescription}
            onChangeText={setServiceDescription}
            required
            multiline
            placeholder="Describe your service, experience, what's included..."
          />

          {/* 5. Business Hours */}
          <Text style={styles.fieldLabel}>Business Hours</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={businessHours}
            onChangeText={setBusinessHours}
            placeholder={'Mon-Fri: 9am-5pm\nSat: 10am-2pm\nSun: Closed'}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
          />

          {/* 6. Location */}
          <Text style={styles.sectionDivider}>LOCATION</Text>

          <FormInput
            label="Street Address (Optional)"
            value={streetAddress}
            onChangeText={setStreetAddress}
            placeholder="123 Main Street, Suite 100"
          />
          <FormInput
            label="City"
            value={city}
            onChangeText={setCity}
            required
            placeholder="Your city"
          />
          <FormInput
            label="State"
            value={state}
            onChangeText={setState}
            required
            placeholder="State"
          />
          <FormInput
            label="Zip Code"
            value={zipCode}
            onChangeText={setZipCode}
            required
            keyboardType="numeric"
            placeholder="Zip code"
          />

          {/* 7. Preferred Contact Method */}
          <Text style={styles.sectionDivider}>CONTACT</Text>

          <FormInput
            label="Preferred Contact Method"
            value={CONTACT_VALUE_TO_LABEL[preferredContact] || ''}
            onChangeText={(label) => {
              const method = CONTACT_LABEL_TO_VALUE[label];
              if (method) setPreferredContact(method);
            }}
            required
            type="picker"
            options={CONTACT_METHOD_OPTIONS}
            placeholder="Select contact method"
            dropdownZIndex={1500}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>OK to message on Local List</Text>
            <Switch
              value={allowMessaging}
              onValueChange={setAllowMessaging}
              trackColor={{ false: '#cbd5e1', true: '#86efac' }}
              thumbColor={allowMessaging ? '#16a34a' : '#f8fafc'}
            />
          </View>

          {/* 8. Phone (Optional) */}
          <FormInput
            label="Phone (Optional)"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            placeholder="(555) 555-5555"
          />

          {/* 9. Link / Website (Optional) */}
          <FormInput
            label="Website Link (Optional)"
            value={contactWebsite}
            onChangeText={setContactWebsite}
            placeholder="https://www.example.com"
          />

          {/* 10. Facebook URL (Optional) */}
          <FormInput
            label="Facebook URL (Optional)"
            value={facebookUrl}
            onChangeText={setFacebookUrl}
            placeholder="https://facebook.com/your-page"
          />

          {/* 11. YouTube URL (Optional) */}
          <FormInput
            label="YouTube URL (Optional)"
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            placeholder="https://youtube.com/@your-channel"
          />

          {/* 12-14. Images */}
          <Text style={styles.sectionDivider}>IMAGES</Text>

          <Text style={styles.fieldLabel}>Cover Image</Text>
          <ImageUploader images={coverImage} onChange={(imgs: string[]) => setCoverImage(imgs.slice(0, 1))} />

          <Text style={styles.fieldLabel}>Logo Image</Text>
          <ImageUploader images={logoImage} onChange={(imgs: string[]) => setLogoImage(imgs.slice(0, 1))} />

          <Text style={styles.fieldLabel}>Gallery</Text>
          <ImageUploader images={galleryImages} onChange={setGalleryImages} />

          <Text style={styles.imageNote}>* At least one image is required (cover, logo, or gallery)</Text>

          {/* Boost */}
          <Text style={styles.sectionDivider}>BOOST YOUR LISTING</Text>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setFeatureRequested((v) => !v)}
            activeOpacity={0.85}
          >
            <View style={[styles.checkbox, featureRequested && styles.checkboxChecked]}>
              {featureRequested && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Feature this service — $10 for 30 days</Text>
          </TouchableOpacity>
          {featureRequested && (
            <Text style={styles.featureNote}>
              After submitting, Stripe checkout will open so you can activate featured placement.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !canPostListings) && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting || !canPostListings}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Post Service'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleBack} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f5f7' },
  content: { padding: 14, paddingBottom: 32, gap: 12 },
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#334155', textAlign: 'center' },
  heroSubtitle: { marginTop: 6, fontSize: 14, color: '#64748b', textAlign: 'center' },
  panel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  notice: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#ccfbf1',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  switchRow: {
    marginTop: 10,
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
  imageNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontStyle: 'italic',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, marginBottom: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  checkboxTick: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  checkboxLabel: { color: '#374151', fontSize: 14, fontWeight: '500', flex: 1 },
  featureNote: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 4,
    marginTop: 2,
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  successWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  successCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e4f2',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successCheck: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  successMessage: { fontSize: 14, lineHeight: 21, color: '#4b5563', textAlign: 'center', marginBottom: 20 },
  successActions: { width: '100%', gap: 10 },
  successPrimary: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  successPrimaryText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  successSecondary: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  successSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '700' },
});
