import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../components/Header';
import PetCard from '../components/PetCard';
import { app } from '../firebase';
import { Pet } from '../types/Pet';

type PetCategory = 'all' | 'lost' | 'found' | 'adoption';

const CATEGORIES: { key: PetCategory; label: string; emoji: string }[] = [
  { key: 'all', label: 'All Categories', emoji: '🐾' },
  { key: 'lost', label: 'Lost Pets', emoji: '🔍' },
  { key: 'found', label: 'Found Pets', emoji: '✨' },
  { key: 'adoption', label: 'Adopt a Pet', emoji: '💕' },
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

  const handleCategoryChange = (category: PetCategory) => {
    setSelectedCategory(category);
  };

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

      <View style={styles.backRowWrap}>
        <TouchableOpacity
          style={styles.backRowButton}
          onPress={navigateToPetHub}
          activeOpacity={0.85}
        >
          <Text style={styles.backRowButtonText}>{'<Back To The Pet Corner'}</Text>
        </TouchableOpacity>
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

      {/* Category Tabs */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.key}
              style={[
                styles.categoryButton,
                selectedCategory === category.key && styles.categoryButtonActive,
              ]}
              onPress={() => handleCategoryChange(category.key)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.key && styles.categoryTextActive,
                ]}
              >
                {category.emoji} {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          <Text style={styles.resultsTitle}>
            {CATEGORIES.find((c) => c.key === selectedCategory)?.emoji}{' '}
            {CATEGORIES.find((c) => c.key === selectedCategory)?.label}
          </Text>
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
            <Text style={styles.emptyEmoji}>🐾</Text>
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
  backRowWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
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
  categoryContainer: {
    backgroundColor: '#fff',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#0066cc',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
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
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
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
