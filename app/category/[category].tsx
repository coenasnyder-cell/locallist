import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ListingCard from '../../components/ListingCard';
import { app } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { isUserBlocked } from '../../utils/blockService';
import { isListingVisible } from '../../utils/listingVisibility';

export default function CategoryPage() {
  const { category } = useLocalSearchParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { profile } = useAccountStatus();

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      try {
        const db = getFirestore(app);
        let q;
        if (category === 'All') {
          q = query(collection(db, 'listings'));
        } else {
          q = query(collection(db, 'listings'), where('category', '==', category));
        }
        const [querySnapshot, reportedSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
        ]);

        const excludedListingIds = new Set(
          reportedSnapshot.docs
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );

        const nowMs = Date.now();
        const fetchedListings: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!isListingVisible(data, docSnap.id, { nowMs, excludedListingIds })) {
            return;
          }
          fetchedListings.push({ id: docSnap.id, ...data });
        });
        setListings(fetchedListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
      }
      setLoading(false);
    };
    fetchListings();
  }, [category]);

  const filteredListings = listings.filter(item => {
    const notBlocked = !item.userId || !isUserBlocked(profile, item.userId);
    return notBlocked;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{category} Listings</Text>
      <View style={styles.listingsContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <Text>Loading...</Text>
          ) : filteredListings.length === 0 ? (
            <Text>No listings found.</Text>
          ) : (
            filteredListings.map(listing => (
              <ListingCard
                key={listing.id}
                title={listing.title}
                subtitle={listing.subtitle}
                imageSource={listing.imageSource}
                onPress={() => router.push({ pathname: '../(app)/listing', params: { id: listing.id } })}
              />
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingTop: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#475569',
  },
  listingsContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
