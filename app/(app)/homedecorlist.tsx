import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../../firebase';

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardMargin = 10;
const cardWidth = (screenWidth - cardMargin * (numColumns * 2 + 2)) / numColumns;


export default function AllListings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const db = getFirestore(app);
          const q = query(
            collection(db, 'listings'),
            where('status', '==', 'approved'),
            where('category', '==', 'Home Decor')
          );
        const snapshot = await getDocs(q);
        const fetched = snapshot.docs
          .map(doc => {
            const data = doc.data() as any;
            return { id: doc.id, ...data };
          })
          .filter(listing => Array.isArray(listing.images) && listing.images.length > 0);
        setListings(fetched);
      } catch (error) {
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
      {loading ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : listings.length === 0 ? (
        <Text style={styles.loading}>No listings found.</Text>
      ) : (
        <View style={styles.gridContainer}>
          {listings.map(listing => (
            <TouchableOpacity style={styles.card} key={listing.id} onPress={() => handlePress(listing.id)} activeOpacity={0.8}>
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
});
