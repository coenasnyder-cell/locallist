import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { app } from '../../firebase';

const CATEGORIES = [
  { id: 'home-repair',    label: 'Home Repair',        icon: '🔨' },
  { id: 'lawn-garden',    label: 'Lawn & Garden',      icon: '🌿' },
  { id: 'cleaning',       label: 'Cleaning',           icon: '🧹' },
  { id: 'plumbing',       label: 'Plumbing',           icon: '🚰' },
  { id: 'electrical',     label: 'Electrical',         icon: '⚡' },
  { id: 'hvac',           label: 'HVAC',               icon: '❄️' },
  { id: 'painting',       label: 'Painting',           icon: '🎨' },
  { id: 'carpentry',      label: 'Carpentry',          icon: '🪚' },
  { id: 'moving',         label: 'Moving & Hauling',   icon: '🚚' },
  { id: 'childcare',      label: 'Childcare',          icon: '👶' },
  { id: 'tutoring',       label: 'Tutoring',           icon: '📚' },
  { id: 'pet-care',       label: 'Pet Care',           icon: '🐾' },
  { id: 'beauty',         label: 'Beauty & Wellness',  icon: '💇' },
  { id: 'auto',           label: 'Auto Services',      icon: '🚗' },
  { id: 'photography',    label: 'Photography',        icon: '📷' },
  { id: 'tech',           label: 'Tech Support',       icon: '💻' },
  { id: 'event-planning', label: 'Event Planning',     icon: '🎉' },
  { id: 'construction',   label: 'Construction',       icon: '🏗️' },
  { id: 'food-catering',  label: 'Food & Catering',    icon: '🍽️' },
  { id: 'fitness',        label: 'Fitness & Training', icon: '🏋️' },
  { id: 'other',          label: 'Other',              icon: '📋' },
];

interface ServiceListing {
  id: string;
  serviceName: string;
  providerName?: string;
  category?: string;
  categoryIcon?: string;
  serviceDescription?: string;
  serviceImage?: string;
  priceType?: string;
  priceAmount?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
  serviceArea?: string | null;
  isFeatured?: boolean;
  userId: string;
}

function isApprovedService(data: any): boolean {
  const status = String(data?.status || '').toLowerCase();
  const approvalStatus = String(data?.approvalStatus || '').toLowerCase();

  if (data?.isApproved === true) return true;
  if (approvalStatus === 'approved') return true;
  return status === 'approved';
}

const PRICE_LABELS: Record<string, string> = {
  hourly: '/hr',
  fixed: ' flat',
  quote: 'Free Quote',
  negotiable: 'Negotiable',
};

export default function ServicesList() {
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const router = useRouter();
  const categoryOptions = ['All', ...CATEGORIES.map((c) => c.label)];

  useEffect(() => {
    fetchServiceListings();
  }, []);

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    const catFilter = selectedCategory.toLowerCase();

    const filtered = listings.filter((item) => {
      const matchesSearch =
        query === '' ||
        item.serviceName.toLowerCase().includes(query) ||
        (item.serviceDescription || '').toLowerCase().includes(query) ||
        (item.providerName || '').toLowerCase().includes(query);

      const matchesCategory =
        catFilter === 'all' ||
        (item.category || '').toLowerCase() === catFilter;

      return matchesSearch && matchesCategory;
    });

    setFilteredListings(filtered);
  }, [searchQuery, listings, selectedCategory]);

  useEffect(() => {
    setCategoryDropdownOpen(false);
  }, [selectedCategory]);

  const fetchServiceListings = async () => {
    try {
      const db = getFirestore(app);
      const snapshot = await getDocs(collection(db, 'services'));
      const results: ServiceListing[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Public list should only include approved and active services.
        if (data.isActive === false) return;
        if (!isApprovedService(data)) return;

        results.push({
          id: docSnap.id,
          serviceName: data.serviceName || 'Service',
          providerName: data.providerName || '',
          category: data.category || '',
          categoryIcon: data.categoryIcon || '',
          serviceDescription: data.serviceDescription || '',
          serviceImage: data.serviceImage || '',
          priceType: data.priceType || '',
          priceAmount: data.priceAmount || null,
          contactPhone: data.contactPhone || null,
          contactEmail: data.contactEmail || null,
          contactWebsite: data.contactWebsite || null,
          serviceArea: data.serviceArea || null,
          isFeatured: data.isFeatured || false,
          userId: data.userId,
        });
      });

      setListings(results);
      setFilteredListings(results);
    } catch (error) {
      console.error('Error fetching service listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWebsite = (website: string) => {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    Linking.openURL(url);
  };

  const handleOpenService = (id: string) => {
    router.push({ pathname: '/(app)/service-details', params: { id } });
  };

  const formatPrice = (item: ServiceListing) => {
    if (!item.priceType) return null;
    if (item.priceType === 'quote') return 'Free Quote';
    if (item.priceType === 'negotiable') return 'Negotiable';
    if (item.priceAmount) {
      return `$${item.priceAmount}${PRICE_LABELS[item.priceType] || ''}`;
    }
    return null;
  };

  const renderCard = (item: ServiceListing) => {
    const price = formatPrice(item);

    return (
      <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.88} onPress={() => handleOpenService(item.id)}>
        {item.isFeatured && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>⭐ Featured</Text>
          </View>
        )}

        {item.serviceImage ? (
          <Image source={{ uri: item.serviceImage }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImageIcon}>{item.categoryIcon || '🧰'}</Text>
          </View>
        )}

        <View style={styles.cardContent}>
          {item.category ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {item.categoryIcon} {item.category}
              </Text>
            </View>
          ) : null}

          <Text style={styles.serviceName} numberOfLines={1}>{item.serviceName}</Text>

          {item.providerName ? (
            <Text style={styles.providerName} numberOfLines={1}>by {item.providerName}</Text>
          ) : null}

          {price ? (
            <Text style={styles.price}>{price}</Text>
          ) : null}

          {!!item.serviceDescription && (
            <Text style={styles.description} numberOfLines={3}>
              {item.serviceDescription}
            </Text>
          )}

          {item.contactPhone && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleCall(item.contactPhone!)}>
              <Text style={styles.contactText}>📱 {item.contactPhone}</Text>
            </TouchableOpacity>
          )}

          {item.contactWebsite && (
            <TouchableOpacity style={styles.contactRow} onPress={() => handleWebsite(item.contactWebsite!)}>
              <Text style={styles.contactText} numberOfLines={1}>🌐 Visit Website</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.viewDetailsText}>View details</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const featuredListings = filteredListings.filter((l) => l.isFeatured).slice(0, 6);
  const resultsTitle = selectedCategory === 'All' ? 'All Services' : `${selectedCategory} Services`;

  return (
    <ScrollView style={styles.container}>
      <BackToCommunityHubRow />

      <View style={styles.header}>
        <Text style={styles.title}>Local Services</Text>

        <View style={styles.heroRow}>
          <Image
            source={require('../../assets/images/serviceshub.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.postButton}
            onPress={() => router.push('/(app)/create-service-listing')}
          >
            <Text style={styles.postButtonText}>+ Post a Service</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchPanel}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or description"
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
                {categoryOptions.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                      onPress={() => setSelectedCategory(cat)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading services...</Text>
      ) : filteredListings.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Services Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery || selectedCategory !== 'All'
              ? 'Try adjusting your search or category filter.'
              : 'No services have been posted yet. Be the first!'}
          </Text>
        </View>
      ) : (
        <>
          {featuredListings.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Featured Services</Text>
                <Text style={styles.sectionSubtitle}>Highlighted local services you may want to explore first.</Text>
              </View>
              <View style={styles.gridContainer}>
                {featuredListings.map(renderCard)}
              </View>
            </>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{resultsTitle}</Text>
            <Text style={styles.sectionSubtitle}>Browse services available in your community.</Text>
          </View>
          <View style={styles.gridContainer}>
            {filteredListings.map(renderCard)}
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
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  heroImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#cbd5e1',
  },
  postButton: {
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
    alignSelf: 'center',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
    color: '#334155',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#0f766e',
    fontWeight: '700',
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
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B4513',
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#e8f5f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageIcon: {
    fontSize: 36,
  },
  cardContent: {
    padding: 10,
  },
  categoryBadge: {
    backgroundColor: '#e8f5f3',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0F766E',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 2,
  },
  providerName: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginBottom: 6,
  },
  contactRow: {
    marginTop: 4,
    paddingVertical: 4,
  },
  contactText: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
  },
  reportButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#0f766e',
    fontWeight: '700',
    marginTop: 8,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
