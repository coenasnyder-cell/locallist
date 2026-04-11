import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import FeaturedListings from '../components/FeaturedListings';
import GridListingCard from '../components/GridListingCard';
import Header from '../components/Header';
import { app } from '../firebase';
import { isListingVisible } from '../utils/listingVisibility';

type RecentListing = {
  id: string;
  title: string;
  price: string;
  zipCode?: string;
  imageSource?: import('react-native').ImageSourcePropType;
  createdAt?: number;
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

export default function PublicLanding() {
  const router = useRouter();
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [recentPetListings, setRecentPetListings] = useState<RecentPetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  const handlePreviewTap = () => {
    router.push('/signInOrSignUp');
  };

  useEffect(() => {
    const fetchDisplaySettings = async () => {
      try {
        const db = getFirestore(app);
        const settingsRef = doc(db, 'community_settings', 'display');
        const settingsSnapshot = await getDoc(settingsRef);
        const settingsData = settingsSnapshot.exists()
          ? (settingsSnapshot.data() as Partial<CommunityDisplaySettings>)
          : {};

        setDisplaySettings({
          showEditorsPicks: settingsData.showEditorsPicks ?? DEFAULT_DISPLAY_SETTINGS.showEditorsPicks,
          showFeaturedListings: settingsData.showFeaturedListings ?? DEFAULT_DISPLAY_SETTINGS.showFeaturedListings,
          showQuoteOfDay: settingsData.showQuoteOfDay ?? DEFAULT_DISPLAY_SETTINGS.showQuoteOfDay,
          quoteOfDayText: settingsData.quoteOfDayText ?? DEFAULT_DISPLAY_SETTINGS.quoteOfDayText,
          quoteOfDayAttribution: settingsData.quoteOfDayAttribution ?? DEFAULT_DISPLAY_SETTINGS.quoteOfDayAttribution,
        });
      } catch (error) {
        console.error('Error fetching public display settings:', error);
        setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
      }
    };

    const fetchRecentListings = async () => {
      try {
        const db = getFirestore(app);
        const [querySnapshot, reportedSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'listings'), where('status', '==', 'approved'), limit(24))),
          getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
        ]);

        const excludedListingIds = new Set(
          reportedSnapshot.docs
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );

        const now = Date.now();
        const listings = querySnapshot.docs
          .filter((listingDoc: any) => {
            const data = listingDoc.data();
            return isListingVisible(data, listingDoc.id, {
              nowMs: now,
              excludedListingIds,
            });
          })
          .map((listingDoc: any) => {
            const data = listingDoc.data();
            const createdAt = data.createdAt
              ? data.createdAt.toMillis
                ? data.createdAt.toMillis()
                : new Date(data.createdAt).getTime()
              : undefined;

            return {
              id: listingDoc.id,
              title: data.title || '',
              price: data.price ? String(data.price) : '',
              zipCode: data.zipCode || '',
              imageSource: Array.isArray(data.images) && data.images.length > 0 ? { uri: data.images[0] } : undefined,
              createdAt,
            };
          })
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        setRecentListings(listings);
      } catch (error) {
        console.error('Error fetching public recent listings:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchRecentPetListings = async () => {
      try {
        const db = getFirestore(app);
        const petsSnapshot = await getDocs(
          query(collection(db, 'pets'), orderBy('createdAt', 'desc'), limit(12))
        );

        const pets = petsSnapshot.docs.map((petDoc: any) => {
          const data = petDoc.data();
          const createdAt = data.createdAt
            ? data.createdAt.toMillis
              ? data.createdAt.toMillis()
              : new Date(data.createdAt).getTime()
            : undefined;

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

        setRecentPetListings(pets);
      } catch (error) {
        console.error('Error fetching public pet listings:', error);
      } finally {
        setPetsLoading(false);
      }
    };

    fetchDisplaySettings();
    fetchRecentListings();
    fetchRecentPetListings();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Header />

      <View style={styles.heroSection}>
        <View style={styles.heroTopRow}>
          <Text style={styles.logoText}>Local List</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/signInOrSignUp')}
          >
            <Ionicons name="person-circle-outline" size={30} color="#334155" />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroTitle}>Discover what’s happening nearby</Text>
        <Text style={styles.heroSubtitle}>
          Preview featured posts, recent listings, and pets in your community. Sign in to open full details and connect.
        </Text>
      </View>

      {displaySettings.showQuoteOfDay && (
        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Quote of the Day</Text>
          <Text style={styles.quoteText}>
            {(displaySettings.quoteOfDayText || '').trim() || '"Small acts, when multiplied by many people, can transform a community."'}
          </Text>
          {(displaySettings.quoteOfDayAttribution || '').trim() ? (
            <Text style={styles.quoteAttribution}>{displaySettings.quoteOfDayAttribution.trim()}</Text>
          ) : null}
        </View>
      )}

      {displaySettings.showFeaturedListings && (
        <FeaturedListings
          tier="premium"
          title="✨ Featured"
          subtitle="View-only preview — tap any card to sign in"
          onListingPress={handlePreviewTap}
        />
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Listings</Text>
        <Text style={styles.sectionSubtitle}>Preview recent items from your community</Text>
      </View>

      <View style={styles.gridContainer}>
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : recentListings.length === 0 ? (
          <Text style={styles.emptyText}>No recent listings found.</Text>
        ) : (
          recentListings.slice(0, 8).map((item) => {
            const isNew = item.createdAt && Date.now() - item.createdAt < 2 * 60 * 60 * 1000;
            return (
              <View key={item.id} style={styles.cardWrapper}>
                {isNew && <Text style={styles.justListedBadge}>Just Listed</Text>}
                <GridListingCard
                  title={item.title}
                  price={item.price}
                  location={item.zipCode}
                  imageSource={item.imageSource}
                  onPress={handlePreviewTap}
                />
              </View>
            );
          })
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Pet Listings</Text>
        <Text style={styles.sectionSubtitle}>Meet local pets and pet alerts near you</Text>
      </View>

      <View style={styles.gridContainer}>
        {petsLoading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : recentPetListings.length === 0 ? (
          <Text style={styles.emptyText}>No recent pet listings found.</Text>
        ) : (
          recentPetListings.slice(0, 8).map((item) => {
            const isNew = item.createdAt && Date.now() - item.createdAt < 2 * 60 * 60 * 1000;
            return (
              <View key={item.id} style={styles.cardWrapper}>
                {isNew && <Text style={styles.justListedBadge}>Just Listed</Text>}
                <GridListingCard
                  title={item.title}
                  price={item.subtitle}
                  imageSource={item.imageSource}
                  onPress={handlePreviewTap}
                />
              </View>
            );
          })
        )}
      </View>

      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Ready to join your local community?</Text>
        <Text style={styles.ctaSubtitle}>
          Sign in to browse full details, contact sellers, and post your own listings.
        </Text>

        <View style={styles.ctaButtonRow}>
          <TouchableOpacity style={[styles.ctaButton, styles.secondaryButton]} onPress={() => router.push('/login')}>
            <Text style={styles.secondaryButtonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.ctaButton, styles.primaryButton]} onPress={() => router.push('/signup')}>
            <Text style={styles.primaryButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileButton: {
    padding: 4,
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  quoteCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  quoteText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  quoteAttribution: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 12,
    gap: 12,
  },
  cardWrapper: {
    width: '48%',
    marginBottom: 4,
  },
  justListedBadge: {
    backgroundColor: '#ffeb3b',
    color: '#333',
    fontWeight: '600',
    fontSize: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    zIndex: 1,
  },
  emptyText: {
    width: '100%',
    textAlign: 'center',
    color: '#64748b',
    paddingVertical: 12,
  },
  ctaSection: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#0f172a',
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  ctaSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  ctaButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  ctaButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#f97316',
  },
  secondaryButton: {
    backgroundColor: '#fff',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 14,
  },
});