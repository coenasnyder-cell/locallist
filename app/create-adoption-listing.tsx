import { useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

type PetGender = 'male' | 'female' | 'unknown';

const GENDER_OPTIONS: PetGender[] = ['male', 'female', 'unknown'];

export default function CreateAdoptionListingScreen() {
  const router = useRouter();
  const { user, loading, canPostListings, postingBlockedReason } = useAccountStatus();

  const navigateToPetHub = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/petbutton' as any);
  }, [router]);

  const [petName, setPetName] = React.useState('');
  const [petType, setPetType] = React.useState('');
  const [petBreed, setPetBreed] = React.useState('');
  const [petAge, setPetAge] = React.useState('');
  const [petGender, setPetGender] = React.useState<PetGender>('male');
  const [showGenderMenu, setShowGenderMenu] = React.useState(false);
  const [petDescription, setPetDescription] = React.useState('');
  const [adoptionFee, setAdoptionFee] = React.useState('');
  const [images, setImages] = React.useState<string[]>([]);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const loginPromptShownRef = React.useRef(false);

  React.useEffect(() => {
    if (user) {
      loginPromptShownRef.current = false;
      return;
    }

    if (loading || loginPromptShownRef.current) {
      return;
    }

    loginPromptShownRef.current = true;
    Alert.alert('Login Required', 'You need to be logged in to create an adoption listing.', [
      { text: 'Back', style: 'cancel', onPress: navigateToPetHub },
      { text: 'Log In', onPress: () => router.push('/login') },
    ]);
  }, [user, loading, navigateToPetHub]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Login Required', 'You need to be logged in to create an adoption listing.');
      return;
    }

    if (loading) {
      Alert.alert('Please Wait', 'Checking account status. Please try again in a moment.');
      return;
    }

    if (!canPostListings) {
      Alert.alert('Account Action Required', postingBlockedReason || 'Your account is not eligible to post right now.');
      return;
    }

    if (!petName.trim() || !petType.trim() || !petBreed.trim()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Missing Images', 'Please upload at least one image of your pet.');
      return;
    }

    try {
      setLoadingSubmit(true);
      const db = getFirestore(app);
      const petsRef = collection(db, 'pets');

      const createdPetDoc = await addDoc(petsRef, {
        postType: 'adoption',
        petName: petName.trim(),
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        petAge: petAge.trim() || 'Unknown',
        petGender,
        petDescription: petDescription.trim(),
        petSeenLocation: '',
        petAdoptionFee: adoptionFee ? parseInt(adoptionFee, 10) : 0,
        petImages: images,
        userId: user?.uid,
        petStatus: 'available',
        createdAt: serverTimestamp(),
      });

      router.replace({
        pathname: '/listing-posted' as any,
        params: {
          petId: createdPetDoc.id,
          postType: 'adoption',
        },
      });
    } catch (error) {
      console.error('Error creating adoption listing:', error);
      Alert.alert('Error', 'Failed to create your adoption listing. Please try again.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.pageTitle}>
          <Text style={styles.title}>List Your Pet For Adoption</Text>
        </View>

        <View style={styles.form}>
        {!loading && user && !canPostListings ? (
          <Text style={styles.notice}>{postingBlockedReason}</Text>
        ) : null}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Pet Name *</Text>
          <TextInput style={styles.input} placeholder="e.g., Max, Bella" value={petName} onChangeText={setPetName} placeholderTextColor="#999" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Pet Type *</Text>
          <TextInput style={styles.input} placeholder="e.g., Dog, Cat, Rabbit" value={petType} onChangeText={setPetType} placeholderTextColor="#999" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Breed *</Text>
          <TextInput style={styles.input} placeholder="e.g., Golden Retriever, Siamese" value={petBreed} onChangeText={setPetBreed} placeholderTextColor="#999" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} placeholder="e.g., 3 years, 6 months" value={petAge} onChangeText={setPetAge} placeholderTextColor="#999" />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowGenderMenu(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownButtonText}>
              {petGender.charAt(0).toUpperCase() + petGender.slice(1)}
            </Text>
            <Text style={styles.dropdownChevron}>v</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <ImageUploader images={images} onChange={setImages} />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Adoption Fee</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 100"
            value={adoptionFee}
            onChangeText={setAdoptionFee}
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Tell potential adopters about your pet's personality and needs"
            value={petDescription}
            onChangeText={setPetDescription}
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.submitButton, (loadingSubmit || !user || !canPostListings) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loadingSubmit || !user || !canPostListings}
          >
            {loadingSubmit ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={navigateToPetHub}
            activeOpacity={0.8}
          >
            <Text
              style={styles.backButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>

      <Modal
        transparent
        visible={showGenderMenu}
        animationType="fade"
        onRequestClose={() => setShowGenderMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderMenu(false)}>
          <Pressable style={styles.dropdownMenu} onPress={() => {}}>
            {GENDER_OPTIONS.map((option) => {
              const isSelected = petGender === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                  onPress={() => {
                    setPetGender(option);
                    setShowGenderMenu(false);
                  }}
                >
                  <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  pageTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  form: {
    padding: 16,
  },
  notice: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  dropdownButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownChevron: {
    color: '#666',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#e9f3ff',
  },
  dropdownItemText: {
    color: '#333',
    fontSize: 14,
  },
  dropdownItemTextSelected: {
    color: '#0066cc',
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#0066cc',
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e4f2',
    borderRadius: 8,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
