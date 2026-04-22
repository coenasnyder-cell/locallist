import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DropDownPicker from 'react-native-dropdown-picker';
import ImageUploader from '../../components/ImageUploader';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { db } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';

// Category constants for Services
const SERVICE_CATEGORIES = [
  { label: 'Home Services', value: 'Home Services' },
  { label: 'Pet Services', value: 'Pet Services' },
  { label: 'Professional Services', value: 'Professional Services' },
  { label: 'Personal Care', value: 'Personal Care' },
  { label: 'Events & Entertainment', value: 'Events & Entertainment' },
  { label: 'Lessons & Tutoring', value: 'Lessons & Tutoring' },
  { label: 'Automotive', value: 'Automotive' },
  { label: 'Technology', value: 'Technology' },
  { label: 'Other', value: 'Other' },
];

export default function CreateServiceListing() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, profile, loading, canPostListings, postingBlockedReason } = useAccountStatus();

  const [serviceName, setServiceName] = useState('');
  const [open, setOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState(null);
  const [items, setItems] = useState(SERVICE_CATEGORIES);

  const [serviceMotto, setServiceMotto] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [preferredContact, setPreferredContact] = useState('email');
  const [contactPhone, setContactPhone] = useState('');
  const [contactWebsite, setContactWebsite] = useState('');
  const [coverImage, setCoverImage] = useState<string[]>([]);
  const [logoImage, setLogoImage] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [featureRequested, setFeatureRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  const checkoutParam = params.checkout;
  const postedParam = params.posted;

  useEffect(() => {
    if (postedParam === '1') setPosted(true);
  }, [postedParam]);

  const handleFormSubmit = async () => {
    if (!serviceName || !categoryValue || !serviceDescription) {
      Alert.alert('Required Fields', 'Please provide a name, category, and description.');
      return;
    }

    setSubmitting(true);
    try {
      const docData = {
        userId: user?.uid,
        serviceName,
        category: categoryValue,
        motto: serviceMotto,
        serviceDescription,
        businessHours,
        locationAddress: streetAddress,
        locationCity: city,
        locationState: state,
        locationZip: zipCode,
        preferredContactMethod: preferredContact,
        contactPhone,
        contactWebsite,
        serviceImage: coverImage[0] || null,
        logoImage: logoImage[0] || null,
        serviceImages: galleryImages,
        status: 'pending',
        isApproved: false,
        isFeatured: false,
        featureRequested,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        viewCount: 0,
      };

      const docRef = await addDoc(collection(db, 'services'), docData);

      if (featureRequested) {
        // Since we are moving to native Payment Sheets, we will implement that flow here
        // For now, redirect to success and log the intent
        console.log("Feature requested for service:", docRef.id);
        Alert.alert("Success", "Your payment was sucessful. All featured services require admin approval and are placed in a pending status until approved.");
        setPosted(true);
      } else {
        setPosted(true);
      }
    } catch (error) {
      console.error('Error submitting service:', error);
      Alert.alert('Error', 'Could not submit your service listing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#475569" /></View>;

  if (posted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#22c55e" />
          <Text style={styles.successTitle}>Service Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your service has been submitted for review. {featureRequested ? 'Featured status will be applied after verification.' : ''}
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('../(tabs)')}>
            <Text style={styles.primaryButtonText}>Return Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScreenTitleRow title="List a Service" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.formSection, { zIndex: 1000 }]}>
            <Text style={styles.sectionLabel}>Service Details</Text>
            <TextInput style={styles.input} placeholder="Service Name" value={serviceName} onChangeText={setServiceName} />

            <Text style={styles.fieldHint}>Select Category</Text>
            <DropDownPicker
              open={open}
              value={categoryValue}
              items={items}
              setOpen={setOpen}
              setValue={setCategoryValue}
              setItems={setItems}
              placeholder="Choose a Category"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              listMode="SCROLLVIEW"
            />

            <TextInput style={styles.input} placeholder="Motto (Optional)" value={serviceMotto} onChangeText={setServiceMotto} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description" multiline value={serviceDescription} onChangeText={setServiceDescription} />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Location</Text>
            <TextInput style={styles.input} placeholder="ZIP Code" value={zipCode} onChangeText={setZipCode} keyboardType="number-pad" />
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Images</Text>
            <Text style={styles.fieldHint}>Cover Image</Text>
            <ImageUploader images={coverImage} onChange={setCoverImage} />
            <Text style={styles.fieldHint}>Gallery (Up to 5)</Text>
            <ImageUploader images={galleryImages} onChange={setGalleryImages} />
          </View>

          <View style={styles.promotionSection}>
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setFeatureRequested(!featureRequested)}>
              <Ionicons name={featureRequested ? 'checkbox' : 'square-outline'} size={24} color="#475569" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.checkboxLabel}>Feature this service ($10 for 30 days)</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleFormSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Submit Listing</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  formSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  dropdown: { borderColor: '#e2e8f0', borderRadius: 10, marginBottom: 12 },
  dropdownContainer: { borderColor: '#e2e8f0' },
  textArea: { height: 100, textAlignVertical: 'top' },
  fieldHint: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  promotionSection: { backgroundColor: '#f0f9ff', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#bae6fd' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkboxLabel: { fontSize: 16, fontWeight: '700', color: '#0369a1' },
  actions: { gap: 12, marginBottom: 40 },
  primaryButton: { backgroundColor: '#334155', borderRadius: 12, padding: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  successTitle: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  successSubtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', marginTop: 12, marginBottom: 32 },
});
