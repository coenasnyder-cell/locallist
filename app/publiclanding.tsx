import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import FeaturedListings from '../components/FeaturedListings';
import GridListingCard from '../components/GridListingCard';
import { app } from '../firebase';
import { isListingVisible } from '../utils/listingVisibility';

type RecentListing = {
  id: string;
  title: string;
  price: string;
  zipCode?: string;
  city?: string;
  category?: string;
  viewCount?: number;
  sellerName?: string;
  isFeatured?: boolean;
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
  const { width } = useWindowDimensions();
  const isCompactHeader = width < 360;
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [recentPetListings, setRecentPetListings] = useState<RecentPetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  const handlePreviewTap = () => {
    router.push('/signInOrSignUp');
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth(app);
      if (auth.currentUser) {
        await signOut(auth);
      }
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out from public landing:', error);
      Alert.alert('Logout Error', 'Could not log out right now. Please try again.');
    }
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
              city: data.city || data.location || '',
              category: data.category || '',
              viewCount: typeof data.viewCount === 'number' ? data.viewCount : undefined,
              sellerName: data.sellerName || '',
              isFeatured: !!data.isFeatured,
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
          <View style={styles.heroTopRow}>
            <Image
              source={require('../assets/images/logo.png')}
              style={[styles.logoImage, isCompactHeader ? styles.logoImageCompact : null]}
              resizeMode="contain"
            />
          <TouchableOpacity
              style={[styles.profileButton, isCompactHeader ? styles.profileButtonCompact : null]}
            onPress={handleLogout}
          >
              <Text style={[styles.profileButtonText, isCompactHeader ? styles.profileButtonTextCompact : null]}>Log Out</Text>
          </TouchableOpacity>
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
                  category={item.category}
                  viewCount={item.viewCount}
                  sellerName={item.sellerName}
                  createdAt={item.createdAt}
                  city={item.city}
                  isFeatured={item.isFeatured}
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
                  category={item.subtitle}
                  createdAt={item.createdAt}
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

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.push('/(app)/termsOfUse' as any)} activeOpacity={0.8}>
          <Text style={styles.footerLink}>Terms of Use</Text>
        </TouchableOpacity>
        <Text style={styles.footerDivider}>|</Text>
        <TouchableOpacity onPress={() => router.push('/(app)/privacy' as any)} activeOpacity={0.8}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>
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
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#f0f8fc',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: 10,
  },
  logoImage: {
    width: 92,
    height: 44,
    flexShrink: 1,
  },
  logoImageCompact: {
    width: 74,
    height: 36,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexShrink: 0,
  },
  profileButtonCompact: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  profileButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  profileButtonTextCompact: {
    fontSize: 12,
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
    marginBottom: 8,
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
  footer: {
    marginTop: 24,
    paddingTop: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    paddingVertical: 4,
  },
  footerDivider: {
    color: '#94a3b8',
    fontSize: 13,
  },
});