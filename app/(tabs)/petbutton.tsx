import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import PetCard from '../../components/PetCard';
import { app } from '../../firebase';
import { Pet } from '../../types/Pet';

export default function PetHubScreen() {
  const router = useRouter();
  const [lostPets, setLostPets] = useState<Pet[]>([]);
  const [foundPets, setFoundPets] = useState<Pet[]>([]);
  const [adoptionPets, setAdoptionPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllPets();
  }, []);

  const fetchAllPets = async () => {
    try {
      setLoading(true);
      const db = getFirestore(app);
      const petsRef = collection(db, 'pets');

      // Fetch Lost Pets
      const lostQuery = query(
        petsRef,
        where('postType', '==', 'lost'),
        orderBy('createdAt', 'desc')
      );
      const lostSnapshot = await getDocs(lostQuery);
      const lostPetsData = lostSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      // Fetch Found Pets
      const foundQuery = query(
        petsRef,
        where('postType', '==', 'found'),
        orderBy('createdAt', 'desc')
      );
      const foundSnapshot = await getDocs(foundQuery);
      const foundPetsData = foundSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      // Fetch Adoption Pets
      const adoptionQuery = query(
        petsRef,
        where('postType', '==', 'adoption'),
        orderBy('createdAt', 'desc')
      );
      const adoptionSnapshot = await getDocs(adoptionQuery);
      const adoptionPetsData = adoptionSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      setLostPets(lostPetsData);
      setFoundPets(foundPetsData);
      setAdoptionPets(adoptionPetsData);
    } catch (error) {
      console.error('Error fetching pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAllPets().then(() => setRefreshing(false));
  }, []);

  const handlePetPress = (pet: Pet) => {
    router.push({
      pathname: '/pet-details' as any,
      params: {
        petId: pet.id,
        postType: pet.postType,
      },
    });
  };

  const PetSection = ({
    title,
    emoji,
    pets,
    postType,
  }: {
    title: string;
    emoji: string;
    pets: Pet[];
    postType: 'lost' | 'found' | 'adoption';
  }) => {
    const previewPets = pets.slice(0, 9); // Show at most 9 pets

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {emoji} {title}
          </Text>
          <Text style={styles.petCount}>({pets.length})</Text>
        </View>

        {pets.length > 0 ? (
          <>
            <View style={styles.petsGrid}>
              {previewPets.map((pet) => (
                <View key={pet.id} style={styles.petsGridItem}>
                  <PetCard
                    pet={pet}
                    onPress={() => handlePetPress(pet)}
                    compact
                  />
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No {postType} pets at the moment
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() =>
            router.push({
              pathname: '/browse-pets' as any,
              params: { category: postType },
            })
          }
        >
          <Text style={styles.viewAllText}>
            View All {title} →
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>Loading pets...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <BackToCommunityHubRow />

      <View style={styles.header}>
        <Text style={styles.pageTitle}>The Pet Corner</Text>
        <Text style={styles.pageSubtitle}>
          Missing your pet? Let our community help bring them home
        </Text>
      </View>

      <View style={styles.ctaSection}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() =>
            router.push({
              pathname: '/create-pet-post' as any,
              params: { type: 'lost' },
            })
          }
          activeOpacity={0.8}
        >
          <ImageBackground
            source={require('../../assets/images/lost-pet-bg.jpg')}
            style={styles.ctaButtonImage}
            imageStyle={styles.ctaButtonImageStyle}
            resizeMode="contain"
          >
            <View style={styles.lostOverlayPill}>
              <Text style={styles.lostOverlayPillText}>Report A Lost Pet</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() =>
            router.push({
              pathname: '/create-pet-post' as any,
              params: { type: 'found' },
            })
          }
          activeOpacity={0.8}
        >
          <ImageBackground
            source={require('../../assets/images/found-pet-bg.jpg')}
            style={styles.ctaButtonImage}
            imageStyle={styles.ctaButtonImageStyle}
            resizeMode="contain"
          >
            <View style={styles.foundOverlayPill}>
              <Text style={styles.foundOverlayPillText}>Report A Found Pet</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/create-adoption-listing' as any)}
          activeOpacity={0.8}
        >
          <ImageBackground
            source={require('../../assets/images/adoption-bg.jpg')}
            style={styles.ctaButtonImage}
            imageStyle={styles.ctaButtonImageStyle}
            resizeMode="contain"
          >
            <View style={styles.adoptOverlayPill}>
              <Text style={styles.adoptOverlayPillText}>List Your Pet</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </View>

      <PetSection
        title="Recent Lost Pets"
        emoji="🔍"
        pets={lostPets}
        postType="lost"
      />

      <PetSection
        title="Recent Found Pets"
        emoji="✨"
        pets={foundPets}
        postType="found"
      />

      <PetSection
        title="Recent Pets for Adoption"
        emoji="💕"
        pets={adoptionPets}
        postType="adoption"
      />

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  ctaSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    flexDirection: 'row',
    gap: 8,
  },
  ctaButton: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  ctaButtonImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  ctaButtonImageStyle: {
    borderRadius: 12,
  },
  lostOverlayPill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 70, 130, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  lostOverlayPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  foundOverlayPill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(20, 115, 65, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  foundOverlayPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  adoptOverlayPill: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(169, 79, 26, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  adoptOverlayPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  ctaButtonText: {
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  petCount: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  petsList: {
    marginBottom: 8,
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  petsGridItem: {
    width: '33.3333%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  viewAllButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0066cc',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  footer: {
    height: 80,
  },
});
