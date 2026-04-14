import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import CommunityNews from '../../components/CommunityNews';
import FeaturedListings from '../../components/FeaturedListings';
import GridListingCard from '../../components/GridListingCard';
import { app } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { trackAppEvent } from '../../utils/appAnalytics';
import { createThread } from '../../utils/createThread';
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
  showEditorsPicks: boolean;
  showFeaturedListings: boolean;
  showQuoteOfDay: boolean;
  quoteOfDayText: string;
  quoteOfDayAttribution: string;
};

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
  showEditorsPicks: true,
  showFeaturedListings: true,
  showQuoteOfDay: true,
  quoteOfDayText: '',
  quoteOfDayAttribution: '',
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAccountStatus();
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [recentPetListings, setRecentPetListings] = useState<RecentPetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings | null>(null);

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

        const newSettings = {
          showEditorsPicks: settingsData.showEditorsPicks ?? DEFAULT_DISPLAY_SETTINGS.showEditorsPicks,
          showFeaturedListings: settingsData.showFeaturedListings ?? DEFAULT_DISPLAY_SETTINGS.showFeaturedListings,
          showQuoteOfDay: settingsData.showQuoteOfDay ?? DEFAULT_DISPLAY_SETTINGS.showQuoteOfDay,
          quoteOfDayText: settingsData.quoteOfDayText ?? DEFAULT_DISPLAY_SETTINGS.quoteOfDayText,
          quoteOfDayAttribution: settingsData.quoteOfDayAttribution ?? DEFAULT_DISPLAY_SETTINGS.quoteOfDayAttribution,
        };
        if (!isMounted) return;
        setDisplaySettings(newSettings);
      } catch (error) {
        console.error('Error fetching display settings:', error);
        // Silently use defaults if fetch fails (e.g., when not logged in)
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
        const listings: RecentListing[] = await Promise.all(
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

  const handleStartFirstListing = () => {
    trackAppEvent('first_listing_cta_tap', {
      userId: user?.uid || null,
      source: 'home_first_listing_card',
      isSignedIn: Boolean(user),
    });

    if (user) {
      router.push('/create-listing');
      return;
    }

    router.push({
      pathname: '/signup',
      params: {
        returnTo: '/create-listing',
      },
    } as any);
  };


  // Handler for test button
  const handleCreateThread = async () => {
    try {
      await createThread(
        'exampleThreadId123',
        ['user1uid', 'user2uid'],
        ['user1uid'],
        'Hello!',
        Date.now()
      );
      alert('Thread created!');
    } catch (err) {
      alert('Error creating thread: ' + err);
    }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 8, paddingBottom: 24 }}>
      {displaySettings?.showQuoteOfDay !== false && (
        <View
          style={{
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
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#1e293b', textAlign: 'center' }}>
            {(displaySettings?.quoteOfDayText || '').trim() || '"Small acts, when multiplied by many people, can transform a community."'}
          </Text>
          {(displaySettings?.quoteOfDayAttribution || '').trim() ? (
            <Text style={{ marginTop: 8, fontSize: 13, color: '#64748b', fontWeight: '600', textAlign: 'center' }}>
              {(displaySettings?.quoteOfDayAttribution || '').trim()}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View
          style={{
            backgroundColor: '#f0f9ff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#bae6fd',
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingTop: 14, paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' }}>
              Community Hub
            </Text>
          </View>
          <Image
            source={require('../../assets/images/communityhub.png')}
            style={{ width: '100%', height: 120 }}
            resizeMode="cover"
          />
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 15, color: '#334155', lineHeight: 21, marginBottom: 12, textAlign: 'center' }}>
              Explore local events, yard sales, jobs, deals, local businesses, services, and the Pet Corner all in one place.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#475569', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'center' }}
              onPress={() => router.push('/(tabs)/communitybutton')}
            >
              <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>Open Community Hub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

          {/* Community News Section (includes spotlights) */}
      <CommunityNews />

      {/* Premium Featured Listings Section */}
      {displaySettings?.showFeaturedListings && (
        <FeaturedListings 
          tier="premium"
          title="✨ Featured"
          subtitle="Top picks from our community"
          onListingPress={(listingId) => router.push({ pathname: '/listing', params: { id: listingId } })}
        />
      )}

      {/* Editor's Picks Section */}
      {displaySettings?.showEditorsPicks && (
        <FeaturedListings 
          tier="basic"
          title="Editor's Picks"
          subtitle="Hand-selected listings from your community"
          onListingPress={(listingId) => router.push({ pathname: '/listing', params: { id: listingId } })}
        />
      )}

      {/* List Hub Promo Section */}
      <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View
          style={{
            backgroundColor: '#fff7ed',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#fed7aa',
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingTop: 14, paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#7c2d12', marginBottom: 8, textAlign: 'center' }}>
              List Hub
            </Text>
          </View>
          <Image
            source={require('../../assets/images/listhub.png')}
            style={{ width: '100%', height: 120 }}
            resizeMode="cover"
          />
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 13, color: '#7c2d12', lineHeight: 19, marginBottom: 12, textAlign: 'center' }}>
              Promote what you offer, post your listing fast, and reach neighbors who are ready to buy.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#475569', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'center' }}
              onPress={() => router.push(user ? '/(tabs)/listbutton' : '/signInOrSignUp')}
            >
              <Text style={{ color: '#fff', fontWeight: '500', fontSize: 14 }}>Open List Hub</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                  onPress={() => router.push({ pathname: '/listing', params: { id: item.id } })}
                />
              </View>
            );
          })
        )}
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
                  onPress={() => router.push({ pathname: '/pet-details', params: { petId: item.id } })}
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
          onPress={() => router.push('/browse-pets')}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 }}>
            View All Pet Listings
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}