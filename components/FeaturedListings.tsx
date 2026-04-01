import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { app } from '../firebase';
import { Listing } from '../types/Listing';
import GridListingCard from './GridListingCard';

interface FeaturedListingsProps {
  tier: 'premium' | 'basic';
  title?: string;
  subtitle?: string;
  onListingPress?: (listingId: string) => void;
}

export default function FeaturedListings({ 
  tier, 
  title = tier === 'premium' ? '✨ Featured' : '📌 Editor\'s Picks',
  subtitle = tier === 'premium' ? 'Promoted for maximum visibility' : 'Hand-picked for you',
  onListingPress 
}: FeaturedListingsProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedListings();
  }, [tier]);

  const fetchFeaturedListings = async () => {
    try {
      const db = getFirestore(app);
      const listingsRef = collection(db, 'listings');
      
      // Query for featured listings that are approved
      // For premium tier, use isFeatured. For basic tier (Editor's Picks), would need a separate field
      let q;
      if (tier === 'premium') {
        q = query(
          listingsRef,
          where('isFeatured', '==', true),
          where('status', '==', 'approved')
        );
      } else {
        // Basic tier (Editor's Picks) - for now, return empty
        // TODO: Add 'isEditorsPick' field to listings to distinguish editor picks
        setListings([]);
        setLoading(false);
        return;
      }

      const snapshot = await getDocs(q);
      const fetchedListingsPromises: Promise<Listing | null>[] = [];

      console.log(`[${tier}] Query: isFeatured='true' AND status='approved'`);
      console.log(`[${tier}] Found ${snapshot.docs.length} listings matching query`);

      snapshot.forEach((listingDoc) => {
        const data = listingDoc.data() as Listing;
        
        const listingPromise = (async () => {
          // All matched listings are isFeatured and approved, so just return them
          return {
            ...data,
            id: listingDoc.id,
          };
        })();
        
        fetchedListingsPromises.push(listingPromise);
      });

      const fetchedListings = (await Promise.all(fetchedListingsPromises)).filter(
        (item): item is Listing => item !== null
      );

      // Defensive sort: handle missing or invalid createdAt
      const getDate = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime();
        if (typeof val === 'string' || typeof val === 'number') {
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        return 0;
      };
      const sorted = fetchedListings
        .sort((a, b) => getDate(b.createdAt) - getDate(a.createdAt))
        .slice(0, 6);

      setListings(sorted);
    } catch (error) {
      console.error('Error fetching featured listings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Featured Listings</Text>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (listings.length === 0) {
    // Show empty state for both basic and premium tiers
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {tier === 'basic' ? 'No editor\'s picks yet. Check back soon!' : 'No featured listings available at this time.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      
      <View style={styles.gridContainer}>
        {listings.slice(0, 6).map((listing) => (
          <View key={listing.id} style={styles.cardWrapper}>
            <GridListingCard
              title={listing.title}
              price={typeof listing.price === 'number' ? `$${listing.price}` : `$${parseFloat(listing.price || '0').toFixed(2)}`}
              location={listing.zipCode || ''}
              imageSource={Array.isArray(listing.images) && listing.images.length > 0 ? { uri: listing.images[0] } : undefined}
              onPress={() => onListingPress?.(listing.id)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  headerContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    fontWeight: '500',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    gap: 12,
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8B4513',
    letterSpacing: 0.3,
  },
  loadingText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
