
import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import GridListingCard from '../../components/GridListingCard';
import { app } from '../../firebase';

const NUM_COLUMNS = 3;
const PAGE_SIZE = 12; // 4 rows × 3 columns

export default function AllListings() {
  const [allListings, setAllListings] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const db = getFirestore(app);
        const q = query(collection(db, 'listings'), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map(doc => {
            const data = doc.data() as any;
            return { id: doc.id, ...data };
          })
          .filter(listing => Array.isArray(listing.images) && listing.images.length > 0);
        setAllListings(fetched);
      } catch (error) {
        setAllListings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const listings = allListings.slice(0, visibleCount);
  const hasMore = visibleCount < allListings.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, allListings.length));
    }
  }, [hasMore, allListings.length]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const createdAtMs = item.createdAt
      ? (item.createdAt.toMillis ? item.createdAt.toMillis() : new Date(item.createdAt).getTime())
      : undefined;

    return (
      <View style={styles.cardWrapper}>
        <GridListingCard
          title={item.title || ''}
          price={String(item.price ?? '')}
          category={item.category}
          viewCount={typeof item.viewCount === 'number' ? item.viewCount : undefined}
          createdAt={createdAtMs}
          city={item.city}
          location={item.location || item.zipCode}
          isFeatured={Boolean(item.isFeatured)}
          imageSource={Array.isArray(item.images) && item.images[0] ? { uri: item.images[0] } : undefined}
          onPress={() => router.push({ pathname: '/listing', params: { id: item.id } })}
        />
      </View>
    );
  }, [router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (allListings.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No listings found.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={styles.row}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        hasMore ? (
          <ActivityIndicator style={{ marginVertical: 16 }} size="small" color="#94a3b8" />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  listContent: {
    padding: 8,
    backgroundColor: '#fff',
  },
  row: {
    justifyContent: 'space-between',
  },
  cardWrapper: {
    flex: 1,
    maxWidth: `${100 / NUM_COLUMNS}%`,
    padding: 4,
  },
});
