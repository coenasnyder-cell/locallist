import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { app } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';

interface ShopLocalProfile {
  id: string;
  businessName: string;
  businessCategory?: string;
  businessCity?: string;
  businessMotto?: string;
  listingType?: string;
  businessDescription?: string;
  businessLogo?: string;
  businessPhotoSingle?: string;
  businessImages?: string[];
  businessPhone?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessTier?: 'free' | 'premium';
  userId: string;
  displayName?: string;
  isVerified?: boolean | number | string;
}

export default function ShopLocalList() {
  const DEFAULT_CATEGORIES = ['Restaurant', 'Retail', 'Salon', 'Mechanic', 'Contractor', 'Home Services', 'Food Truck', 'Gym', 'Church', 'Thrift Store'];
  const [profiles, setProfiles] = useState<ShopLocalProfile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<ShopLocalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const router = useRouter();
  const { isBusinessAccount } = useAccountStatus();

  useEffect(() => {
    console.log('[ShopLocalList] mounted');
    return () => console.log('[ShopLocalList] unmounted');
  }, []);

  const normalizeValue = (value?: string | null) => String(value || '').trim().toLowerCase();
  const isBusinessVerified = (profile: ShopLocalProfile) => {
    const verifiedValue = profile.isVerified;
    const normalizedVerified = String(verifiedValue ?? '').trim().toLowerCase();
    return verifiedValue === true || verifiedValue === 1 || normalizedVerified === 'true' || normalizedVerified === '1';
  };

  useEffect(() => {
    fetchShopLocalProfiles();
    fetchBusinessCategories();
  }, []);

  useEffect(() => {
    const activeCategory = normalizeValue(selectedCategory);

    const filtered = profiles.filter((profile) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        profile.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (profile.businessDescription || '').toLowerCase().includes(searchQuery.toLowerCase());

      const profileCategory = normalizeValue(profile.businessCategory);
      const matchesCategory = activeCategory === 'all' || profileCategory === activeCategory;

      return matchesSearch && matchesCategory;
    });

    setFilteredProfiles(filtered);
  }, [searchQuery, profiles, selectedCategory]);

  useEffect(() => {
    setCategoryDropdownOpen(false);
  }, [selectedCategory]);

  const formatCategoryLabel = (raw: string): string => {
    return raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const fetchBusinessCategories = async () => {
    try {
      const db = getFirestore(app);
      const categorySet = new Set<string>();

      const hydrateFromSnapshot = (snapshot: Awaited<ReturnType<typeof getDocs>>) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          console.log('Category document data:', data);
          
          // Extract from field names and values
          Object.entries(data).forEach(([key, value]) => {
            // Prefer non-empty string values, but also use field names
            if (typeof value === 'string' && value.trim().length > 0) {
              const formatted = formatCategoryLabel(value);
              categorySet.add(formatted);
              console.log('Added from value:', value, '->', formatted);
            } else if (Array.isArray(value)) {
              value.forEach((entry) => {
                if (typeof entry === 'string' && entry.trim().length > 0) {
                  const formatted = formatCategoryLabel(entry);
                  categorySet.add(formatted);
                  console.log('Added from array:', entry, '->', formatted);
                }
              });
            } else if (key && key.trim().length > 0 && !key.startsWith('_')) {
              // Add field name as category if value is empty or not applicable
              const formatted = formatCategoryLabel(key);
              categorySet.add(formatted);
              console.log('Added from key:', key, '->', formatted);
            }
          });
        });
      };

      console.log('Fetching from businessCategory collection...');
      const primarySnapshot = await getDocs(collection(db, 'businessCategory'));
      console.log('Business category docs found:', primarySnapshot.docs.length);
      if (primarySnapshot.docs.length > 0) {
        hydrateFromSnapshot(primarySnapshot);
      }

      // Backward-compatible fallback where categories may be stored under a pluralized collection.
      if (categorySet.size === 0) {
        try {
          console.log('No categories from primary, trying businessCategories fallback...');
          const fallbackSnapshot = await getDocs(collection(db, 'businessCategories'));
          console.log('Business categories docs found:', fallbackSnapshot.docs.length);
          hydrateFromSnapshot(fallbackSnapshot);
        } catch (e) {
          console.log('Fallback failed:', e);
        }
      }

      const list = Array.from(categorySet).sort((a, b) => a.localeCompare(b));
      console.log('Final categories list:', list);
      setCategories(list.length > 0 ? list : DEFAULT_CATEGORIES);
    } catch (error) {
      console.error('Error fetching business categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const fetchShopLocalProfiles = async () => {
    try {
      const db = getFirestore(app);
      let profilesSnapshot = await getDocs(collection(db, 'businessLocal'));
      if (profilesSnapshot.empty) {
        profilesSnapshot = await getDocs(collection(db, 'shopLocal'));
      }
      const allProfiles: ShopLocalProfile[] = [];

      for (const docSnap of profilesSnapshot.docs) {
        const profileData = docSnap.data();
        
        // Filter: Only show businesses with listing type 'shopLocal' or 'both'
        if (profileData.listingType !== 'shopLocal' && profileData.listingType !== 'both') {
          continue; // Skip this business
        }
        
        // Get user info for display name
        let userName = 'Business';
        try {
          const userSnap = await getDoc(doc(db, 'users', profileData.userId));
          if (userSnap.exists()) {
            userName = userSnap.data().displayName || 'Business';
          }
        } catch (e) {
          console.log('Could not fetch user info:', e);
        }

        allProfiles.push({
          id: docSnap.id,
          businessName: profileData.businessName || 'Business',
          businessCategory: profileData.businessCategory || '',
          businessCity: profileData.businessCity || '',
          businessMotto: profileData.businessMotto || '',
          listingType: profileData.listingType,
          businessDescription: profileData.businessDescription,
          businessLogo: profileData.businessLogo,
          businessPhotoSingle: profileData.businessPhotoSingle || profileData.businessPhotosingle || '',
          businessImages: Array.isArray(profileData.businessImages)
            ? profileData.businessImages.filter((img: unknown) => typeof img === 'string' && img.trim().length > 0)
            : [],
          businessPhone: profileData.businessPhone,
          businessWebsite: profileData.businessWebsite,
          businessAddress: profileData.businessAddress,
          businessTier: profileData.businessTier || 'free',
          userId: profileData.userId,
          displayName: userName,
          isVerified: profileData.isVerified,
        });
      }

      setProfiles(allProfiles);
      setFilteredProfiles(allProfiles);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setProfiles([]);
      setFilteredProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWebsite = (website: string) => {
    const normalizedWebsite = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    Linking.openURL(normalizedWebsite);
  };

  const handleViewDetails = (profile: ShopLocalProfile) => {
    router.push({
      pathname: '/(app)/businessprofile',
      params: { id: profile.id || profile.userId },
    });
  };

  const handleAddBusinessPress = () => {
    router.push(isBusinessAccount ? '/(app)/businesslocal' as any : '/(app)/premium-upgrade' as any);
  };

  const handleViewDetailsAlert = (profile: ShopLocalProfile) => {
    Alert.alert(
      profile.businessName,
      `${profile.businessDescription || 'No description available'}\n\n` +
      `${profile.businessAddress ? `📍 ${profile.businessAddress}\n` : ''}` +
      `${profile.businessPhone ? `📱 ${profile.businessPhone}\n` : ''}` +
      `${profile.businessWebsite ? `🌐 ${profile.businessWebsite}` : ''}`,
      [
        { text: 'Close', style: 'cancel' },
        ...(profile.businessPhone ? [{ text: 'Call', onPress: () => handleCall(profile.businessPhone!) }] : []),
        ...(profile.businessWebsite ? [{ text: 'Visit Website', onPress: () => handleWebsite(profile.businessWebsite!) }] : []),
      ]
    );
  };

  const renderProfileCard = (profile: ShopLocalProfile) => {
    const isPremium = profile.businessTier === 'premium';
    const isVerified = isBusinessVerified(profile);
    const profileImage =
      String(profile.businessPhotoSingle || '').trim() ||
      (Array.isArray(profile.businessImages) && profile.businessImages.length > 0 ? profile.businessImages[0] : '') ||
      String(profile.businessLogo || '').trim();
    const categoryLabel = profile.businessCategory ? formatCategoryLabel(profile.businessCategory) : 'Uncategorized';
    const locationLabel = profile.businessCity || 'Location not listed';
    const mottoLabel = String(profile.businessMotto || '').trim();

    return (
      <TouchableOpacity 
        key={profile.id} 
        style={styles.card}
        onPress={() => handleViewDetails(profile)}
        activeOpacity={0.8}
      >
        {isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>Premium Featured</Text>
          </View>
        )}

        {profileImage ? (
          <Image source={{ uri: profileImage }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder} />
        )}

        <View style={styles.cardContent}>
          <Text style={styles.businessName} numberOfLines={1}>{profile.businessName}</Text>

          {isVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>Local Business Verified</Text>
            </View>
          ) : null}

          <Text style={styles.metaLine} numberOfLines={1}>{categoryLabel}</Text>
          <Text style={styles.metaLine} numberOfLines={1}>📍 {locationLabel}</Text>
          {mottoLabel ? (
            <Text style={styles.mottoLine} numberOfLines={2}>{mottoLabel}</Text>
          ) : null}

          <View style={styles.viewDetailsButton}>
            <Text style={styles.viewDetailsButtonText}>View Details</Text>
          </View>

        </View>
      </TouchableOpacity>
    );
  };

  const featuredProfiles = filteredProfiles.filter((profile) => profile.businessTier === 'premium').slice(0, 6);

  const resultsTitle = selectedCategory === 'All'
    ? 'Local Business Listings'
    : `${formatCategoryLabel(selectedCategory)} Local Businesses`;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <ScreenTitleRow
          title="Local Businesses"
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/(tabs)/communitybutton');
          }}
        />
        <View style={styles.benefitsRow}>
          <Image
            source={require('../../assets/images/businsshub.png')}
            style={styles.benefitsImage}
            contentFit="cover"
          />
          <TouchableOpacity
            style={styles.createProfileButton}
            onPress={handleAddBusinessPress}
          >
            <Text style={styles.createProfileButtonText}>
              {isBusinessAccount ? 'Update Business Profile' : 'Add A Business'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchPanel}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by business name or description"
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <Text style={styles.categoryLabel}>Category</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setCategoryDropdownOpen((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Text style={styles.dropdownButtonText}>{selectedCategory}</Text>
            <Text style={styles.dropdownChevron}>{categoryDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {categoryDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                {['All', ...categories].map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                      onPress={() => setSelectedCategory(category)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading businesses...</Text>
      ) : filteredProfiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Businesses Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery || selectedCategory !== 'All' ? 'Try adjusting your search or category filter.' : 'Check back later for new businesses.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Local Businesses</Text>
            <Text style={styles.sectionSubtitle}>Highlighted premium businesses from your community</Text>
          </View>
          <View style={styles.gridContainer}>
            {featuredProfiles.length > 0
              ? featuredProfiles.map(renderProfileCard)
              : <Text style={styles.emptyText}>No featured businesses yet.</Text>}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{resultsTitle}</Text>
            <Text style={styles.sectionSubtitle}>Browse the latest local businesses in this category.</Text>
          </View>
          <View style={styles.gridContainer}>
            {filteredProfiles.map(renderProfileCard)}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  benefitsRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'column',
  },
  benefitsImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#cbd5e1',
  },
  benefitsContent: {
    padding: 16,
    alignItems: 'center',
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  benefitsText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  createProfileButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'center',
  },
  createProfileButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  searchPanel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  dropdownButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#e8f5f3',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: '#0f766e',
    fontWeight: '700',
  },
  gridContainer: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  sectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: '1%',
    width: '48%',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  premiumBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#e2e8f0',
  },
  cardContent: {
    padding: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  mottoLine: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 10,
  },
  viewDetailsButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
  },
  viewDetailsButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  claimButton: {
    marginTop: 8,
    backgroundColor: '#475569',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
