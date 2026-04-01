

import { useLocalSearchParams } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import SingleListing, { Listing } from '../../components/SingleListing';
import { app } from '../../firebase';
import { isListingVisible } from '../../utils/listingVisibility';


export default function ListingScreen() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const db = getFirestore(app);
        const [querySnapshot, reportedSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'listings'), where('status', '==', 'approved'))),
          getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
        ]);

        const excludedListingIds = new Set(
          reportedSnapshot.docs
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );

        const now = new Date().getTime();
        const fetchedListings: Listing[] = querySnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return isListingVisible(data, doc.id, {
              nowMs: now,
              excludedListingIds,
            });
          })
          .map(doc => ({ id: doc.id, ...doc.data() })) as Listing[];
          // Ensure all required fields exist
          const validListings = fetchedListings.filter((listing: any) => {
            const hasRequired = listing.id && listing.title && listing.sellerEmail;
            return hasRequired;
          });
          setListings(validListings);
      } catch (error) {
        console.error('Error fetching listings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchListings();
  }, []);

  const { id } = useLocalSearchParams();
  const listing = listings.find((l: any) => l.id === id);

  return (
    <>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Loading listing...</Text>
        </View>
      ) : !listing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Listing not found.</Text>
        </View>
      ) : (
        <SingleListing listing={listing} />
      )}
    </>
  );
}


// Removed duplicate ListingScreen export and old LISTINGS reference
