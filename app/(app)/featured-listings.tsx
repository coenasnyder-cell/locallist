import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { app } from '../../firebase';
import { filterListingsWithExistingUsers } from '../../utils/listingOwners';
import { isListingVisible } from '../../utils/listingVisibility';

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardMargin = 10;
const cardWidth = (screenWidth - cardMargin * (numColumns * 2 + 2)) / numColumns;

export default function FeaturedListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const db = getFirestore(app);
        const listingsRef = collection(db, 'listings');
        // Match Home featured logic: featured + approved listings
        const q = query(listingsRef, where('isFeatured', '==', true), where('status', '==', 'approved'));

        const [snapshot, reportedSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(
            query(
              collection(db, 'reportedListings'),
              where('status', 'in', ['pending', 'reviewed', 'action_taken'])
            )
          ),
        ]);
        const excludedListingIds = new Set(
          reportedSnapshot.docs
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );
        const nowMs = Date.now();
        const fetchedListings: any[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!isListingVisible(data, docSnap.id, { nowMs, excludedListingIds })) {
            return;
          }
          fetchedListings.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort by createdAt (newest first)
        const getDate = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime();
          if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          }
          return 0;
        };

        const listingsWithExistingOwners = await filterListingsWithExistingUsers(db, fetchedListings);
        const sorted = listingsWithExistingOwners.sort((a, b) => getDate(b.createdAt) - getDate(a.createdAt));
        setListings(sorted);
      } catch (error) {
        console.error('Error fetching featured listings:', error);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const handlePress = (id: string) => {
    router.push({ pathname: '/listing', params: { id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <BackToCommunityHubRow />
        <Text style={styles.pageTitle}>✨ Featured Listings</Text>
        <Text style={styles.pageSubtitle}>Premium and Editor's Pick listings in one place</Text>
        {loading ? (
          <Text style={styles.loading}>Loading...</Text>
        ) : listings.length === 0 ? (
          <Text style={styles.loading}>No featured listings found.</Text>
        ) : (
          <View style={styles.gridContainer}>
            {listings.map(listing => (
              <TouchableOpacity style={styles.card} key={listing.id} onPress={() => handlePress(listing.id)} activeOpacity={0.8}>
                {listing.featureTier === 'premium' && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>⭐ PREMIUM</Text>
                  </View>
                )}
                {listing.featureTier === 'basic' && (
                  <View style={styles.basicBadge}>
                    <Text style={styles.basicBadgeText}>📌 PICK</Text>
                  </View>
                )}
                <Image
                  source={{ uri: listing.images[0] }}
                  style={styles.image}
                  resizeMode="cover"
                />
                <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
                <Text style={styles.priceZip}>
                  {listing.price ? `$${listing.price}` : ''}
                  {listing.zipCode ? `  |  ${listing.zipCode}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 10,
    flexGrow: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loading: {
    textAlign: 'center',
    color: '#888',
    fontSize: 16,
    marginTop: 32,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: cardWidth,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: cardMargin * 2,
    marginHorizontal: cardMargin,
    padding: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    position: 'relative',
  },
  image: {
    width: cardWidth - 20,
    height: cardWidth - 20,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ddd',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
    textAlign: 'center',
  },
  priceZip: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  premiumBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8B6914',
  },
  basicBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  basicBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
