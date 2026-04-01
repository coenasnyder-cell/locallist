import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import PetCard from '../components/PetCard';
import { app } from '../firebase';
import { Pet } from '../types/Pet';

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

  const handleCreateLostPet = () => {
    router.push('/create-pet-post?type=lost' as any);
  };

  const handleCreateFoundPet = () => {
    router.push('/create-pet-post?type=found' as any);
  };

  const handleCreateAdoption = () => {
    router.push('/create-adoption-listing');
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
  }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {emoji} {title}
        </Text>
        <Text style={styles.petCount}>({pets.length})</Text>
      </View>

      {pets.length > 0 ? (
        <View style={styles.petsList}>
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              onPress={() => handlePetPress(pet)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No {postType} pets at the moment
          </Text>
        </View>
      )}
    </View>
  );

  const CTASection = () => (
    <View style={styles.ctaSection}>
      <Pressable 
        style={styles.ctaButton}
        onPress={handleCreateLostPet}
      >
        <Text style={styles.ctaEmoji}>🔍</Text>
        <Text style={styles.ctaText}>Report Lost Pet</Text>
      </Pressable>

      <Pressable 
        style={styles.ctaButton}
        onPress={handleCreateFoundPet}
      >
        <Text style={styles.ctaEmoji}>✨</Text>
        <Text style={styles.ctaText}>Report Found Pet</Text>
      </Pressable>

      <Pressable 
        style={styles.ctaButton}
        onPress={handleCreateAdoption}
      >
        <Text style={styles.ctaEmoji}>💕</Text>
        <Text style={styles.ctaText}>Offer for Adoption</Text>
      </Pressable>
    </View>
  );

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
      <View style={styles.header}>
        <Text style={styles.pageTitle}>🐾 Pet Hub</Text>
        <Text style={styles.pageSubtitle}>
          Help reunite, support, and give homes to pets
        </Text>
      </View>

      <CTASection />

      <PetSection
        title="Lost Pets"
        emoji="🔍"
        pets={lostPets}
        postType="lost"
      />

      <PetSection
        title="Found Pets"
        emoji="✨"
        pets={foundPets}
        postType="found"
      />

      <PetSection
        title="Pets for Adoption"
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
    height: 20,
  },
  ctaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 10,
  },
  ctaButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ctaEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
