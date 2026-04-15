import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../components/Header';
import PetCard from '../components/PetCard';
import ScreenTitleRow from '../components/ScreenTitleRow';
import { app } from '../firebase';
import { Pet } from '../types/Pet';

type PetCategory = 'all' | 'lost' | 'found' | 'adoption';

const CATEGORIES: { key: PetCategory; label: string }[] = [
  { key: 'all', label: 'All Categories' },
  { key: 'lost', label: 'Lost Pets' },
  { key: 'found', label: 'Found Pets' },
  { key: 'adoption', label: 'Adopt a Pet' },
];

export default function BrowsePetsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategory = (params.category as PetCategory) || 'all';
  const [selectedCategory, setSelectedCategory] = useState<PetCategory>(
    initialCategory
  );
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const navigateToPetHub = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/petbutton' as any);
  }, [router]);

  useEffect(() => {
    fetchPets();
  }, [selectedCategory]);

  const fetchPets = async () => {
    try {
      setLoading(true);
      const db = getFirestore(app);
      const petsRef = collection(db, 'pets');

      const petsQuery =
        selectedCategory === 'all'
          ? query(petsRef, orderBy('createdAt', 'desc'))
          : query(
              petsRef,
              where('postType', '==', selectedCategory),
              orderBy('createdAt', 'desc')
            );
      const petsSnapshot = await getDocs(petsQuery);
      const petsData = petsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      setPets(petsData);
    } catch (error) {
      console.error('Error fetching pets:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPets().then(() => setRefreshing(false));
  }, [selectedCategory]);

  const handlePetPress = (pet: Pet) => {
    router.push({
      pathname: '/pet-details' as any,
      params: {
        petId: pet.id,
        postType: pet.postType,
      },
    });
  };

  const selectedCategoryLabel = CATEGORIES.find((category) => category.key === selectedCategory)?.label || 'All Categories';

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredPets = normalizedQuery
    ? pets.filter((pet) => {
        const searchableText = [
          pet.petName,
          pet.petType,
          pet.petBreed,
          pet.petDescription,
          pet.petSeenLocation,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      })
    : pets;

  return (
    <View style={{ flex: 1 }}>
      <Header />

      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow title="Browse Pets" onBackPress={navigateToPetHub} />
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by pet name, breed, or location"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#8a8f98"
        />
      </View>

      <View style={styles.categoryWrap}>
        <TouchableOpacity
          style={styles.categoryDropdownButton}
          onPress={() => setCategoryDropdownOpen((open) => !open)}
          activeOpacity={0.86}
        >
          <Text style={styles.categoryDropdownButtonText}>{selectedCategoryLabel}</Text>
          <Text style={styles.categoryDropdownChevron}>{categoryDropdownOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {categoryDropdownOpen ? (
          <View style={styles.categoryDropdownMenu}>
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category.key;
              return (
                <TouchableOpacity
                  key={category.key}
                  style={[styles.categoryDropdownItem, active ? styles.categoryDropdownItemActive : null]}
                  onPress={() => {
                    setSelectedCategory(category.key);
                    setCategoryDropdownOpen(false);
                  }}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.categoryDropdownItemText, active ? styles.categoryDropdownItemTextActive : null]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Results */}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>{selectedCategoryLabel}</Text>
          <Text style={styles.resultsCount}>({filteredPets.length})</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.loadingText}>Loading pets...</Text>
          </View>
        ) : filteredPets.length > 0 ? (
          <View style={styles.petsGrid}>
            {filteredPets.map((pet) => (
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
            <Text style={styles.emptyTitle}>No pets found</Text>
            <Text style={styles.emptyText}>
              {normalizedQuery
                ? selectedCategory === 'all'
                  ? 'No pets matched your search.'
                  : `No ${selectedCategory} pets matched your search.`
                : selectedCategory === 'all'
                  ? 'There are currently no pets listed right now.'
                  : `There are currently no ${selectedCategory} pets in this category.`}
            </Text>
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  screenTitleRowWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  searchWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ef',
    borderRadius: 10,
    minHeight: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1f2937',
  },
  categoryWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    zIndex: 20,
  },
  categoryDropdownButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryDropdownButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  categoryDropdownChevron: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryDropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  categoryDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryDropdownItemActive: {
    backgroundColor: '#f8fafc',
  },
  categoryDropdownItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  categoryDropdownItemTextActive: {
    color: '#0f172a',
    fontWeight: '700',
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  resultsCount: {
    fontSize: 16,
    color: '#999',
    marginLeft: 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  petsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  petsGridItem: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  emptyState: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    height: 40,
  },
});
