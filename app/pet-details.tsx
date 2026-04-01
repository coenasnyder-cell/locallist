import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Header from '../components/Header';
import { db } from '../firebase';
import { Pet } from '../types/Pet';

export default function PetDetailsScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = getAuth().currentUser;

  const navigateToPetHub = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/petbutton' as any);
  }, [router]);

  useEffect(() => {
    if (petId) {
      fetchPetDetails();
    }
  }, [petId]);

  const fetchPetDetails = async () => {
    try {
      setLoading(true);
      const petRef = doc(db, 'pets', petId!);
      const petSnapshot = await getDoc(petRef);

      if (petSnapshot.exists()) {
        setPet({
          id: petSnapshot.id,
          ...petSnapshot.data(),
        } as Pet);
      }
    } catch (error) {
      console.error('Error fetching pet details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reunited':
        return '#4CAF50';
      case 'adopted':
        return '#2196F3';
      case 'lost':
        return '#FF9800';
      default:
        return '#9C27B0';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'reunited':
        return '✓ Reunited';
      case 'adopted':
        return '✓ Adopted';
      case 'lost':
        return '🔍 Still Lost';
      case 'found':
        return '✓ Found';
      default:
        return status;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp.seconds * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const displayLocation = (() => {
    const rawLocation = typeof pet?.petSeenLocation === 'string' ? pet.petSeenLocation.trim() : '';

    if (!rawLocation) {
      return '';
    }

    const cleanedLocation = rawLocation.replace(/\s+/g, ' ').split(/\r?\n/)[0].trim();
    const descriptionLikePattern = /\b(friendly|timid|shy|wearing|collar|microchipp|reward|answers to|please call|contact me|description)\b/i;

    if (cleanedLocation.length > 80 || descriptionLikePattern.test(cleanedLocation)) {
      return '';
    }

    return cleanedLocation;
  })();

  const locationLabel = pet?.postType === 'adoption'
    ? '📍 Location'
    : pet?.postType === 'found'
      ? '📍 Found Location'
      : '📍 Last Seen Location';

  const handleSendMessage = async () => {
    try {
      const user = getAuth().currentUser;

      if (!user) {
        Alert.alert('Sign in required', 'Please log in to send a message.');
        return;
      }

      if (!pet) {
        Alert.alert('Unavailable', 'Pet listing is not available.');
        return;
      }

      if (!pet.userId) {
        Alert.alert('Unavailable', 'Unable to message this listing owner right now.');
        return;
      }

      if (pet.userId === user.uid) {
        Alert.alert('Heads up', 'This is your own listing.');
        return;
      }

      const threadsRef = collection(db, 'threads');
      const existingThreadQuery = query(
        threadsRef,
        where('listingId', '==', pet.id),
        where('participantIds', 'array-contains', user.uid)
      );
      const existingThreadSnapshot = await getDocs(existingThreadQuery);

      if (!existingThreadSnapshot.empty) {
        const match = existingThreadSnapshot.docs.find(d => {
          const ids: string[] = d.data().participantIds || [];
          return ids.includes(pet.userId);
        });
        if (match) {
          router.push({ pathname: '/threadchat' as any, params: { threadId: match.id } });
          return;
        }
      }

      const postTypeLabel = pet.postType === 'lost' ? 'Lost Pet' : pet.postType === 'found' ? 'Found Pet' : 'For Adoption';
      const threadDoc = await addDoc(threadsRef, {
        participantIds: [user.uid, pet.userId],
        listingId: pet.id,
        listingType: 'pet',
        listingTitle: `${pet.petName} – ${postTypeLabel}`,
        listingImage: pet.petImages?.[0] || pet.petPhoto || null,
        lastMessage: '',
        lastTimestamp: serverTimestamp(),
        unreadBy: [pet.userId],
        createdAt: serverTimestamp(),
      });

      router.push({
        pathname: '/threadchat' as any,
        params: { threadId: threadDoc.id },
      });
    } catch (error) {
      console.error('Error starting message thread:', error);
      Alert.alert('Error', 'Unable to start conversation. Please try again.');
    }
  };

  const submitPetReport = async (reason: string) => {
    if (!pet) return;

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (pet.userId && pet.userId === currentUser.uid) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      await addDoc(collection(db, 'reportedListings'), {
        listingId: pet.id,
        listingType: 'pet',
        listingTitle: pet.petName || 'Pet listing',
        listingImage: pet.petImages?.[0] || pet.petPhoto || '',
        sellerId: pet.userId || '',
        sellerEmail: '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from pet details screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch (error) {
      console.error('Error reporting pet listing:', error);
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleReportPet = () => {
    Alert.alert('Report Listing', 'Why are you reporting this pet listing?', [
      { text: 'Spam', onPress: () => submitPetReport('spam') },
      { text: 'Scam/Fraud', onPress: () => submitPetReport('scam') },
      { text: 'Prohibited Content', onPress: () => submitPetReport('prohibited_content') },
      { text: 'Misleading Information', onPress: () => submitPetReport('misleading_content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Pet not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={navigateToPetHub}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.backRowWrap}>
          <TouchableOpacity
            style={styles.backRowButton}
            onPress={navigateToPetHub}
            activeOpacity={0.85}
          >
            <Text style={styles.backRowButtonText}>{'<Back To The Pet Corner'}</Text>
          </TouchableOpacity>
        </View>

        {/* Pet Image */}
      <View style={styles.imageSection}>
        {pet.petImages?.[0] || pet.petPhoto ? (
          <Image source={{ uri: pet.petImages?.[0] || pet.petPhoto }} style={styles.petImage} />
        ) : (
          <View style={[styles.petImage, styles.placeholderImage]}>
            <Text style={styles.placeholderEmoji}>🐾</Text>
          </View>
        )}

        <View
          style={[styles.statusBadge, { backgroundColor: getStatusColor(pet.petStatus) }]}
        >
          <Text style={styles.statusText}>{getStatusLabel(pet.petStatus)}</Text>
        </View>
      </View>

      {/* Pet Info */}
      <View style={styles.content}>
        <Text style={styles.petName}>{pet.petName}</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{pet.petType}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Breed</Text>
            <Text style={styles.infoValue}>{pet.petBreed}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{pet.petAge}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{pet.petGender}</Text>
          </View>
        </View>

        {/* Location */}
        {!!displayLocation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{locationLabel}</Text>
            <Text style={styles.sectionContent}>{displayLocation}</Text>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Description</Text>
          <Text style={styles.sectionContent}>{pet.petDescription}</Text>
        </View>

        {/* Adoption Fee */}
        {pet.postType === 'adoption' && pet.petAdoptionFee && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💰 Adoption Fee</Text>
            <Text style={styles.adoptionFeeText}>${pet.petAdoptionFee}</Text>
          </View>
        )}

        {/* Date Posted */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Posted On</Text>
          <Text style={styles.sectionContent}>{formatDate(pet.createdAt)}</Text>
        </View>

        {/* Post Type Badge */}
        <View style={styles.postTypeBadge}>
          <Text style={styles.postTypeText}>
            {pet.postType === 'lost' ? '🔍 Lost Pet' : ''}
            {pet.postType === 'found' ? '✨ Found Pet' : ''}
            {pet.postType === 'adoption' ? '💕 For Adoption' : ''}
          </Text>
        </View>

        {/* Contact Button */}
        <TouchableOpacity style={styles.contactButton} onPress={handleSendMessage}>
          <Text style={styles.contactButtonText}>Send A Message</Text>
        </TouchableOpacity>
        {!!currentUser && pet.userId !== currentUser.uid && (
          <TouchableOpacity style={styles.reportButton} onPress={handleReportPet}>
            <Text style={styles.reportButtonText}>Report Listing</Text>
          </TouchableOpacity>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: '600',
  },
  imageSection: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 210,
    backgroundColor: '#fff',
  },
  backRowWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backRowButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
  },
  backRowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0066cc',
  },
  petImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
    resizeMode: 'cover',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderEmoji: {
    fontSize: 56,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },
  petName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333',
    marginBottom: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  infoCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '700',
  },
  reportButton: {
    marginTop: 8,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  reportButtonText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  sectionContent: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  adoptionFeeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2196F3',
  },
  postTypeBadge: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  postTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  contactButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#0066cc',
    fontWeight: '600',
  },
});
