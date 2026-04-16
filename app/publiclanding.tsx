import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  viewCount?: number;
  posterName?: string;
  location?: string;
};

type CommunityDisplaySettings = {
  showQuoteOfDay: boolean;
  quoteOfDayText: string;
};

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
  showQuoteOfDay: true,
  quoteOfDayText: '',
};

export default function PublicLanding() {
  const router = useRouter();
  const [recentListings, setRecentListings] = useState<RecentListing[]>([]);
  const [recentPetListings, setRecentPetListings] = useState<RecentPetListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [petsLoading, setPetsLoading] = useState(true);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const quoteText = (displaySettings.quoteOfDayText || '').trim();
  const shouldShowQuote = displaySettings.showQuoteOfDay && quoteText.length > 0;

  const handlePreviewTap = () => {
    router.push('/signInOrSignUp');
  };

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
        console.error('Error fetching public display settings:', error);
        if (!isMounted) return;
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

        if (!isMounted) return;
        setRecentListings(listings);
      } catch (error) {
        console.error('Error fetching public recent listings:', error);
      } finally {
        if (!isMounted) return;
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
            viewCount: typeof data.viewCount === 'number' ? data.viewCount : undefined,
            posterName: data.posterName || data.userName || '',
            location: data.location || data.city || '',
          };
        });

        if (!isMounted) return;
        setRecentPetListings(pets);
      } catch (error) {
        console.error('Error fetching public pet listings:', error);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.logoSection}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.centeredLogo}
          contentFit="contain"
        />
      </View>

      {shouldShowQuote && (
        <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Quote of the Day</Text>
          <Text style={styles.quoteText}>
            {quoteText}
          </Text>
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
                  viewCount={item.viewCount}
                  sellerName={item.posterName}
                  createdAt={item.createdAt}
                  city={item.location}
                  imageSource={item.imageSource}
                  onPress={handlePreviewTap}
                />
              </View>
            );
          })
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerCopy}>© 2026 Local List. A local marketplace for Harrison.</Text>
        <View style={styles.footerLinksRow}>
          <TouchableOpacity onPress={() => router.push('/termsOfUse' as any)} activeOpacity={0.8}>
            <Text style={styles.footerLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>|</Text>
          <TouchableOpacity onPress={() => router.push('/privacy' as any)} activeOpacity={0.8}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
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
  logoSection: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredLogo: {
    width: 140,
    height: 66,
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#f0f8fc',
  },
  heroTopRow: {
    paddingTop: 32,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 120,
    height: 56,
    flexShrink: 1,
  },
  logoImageCompact: {
    width: 120,
    height: 56,
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
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f3f9fd',
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  ctaSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
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
    backgroundColor: '#475569',
  },
  secondaryButton: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButtonText: {
    color: '#0ea5e9',
    fontWeight: '800',
    fontSize: 13,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerCopy: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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