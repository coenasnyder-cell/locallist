import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PetCard from '../components/PetCard';
import { app } from '../firebase';
import { Pet } from '../types/Pet';

type ServiceListing = {
  id: string;
  serviceName: string;
  providerName?: string;
  category?: string;
  categoryIcon?: string;
  serviceDescription?: string;
  serviceImage?: string;
  priceType?: string;
  priceAmount?: string | null;
  createdAt?: any;
  isActive?: boolean;
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
};

function isApprovedService(data: any): boolean {
  const status = String(data?.status || '').toLowerCase();
  const approvalStatus = String(data?.approvalStatus || '').toLowerCase();

  if (data?.isApproved === true) return true;
  if (approvalStatus === 'approved') return true;
  return status === 'approved';
}

function getServicePriceLabel(service: ServiceListing): string | null {
  if (!service.priceType) return null;
  if (service.priceType === 'quote') return 'Free Quote';
  if (service.priceType === 'negotiable') return 'Negotiable';
  if (service.priceAmount && service.priceType === 'hourly') return `$${service.priceAmount}/hr`;
  if (service.priceAmount && service.priceType === 'fixed') return `$${service.priceAmount} flat`;
  if (service.priceAmount) return `$${service.priceAmount}`;
  return null;
}

function getTimestampValue(value: any): number {
  if (value?.toMillis) return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  return 0;
}

export default function PetHubScreen() {
  const router = useRouter();
  const [lostPets, setLostPets] = useState<Pet[]>([]);
  const [foundPets, setFoundPets] = useState<Pet[]>([]);
  const [adoptionPets, setAdoptionPets] = useState<Pet[]>([]);
  const [petServices, setPetServices] = useState<ServiceListing[]>([]);
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

      // Fetch Pet Services
      const servicesSnapshot = await getDocs(collection(db, 'services'));
      const petServicesData = servicesSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<ServiceListing, 'id'>),
        }))
        .filter((service) => {
          if (service.isActive === false) return false;
          if (!isApprovedService(service)) return false;

          const category = String(service.category || '').toLowerCase();
          return category === 'pet care' || category === 'pet-care' || category.includes('pet');
        })
        .sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));

      setLostPets(lostPetsData);
      setFoundPets(foundPetsData);
      setAdoptionPets(adoptionPetsData);
      setPetServices(petServicesData);
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

  const handleCreatePetService = () => {
    router.push('/(app)/create-service-listing' as any);
  };

  const handleServicePress = (serviceId: string) => {
    router.push({ pathname: '/(app)/service-details' as any, params: { id: serviceId } });
  };

  const handleCreateByType = (postType: 'lost' | 'found' | 'adoption') => {
    if (postType === 'lost') {
      handleCreateLostPet();
      return;
    }

    if (postType === 'found') {
      handleCreateFoundPet();
      return;
    }

    handleCreateAdoption();
  };

  const getPostActionLabel = (postType: 'lost' | 'found' | 'adoption') => {
    if (postType === 'lost') return 'Report Lost Pet';
    if (postType === 'found') return 'Report Found Pet';
    return 'List a Pet';
  };

  const PetServicesSection = () => {
    const previewServices = petServices.slice(0, 4);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>🐾 Pet Services</Text>
            <Text style={styles.petCount}>{petServices.length} listing{petServices.length === 1 ? '' : 's'}</Text>
          </View>

          <TouchableOpacity
            style={styles.sectionActionButton}
            onPress={handleCreatePetService}
            activeOpacity={0.85}
          >
            <Text style={styles.sectionActionText}>Add Listing</Text>
          </TouchableOpacity>
        </View>

        {previewServices.length > 0 ? (
          <View style={styles.serviceGrid}>
            {previewServices.map((service) => {
              const priceLabel = getServicePriceLabel(service);

              return (
                <TouchableOpacity
                  key={service.id}
                  style={styles.serviceCard}
                  onPress={() => handleServicePress(service.id)}
                  activeOpacity={0.88}
                >
                  {service.serviceImage ? (
                    <Image source={{ uri: service.serviceImage }} style={styles.serviceImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.serviceImagePlaceholder}>
                      <Text style={styles.servicePlaceholderText}>{service.categoryIcon || '🐾'}</Text>
                    </View>
                  )}

                  <View style={styles.serviceContent}>
                    <Text style={styles.serviceName} numberOfLines={1}>{service.serviceName}</Text>
                    {!!service.providerName && (
                      <Text style={styles.serviceProvider} numberOfLines={1}>by {service.providerName}</Text>
                    )}
                    {!!priceLabel && <Text style={styles.servicePrice}>{priceLabel}</Text>}
                    {!!service.serviceDescription && (
                      <Text style={styles.serviceDescription} numberOfLines={2}>
                        {service.serviceDescription}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No pet services listed right now</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => router.push('/(app)/serviceslist' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.viewAllText}>View All Pet Services</Text>
        </TouchableOpacity>
      </View>
    );
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
    const previewPets = pets.slice(0, 4);
    const countLabel = `${pets.length} listing${pets.length === 1 ? '' : 's'}`;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>
              {emoji} {title}
            </Text>
            <Text style={styles.petCount}>{countLabel}</Text>
          </View>

          <TouchableOpacity
            style={styles.sectionActionButton}
            onPress={() => handleCreateByType(postType)}
            activeOpacity={0.85}
          >
            <Text style={styles.sectionActionText}>{getPostActionLabel(postType)}</Text>
          </TouchableOpacity>
        </View>

        {pets.length > 0 ? (
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
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No {postType === 'adoption' ? 'adoption listings' : `${postType} pets`} at the moment
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
          activeOpacity={0.85}
        >
          <Text style={styles.viewAllText}>View All {title}</Text>
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
      <View style={styles.header}>
        <Text style={styles.pageTitle}>🐾 The Pet Corner</Text>
        <Text style={styles.pageSubtitle}>
          Lost pets, found pets, adoption listings, and local pet services.
        </Text>
      </View>

      <PetServicesSection />

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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  petCount: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  sectionActionButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'center',
  },
  sectionActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 12,
  },
  petsGridItem: {
    width: '48%',
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 12,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#dbeafe',
  },
  serviceImagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicePlaceholderText: {
    fontSize: 32,
  },
  serviceContent: {
    padding: 10,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  serviceProvider: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  servicePrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f766e',
    marginTop: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 17,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  viewAllButton: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  footer: {
    height: 20,
  },
});
