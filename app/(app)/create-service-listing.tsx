import FormInput from '@/components/FormInput';
import ImageUploader from '@/components/ImageUploader';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';
import { getCityFromZip } from '../../utils/zipToCity';

const CATEGORIES = [
  { id: 'home-repair',    label: 'Home Repair',        icon: '🔨' },
  { id: 'lawn-garden',    label: 'Lawn & Garden',      icon: '🌿' },
  { id: 'cleaning',       label: 'Cleaning',           icon: '🧹' },
  { id: 'plumbing',       label: 'Plumbing',           icon: '🚰' },
  { id: 'electrical',     label: 'Electrical',         icon: '⚡' },
  { id: 'hvac',           label: 'HVAC',               icon: '❄️' },
  { id: 'painting',       label: 'Painting',           icon: '🎨' },
  { id: 'carpentry',      label: 'Carpentry',          icon: '🪚' },
  { id: 'moving',         label: 'Moving & Hauling',   icon: '🚚' },
  { id: 'childcare',      label: 'Childcare',          icon: '👶' },
  { id: 'tutoring',       label: 'Tutoring',           icon: '📚' },
  { id: 'pet-care',       label: 'Pet Care',           icon: '🐾' },
  { id: 'beauty',         label: 'Beauty & Wellness',  icon: '💇' },
  { id: 'auto',           label: 'Auto Services',      icon: '🚗' },
  { id: 'photography',    label: 'Photography',        icon: '📷' },
  { id: 'tech',           label: 'Tech Support',       icon: '💻' },
  { id: 'event-planning', label: 'Event Planning',     icon: '🎉' },
  { id: 'construction',   label: 'Construction',       icon: '🏗️' },
  { id: 'food-catering',  label: 'Food & Catering',    icon: '🍽️' },
  { id: 'fitness',        label: 'Fitness & Training', icon: '🏋️' },
  { id: 'other',          label: 'Other',              icon: '📋' },
];

const CATEGORY_OPTIONS = CATEGORIES.map((c) => `${c.icon} ${c.label}`);

const PRICE_TYPES = ['hourly', 'fixed', 'quote', 'negotiable'] as const;
type PriceType = (typeof PRICE_TYPES)[number];

const CONTACT_METHODS = ['phone', 'email', 'website'] as const;
type ContactMethod = (typeof CONTACT_METHODS)[number];

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
  const [serviceDescription, setServiceDescription] = useState('');
  const [providerName, setProviderName] = useState(
    profile?.displayName || ''
  );
  const [priceType, setPriceType] = useState<PriceType>('hourly');
  const [priceAmount, setPriceAmount] = useState('');
  const [preferredContact, setPreferredContact] = useState<ContactMethod>('email');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactWebsite, setContactWebsite] = useState('');
  const [allowMessaging, setAllowMessaging] = useState(true);
  const [serviceArea, setServiceArea] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [featureRequested, setFeatureRequested] = useState(false);
  const [images, setImages] = useState<string[]>([]);
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
            <Text style={styles.heroTitle}>🧰 List a Service</Text>
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
    else router.replace('/(tabs)/listbutton' as any);
  };

  const resolvedCategory = CATEGORIES.find(
    (c) => `${c.icon} ${c.label}` === categoryLabel
  );

  const preferredContactValue =
    preferredContact === 'phone'
      ? contactPhone.trim()
      : preferredContact === 'email'
        ? contactEmail.trim()
        : contactWebsite.trim();

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
      Alert.alert('Missing Field', 'Please enter a service title.');
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
    if (!providerName.trim()) {
      Alert.alert('Missing Field', 'Please enter your name or business name.');
      return;
    }
    if (!zipCode.trim()) {
      Alert.alert('Missing Field', 'Please enter your ZIP code.');
      return;
    }
    if (!preferredContactValue) {
      Alert.alert(
        'Missing Field',
        `Please enter your ${preferredContact} for the preferred contact method.`
      );
      return;
    }
    if (images.length === 0) {
      Alert.alert('Missing Images', 'Please upload at least one photo for your service listing.');
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
      const serviceImage = images[0] ?? '';
      const city = await getCityFromZip(zipCode) ?? 'TBD';

      const serviceDocRef = await addDoc(collection(db, 'services'), {
        userId: user.uid,
        providerName: providerName.trim(),
        serviceName: serviceName.trim(),
        category: resolvedCategory.label,
        categoryId: resolvedCategory.id,
        categoryIcon: resolvedCategory.icon,
        serviceDescription: serviceDescription.trim(),
        serviceImage,
        priceType,
        priceAmount: priceAmount.trim() || null,
        preferredContactMethod: preferredContact,
        preferredContactValue,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactWebsite: contactWebsite.trim() || null,
        allowMessaging,
        serviceArea: serviceArea.trim() || null,
        zipCode: zipCode.trim(),
        city,
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
    setServiceDescription('');
    setProviderName(profile?.displayName || '');
    setPriceType('hourly');
    setPriceAmount('');
    setPreferredContact('email');
    setContactPhone('');
    setContactEmail(user?.email || '');
    setContactWebsite('');
    setAllowMessaging(true);
    setServiceArea('');
    setZipCode('');
    setFeatureRequested(false);
    setImages([]);
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
                <Text style={styles.successPrimaryText}>Back to List Hub</Text>
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
          <Text style={styles.heroTitle}>🧰 List a Service</Text>
          <Text style={styles.heroSubtitle}>Offer your skills to the local community</Text>
        </View>

        <View style={styles.panel}>
          {!canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}
          <Text style={styles.sectionDivider}>SERVICE DETAILS</Text>

          <FormInput
            label="Service Title"
            value={serviceName}
            onChangeText={setServiceName}
            required
            placeholder="e.g. Professional Lawn Mowing"
          />
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
          <FormInput
            label="Description"
            value={serviceDescription}
            onChangeText={setServiceDescription}
            required
            multiline
            placeholder="Describe your service, experience, what's included..."
          />
          <FormInput
            label="Your Name / Business Name"
            value={providerName}
            onChangeText={setProviderName}
            required
            placeholder="Jane's Cleaning Co."
          />

          <Text style={styles.sectionDivider}>PRICING</Text>

          <Text style={styles.fieldLabel}>Price Type</Text>
          <View style={styles.priceTypeRow}>
            {PRICE_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt}
                style={[styles.priceTypeBtn, priceType === pt && styles.priceTypeBtnActive]}
                onPress={() => setPriceType(pt)}
                activeOpacity={0.8}
              >
                <Text style={[styles.priceTypeBtnText, priceType === pt && styles.priceTypeBtnTextActive]}>
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {priceType !== 'quote' && (
            <FormInput
              label="Price / Rate"
              value={priceAmount}
              onChangeText={setPriceAmount}
              placeholder="e.g. $40/hr, $150 flat"
            />
          )}

          <Text style={styles.sectionDivider}>CONTACT</Text>

          <FormInput
            label="Preferred Contact Method"
            value={preferredContact}
            onChangeText={(v) => setPreferredContact(v as ContactMethod)}
            required
            type="picker"
            options={['phone', 'email', 'website']}
            placeholder="Select a contact method"
            dropdownZIndex={1000}
          />
          {preferredContact === 'phone' && (
            <FormInput
              label="Phone Number"
              value={contactPhone}
              onChangeText={setContactPhone}
              required
              keyboardType="phone-pad"
              placeholder="(555) 555-5555"
            />
          )}
          {preferredContact === 'email' && (
            <FormInput
              label="Email Address"
              value={contactEmail}
              onChangeText={setContactEmail}
              required
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          )}
          {preferredContact === 'website' && (
            <FormInput
              label="Website URL"
              value={contactWebsite}
              onChangeText={setContactWebsite}
              required
              placeholder="https://..."
            />
          )}
          {preferredContact !== 'phone' && (
            <FormInput
              label="Phone (optional)"
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
              placeholder="(555) 555-5555"
            />
          )}
          {preferredContact !== 'email' && (
            <FormInput
              label="Email (optional)"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              placeholder="you@example.com"
            />
          )}

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAllowMessaging((v) => !v)}
            activeOpacity={0.85}
          >
            <View style={[styles.checkbox, allowMessaging && styles.checkboxChecked]}>
              {allowMessaging && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Allow in-app messaging</Text>
          </TouchableOpacity>

          <Text style={styles.sectionDivider}>LOCATION</Text>

          <FormInput
            label="Service Area"
            value={serviceArea}
            onChangeText={setServiceArea}
            placeholder="e.g. Harrison, AR and surrounding areas (optional)"
          />
          <FormInput
            label="ZIP Code"
            value={zipCode}
            onChangeText={setZipCode}
            required
            keyboardType="numeric"
            placeholder="72601"
          />

          <Text style={styles.sectionDivider}>PHOTO *</Text>

          <ImageUploader images={images} onChange={setImages} />

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
  priceTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  priceTypeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  priceTypeBtnActive: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  priceTypeBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  priceTypeBtnTextActive: { color: '#0f766e' },
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
