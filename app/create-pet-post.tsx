import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import ScreenTitleRow from '../components/ScreenTitleRow';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

type PetGender = 'male' | 'female' | 'unknown';

const GENDER_OPTIONS: PetGender[] = ['male', 'female', 'unknown'];

export default function CreatePetPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const isFoundPost = params.type === 'found';
  const postType: 'lost' | 'found' = isFoundPost ? 'found' : 'lost';
  const { user, loading, canPostListings, postingBlockedReason } = useAccountStatus();
  const [petName, setPetName] = React.useState('');
  const [petType, setPetType] = React.useState('');
  const [petBreed, setPetBreed] = React.useState('');
  const [petAge, setPetAge] = React.useState('');
  const [petGender, setPetGender] = React.useState<PetGender>('male');
  const [showGenderMenu, setShowGenderMenu] = React.useState(false);
  const [petDescription, setPetDescription] = React.useState('');
  const [petSeenLocation, setPetSeenLocation] = React.useState('');
  const [images, setImages] = React.useState<string[]>([]);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const loginPromptShownRef = React.useRef(false);

  const navigateToPetHub = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.push('/(tabs)/petbutton' as any);
  }, [router]);

  React.useEffect(() => {
    if (user) {
      loginPromptShownRef.current = false;
      return;
    }

    if (loading || loginPromptShownRef.current) {
      return;
    }

    loginPromptShownRef.current = true;
    Alert.alert('Login Required', 'You need to be logged in to create a pet post.', [
      { text: 'Back', style: 'cancel', onPress: navigateToPetHub },
      { text: 'Log In', onPress: () => router.push('/login') },
    ]);
  }, [user, loading, navigateToPetHub]);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Login Required', 'You need to be logged in to create a pet post.');
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

    if (!petName.trim() || !petType.trim() || !petBreed.trim() || !petSeenLocation.trim()) {
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
        postType,
        petName: petName.trim(),
        petType: petType.trim(),
        petBreed: petBreed.trim(),
        petAge: petAge.trim() || 'Unknown',
        petGender,
        petDescription: petDescription.trim(),
        petSeenLocation: petSeenLocation.trim(),
        petImages: images,
        petAdoptionFee: 0,
        userId: user?.uid,
        petStatus: postType,
        createdAt: serverTimestamp(),
      });

      router.replace({
        pathname: '/listing-posted' as any,
        params: {
          petId: createdPetDoc.id,
          postType,
        },
      });
    } catch (error) {
      console.error('Error creating pet post:', error);
      Alert.alert('Error', 'Failed to create your pet post. Please try again.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow title={isFoundPost ? 'Create Found Pet Post' : 'Create Lost Pet Post'} onBackPress={navigateToPetHub} />
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.subtitle}>
            {isFoundPost
              ? 'Share clear details so owners can identify and reunite with their pet quickly.'
              : 'Share clear details so neighbors can quickly help bring your pet home.'}
          </Text>
        </View>

        <View style={styles.formCard}>
          {!loading && user && !canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Pet Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Max, Bella"
              value={petName}
              onChangeText={setPetName}
              placeholderTextColor="#8a8f98"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Pet Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Dog, Cat, Rabbit"
              value={petType}
              onChangeText={setPetType}
              placeholderTextColor="#8a8f98"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Breed *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Golden Retriever, Siamese"
              value={petBreed}
              onChangeText={setPetBreed}
              placeholderTextColor="#8a8f98"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 3 years, 6 months"
              value={petAge}
              onChangeText={setPetAge}
              placeholderTextColor="#8a8f98"
            />
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
            <Text style={styles.label}>{isFoundPost ? 'Found Location *' : 'Last Seen Location *'}</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder={isFoundPost ? 'Where did you find the pet?' : 'Where was your pet last seen?'}
              value={petSeenLocation}
              onChangeText={setPetSeenLocation}
              placeholderTextColor="#8a8f98"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Describe unique markings, collar, temperament, and anything else helpful"
              value={petDescription}
              onChangeText={setPetDescription}
              placeholderTextColor="#8a8f98"
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
              {loadingSubmit ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={navigateToPetHub}
              activeOpacity={0.8}
            >
              <Text
                style={styles.backRowText}
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
    backgroundColor: '#eef3f8',
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 80,
    gap: 12,
  },
  screenTitleRowWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e4f2',
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRowText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    includeFontPadding: false,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#d8e4f2',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4c6178',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#d8e4f2',
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#23384d',
    marginBottom: 7,
  },
  input: {
    backgroundColor: '#f9fbff',
    borderWidth: 1,
    borderColor: '#c9d8ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1c2c3d',
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  dropdownButton: {
    backgroundColor: '#f9fbff',
    borderWidth: 1,
    borderColor: '#c9d8ea',
    borderRadius: 10,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  dropdownButtonText: {
    color: '#1c2c3d',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownChevron: {
    color: '#55708c',
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
    borderColor: '#d8e4f2',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f8',
  },
  dropdownItemSelected: {
    backgroundColor: '#e9f3ff',
  },
  dropdownItemText: {
    color: '#1c2c3d',
    fontSize: 14,
  },
  dropdownItemTextSelected: {
    color: '#0c6ecf',
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#475569',
    minHeight: 46,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
