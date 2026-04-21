import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import GridListingCard from '../../components/GridListingCard';
import { app } from '../../firebase';
import { filterListingsWithExistingUsers } from '../../utils/listingOwners';
import { isListingVisible } from '../../utils/listingVisibility';

type RecentListing = {
  id: string;
  title: string;
  price: string;
  zipCode?: string;
  category?: string;
  viewCount?: number;
  sellerName?: string;
  userId?: string;
  city?: string;
  isFeatured?: boolean;
  imageSource?: import('react-native').ImageSourcePropType;
  createdAt?: number; // timestamp in ms
};

type RecentPetListing = {
  id: string;
  title: string;
  subtitle: string;
  imageSource?: import('react-native').ImageSourcePropType;
  createdAt?: number;
};

type CommunityDisplaySettings = {
  showQuoteOfDay: boolean;
  quoteOfDayText: string;
};

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
  showQuoteOfDay: true,
  quoteOfDayText: '',
};

export default function HomeScreen() {
  const router = useRouter();
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [recentPetListings, setRecentPetListings] = useState<RecentPetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    let isMounted = true;

    const fetchDisplaySettings = async () => {
      try {
        const db = getFirestore(app);
        const settingsRef = doc(db, 'community_settings', 'display');
        const settingsSnapshot = await getDoc(settingsRef);
        const settingsData = settingsSnapshot.exists()
          ? (settingsSnapshot.data() as Partial<CommunityDisplaySettings>)
          : {};

        if (!isMounted) return;
        setDisplaySettings({
          showQuoteOfDay: settingsData.showQuoteOfDay ?? DEFAULT_DISPLAY_SETTINGS.showQuoteOfDay,
          quoteOfDayText: settingsData.quoteOfDayText ?? DEFAULT_DISPLAY_SETTINGS.quoteOfDayText,
        });
      } catch (error) {
        console.error('Error fetching home display settings:', error);
        if (!isMounted) return;
        setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
      }
    };

    const fetchRecentListings = async () => {
      try {
        const db = getFirestore(app);
        // Fetch only approved listings and exclude reported/archived/deleted/expired records.
        const [querySnapshot, reportedSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'listings'), where('status', '==', 'approved'), limit(24))),
          getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
        ]);

        const excludedListingIds = new Set(
          reportedSnapshot.docs
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );

        const now = new Date().getTime();
        const listingsRaw: RecentListing[] = await Promise.all(
          querySnapshot.docs
            .filter((listingDoc: any) => {
              const data = listingDoc.data();
              return isListingVisible(data, listingDoc.id, {
                nowMs: now,
                excludedListingIds,
              });
            })
            .map(async (listingDoc: any) => {
              const data = listingDoc.data();
              let createdAt = undefined;
              if (data.createdAt) {
                createdAt = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
              }
              
              return {
                id: listingDoc.id,
                title: data.title || '',
                price: data.price ? String(data.price) : '',
                zipCode: data.zipCode || '',
                category: data.category || '',
                viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
                sellerName: data.sellerName || data.userName || '',
                userId: data.userId,
                city: data.city || '',
                isFeatured: Boolean(data.isFeatured),
                imageSource: Array.isArray(data.images) && data.images.length > 0 ? { uri: data.images[0] } : undefined,
                createdAt,
              };
            })
        );
        const listings = await filterListingsWithExistingUsers(db, listingsRaw);
        if (!isMounted) return;
        setRecentListings(listings);
      } catch (error) {
        console.error('Error fetching recent listings:', error);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    const fetchRecentPetListings = async () => {
      try {
        const db = getFirestore(app);
        const petsQuery = query(
          collection(db, 'pets'),
          orderBy('createdAt', 'desc'),
          limit(12)
        );
        const petsSnapshot = await getDocs(petsQuery);

        const pets: RecentPetListing[] = petsSnapshot.docs.map((petDoc: any) => {
          const data = petDoc.data();
          let createdAt = undefined;
          if (data.createdAt) {
            createdAt = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
          }

          const postTypeLabel =
            data.postType === 'lost' ? 'Lost Pet' : data.postType === 'found' ? 'Found Pet' : 'For Adoption';

          return {
            id: petDoc.id,
            title: data.petName || 'Pet Listing',
            subtitle: postTypeLabel,
            imageSource: Array.isArray(data.petImages) && data.petImages.length > 0
              ? { uri: data.petImages[0] }
              : data.petPhoto
                ? { uri: data.petPhoto }
                : undefined,
            createdAt,
          };
        });

        if (!isMounted) return;
        setRecentPetListings(pets);
      } catch (error) {
        console.error('Error fetching recent pet listings:', error);
      } finally {
        if (!isMounted) return;
        setPetsLoading(false);
      }
    };

    fetchDisplaySettings();
    fetchRecentListings();
    fetchRecentPetListings();

    return () => {
      isMounted = false;
    };
  }, []);

  const quoteText = (displaySettings.quoteOfDayText || '').trim();
  const shouldShowQuote = displaySettings.showQuoteOfDay && quoteText.length > 0;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 8, paddingBottom: 24 }}>
      {shouldShowQuote && (
        <View
          style={{
            marginTop: 8,
            marginHorizontal: 16,
            marginBottom: 12,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: '#f8fafc',
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#64748b',
              marginBottom: 6,
              textAlign: 'center',
            }}
          >
            Quote of the Day
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              fontWeight: '600',
              color: '#1e293b',
              textAlign: 'center',
            }}
          >
            {quoteText}
          </Text>
        </View>
      )}

      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}
      >
        <Image
          source={require('../../assets/images/communityhub.png')}
          style={{ width: '100%', height: 150, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
          contentFit="cover"
        />
        <TouchableOpacity
          style={{
            backgroundColor: '#475569',
            paddingVertical: 12,
            alignItems: 'center',
          }}
          onPress={() => router.push('./communitybutton')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Open Community Hub</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 18, marginBottom: 8, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: '#475569',
            textAlign: 'center',
            letterSpacing: 0.5,
          }}
        >
          Recent Listings
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12, gap: 12 }}>
        {loading ? (
          <Text style={{ width: '100%', textAlign: 'center' }}>Loading...</Text>
        ) : recentListings.length === 0 ? (
          <Text style={{ width: '100%', textAlign: 'center' }}>No recent listings found.</Text>
        ) : (
          recentListings.slice(0, 12).map((item) => {
            const isNew = item.createdAt && (Date.now() - item.createdAt) < 2 * 60 * 60 * 1000; // 2 hours
            return (
              <View key={item.id} style={{ width: '48%', marginBottom: 4 }}>
                {isNew && (
                  <Text style={{
                    backgroundColor: '#ffeb3b',
                    color: '#333',
                    fontWeight: '500',
                    fontSize: 12,
                    alignSelf: 'flex-start',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    marginBottom: 4,
                    zIndex: 1,
                  }}>
                    Just Listed
                  </Text>
                )}
                <GridListingCard
                  title={item.title}
                  price={item.price}
                  category={item.category}
                  viewCount={item.viewCount}
                  location={item.zipCode}
                  sellerName={item.sellerName}
                  createdAt={item.createdAt}
                  city={item.city}
                  isFeatured={item.isFeatured}
                  imageSource={item.imageSource}
                  onPress={() => router.push({ pathname: '../(app)/listing', params: { id: item.id } })}
                />
              </View>
            );
          })
        )}
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#475569',
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignSelf: 'center',
            minWidth: 210,
          }}
          onPress={() => router.push('./browsebutton')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 }}>
            View All Recent Listings
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 8, marginBottom: 8, paddingHorizontal: 16 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: '#475569',
            textAlign: 'center',
            letterSpacing: 0.5,
          }}
        >
          Recent Pet Listings
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12, gap: 12 }}>
        {petsLoading ? (
          <Text style={{ width: '100%', textAlign: 'center' }}>Loading...</Text>
        ) : recentPetListings.length === 0 ? (
          <Text style={{ width: '100%', textAlign: 'center' }}>No recent pet listings found.</Text>
        ) : (
          recentPetListings.map((item) => {
            const isNew = item.createdAt && (Date.now() - item.createdAt) < 2 * 60 * 60 * 1000;
            return (
              <View key={item.id} style={{ width: '48%', marginBottom: 4 }}>
                {isNew && (
                  <Text style={{
                    backgroundColor: '#ffeb3b',
                    color: '#333',
                    fontWeight: '500',
                    fontSize: 12,
                    alignSelf: 'flex-start',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    marginBottom: 4,
                    zIndex: 1,
                  }}>
                    Just Listed
                  </Text>
                )}
                <GridListingCard
                  title={item.title}
                  price={item.subtitle}
                  imageSource={item.imageSource}
                  onPress={() => router.push({ pathname: '../(app)/pet-details', params: { petId: item.id } })}
                />
              </View>
            );
          })
        )}
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#475569',
            borderRadius: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignSelf: 'center',
            minWidth: 190,
          }}
          onPress={() => router.push('../(app)/browse-pets')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 }}>
            View All Pet Listings
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
