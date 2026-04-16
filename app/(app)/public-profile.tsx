import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GridListingCard from '../../components/GridListingCard';
import { app } from '../../firebase';
import { isListingVisible } from '../../utils/listingVisibility';

type PublicUserProfile = {
  id: string;
  accountType?: 'personal' | 'user' | 'business' | string;
  name?: string;
  displayName?: string;
  zipCode?: string;
  createdAt?: unknown;
  memberSince?: unknown;
  ratingAverage?: number | string;
  ratingCount?: number | string;
  photoURL?: string;
  profileImage?: string;
  profileimage?: string;
  publicProfileEnabled?: boolean;
};

type MarketplaceListing = {
  id: string;
  title?: string;
  price?: number | string;
  category?: string;
  viewCount?: number;
  sellerName?: string;
  city?: string;
  zipCode?: string;
  images?: string[];
  isFeatured?: boolean;
  createdAt?: unknown;
  status?: string;
  isActive?: boolean;
  expiresAt?: unknown;
  featureExpiresAt?: unknown;
};

type ServiceListing = {
  id: string;
  serviceName?: string;
  providerName?: string;
  category?: string;
  categoryIcon?: string;
  serviceDescription?: string;
  serviceImage?: string;
  serviceArea?: string | null;
  city?: string | null;
  zipCode?: string | null;
  priceType?: string;
  priceAmount?: string | null;
  isActive?: boolean;
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
  createdAt?: unknown;
};

type ApprovedUserReview = {
  id: string;
  userName?: string;
  rating?: number | string;
  reviewText?: string;
  reviewTargetType?: string;
  createdAt?: unknown;
};

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getDisplayName(profile: PublicUserProfile | null): string {
  if (!profile) return 'Local List Member';
  const name = String(profile.displayName || profile.name || '').trim();
  return name || 'Local List Member';
}

function getAvatarUri(profile: PublicUserProfile | null): string {
  if (!profile) return '';
  return String(profile.profileImage || profile.profileimage || profile.photoURL || '').trim();
}

function formatMemberSince(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return 'Recently joined';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}

function formatRating(value: number | string | undefined): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not rated yet';
  return `${numeric.toFixed(1)} / 5`;
}

function formatReviewDate(value: unknown): string {
  const ms = toMillis(value);
  if (!ms) return 'Recently';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms));
}

function formatReviewRatingLine(value: number | string | undefined): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Not rated';
  const safe = Math.max(1, Math.min(5, Math.round(numeric)));
  return `${'★'.repeat(safe)} ${numeric.toFixed(1)}`;
}

function isApprovedService(data: ServiceListing): boolean {
  const status = String(data.status || '').toLowerCase();
  const approvalStatus = String(data.approvalStatus || '').toLowerCase();

  if (data.isApproved === true) return true;
  if (approvalStatus === 'approved') return true;
  return status === 'approved';
}

function formatServicePrice(item: ServiceListing): string {
  const priceType = String(item.priceType || '').toLowerCase();
  const amount = String(item.priceAmount || '').trim();

  if (priceType === 'quote') return 'Free Quote';
  if (priceType === 'negotiable') return 'Negotiable';
  if (!amount) return 'Price not listed';
  if (priceType === 'hourly') return `$${amount}/hr`;
  if (priceType === 'fixed') return `$${amount} flat`;
  return `$${amount}`;
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; userId?: string | string[] }>();
  const profileId = Array.isArray(params.userId)
    ? params.userId[0]
    : Array.isArray(params.id)
      ? params.id[0]
      : params.userId || params.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [recentListings, setRecentListings] = useState<MarketplaceListing[]>([]);
  const [serviceListings, setServiceListings] = useState<ServiceListing[]>([]);
  const [approvedReviews, setApprovedReviews] = useState<ApprovedUserReview[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!profileId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore(app);
        const userSnap = await getDoc(doc(db, 'users', profileId));

        if (!userSnap.exists()) {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }

        const userData = { id: userSnap.id, ...(userSnap.data() as Omit<PublicUserProfile, 'id'>) };
        const accountType = String(userData.accountType || '').toLowerCase();

        if (userData.publicProfileEnabled === false) {
          if (!cancelled) {
            setNotFound(true);
          }
          return;
        }

        if (accountType === 'business') {
          router.replace({ pathname: '/(app)/businessprofile', params: { id: profileId } });
          return;
        }

        const [listingResult, serviceResult, reportedResult, approvedReviewsResult] = await Promise.allSettled([
          getDocs(query(collection(db, 'listings'), where('userId', '==', profileId))),
          getDocs(query(collection(db, 'services'), where('userId', '==', profileId))),
          getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
          getDocs(query(collection(db, 'userReviews'), where('ratedUserId', '==', profileId), where('status', '==', 'approved'))),
        ]);

        if (listingResult.status !== 'fulfilled' || serviceResult.status !== 'fulfilled') {
          throw new Error('Unable to load profile listings.');
        }

        const listingSnap = listingResult.value;
        const serviceSnap = serviceResult.value;
        const reportedSnap = reportedResult.status === 'fulfilled' ? reportedResult.value : null;
        const approvedReviewsSnap = approvedReviewsResult.status === 'fulfilled' ? approvedReviewsResult.value : null;

        if (reportedResult.status !== 'fulfilled') {
          console.warn('Public profile reported-listings filter unavailable:', reportedResult.reason);
        }

        if (approvedReviewsResult.status !== 'fulfilled') {
          console.warn('Public profile reviews unavailable:', approvedReviewsResult.reason);
        }

        const excludedListingIds = new Set(
          (reportedSnap?.docs || [])
            .map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
            .filter(Boolean)
        );

        const now = Date.now();
        const listings = listingSnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<MarketplaceListing, 'id'>) }))
          .filter((item) => isListingVisible(item, item.id, { nowMs: now, excludedListingIds }))
          .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
          .slice(0, 8);

        const services = serviceSnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as Omit<ServiceListing, 'id'>) }))
          .filter((item) => item.isActive !== false && isApprovedService(item))
          .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt))
          .slice(0, 8);

        const reviews = (approvedReviewsSnap?.docs || [])
          .map((item) => ({ id: item.id, ...(item.data() as Omit<ApprovedUserReview, 'id'>) }))
          .sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));

        if (!cancelled) {
          setProfile(userData);
          setRecentListings(listings);
          setServiceListings(services);
          setApprovedReviews(reviews);
        }
      } catch (error) {
        console.error('Error loading public profile:', error);
        if (!cancelled) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [profileId, router]);

  const displayName = getDisplayName(profile);
  const avatarUri = getAvatarUri(profile);
  const memberSinceLabel = formatMemberSince(profile?.memberSince || profile?.createdAt);
  const zipCodeLabel = String(profile?.zipCode || '').trim() || 'Not shared';
  const approvedRatings = approvedReviews
    .map((item) => Number(item.rating || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const computedAverage = approvedRatings.length
    ? approvedRatings.reduce((sum, value) => sum + value, 0) / approvedRatings.length
    : Number(profile?.ratingAverage || 0);
  const computedCount = approvedRatings.length || Number(profile?.ratingCount || 0);
  const ratingLabel = formatRating(computedAverage);
  const ratingCountLabel = computedCount > 0 ? `${computedCount} approved review${computedCount === 1 ? '' : 's'}` : 'No approved reviews yet';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color="#0f766e" />
          <Text style={styles.stateText}>Loading public profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stateWrap}>
          <Text style={styles.emptyTitle}>Profile not available</Text>
          <Text style={styles.emptyText}>
            This profile could not be found or is not available yet.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{displayName.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
            )}

            <View style={styles.heroCopy}>
              <Text style={styles.name}>{displayName}</Text>
              <Text style={styles.subhead}>Local List member</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Member Since</Text>
              <Text style={styles.metaValue}>{memberSinceLabel}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>ZIP Code</Text>
              <Text style={styles.metaValue}>{zipCodeLabel}</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>Rating</Text>
              <Text style={styles.metaValue}>{ratingLabel}</Text>
              <Text style={styles.metaSubValue}>{ratingCountLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          <Text style={styles.sectionSubtitle}>Approved community feedback</Text>
        </View>

        {approvedReviews.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No approved reviews yet.</Text>
          </View>
        ) : (
          approvedReviews.slice(0, 6).map((item) => (
            <View key={item.id} style={styles.reviewCard}>
              <View style={styles.reviewTopRow}>
                <Text style={styles.reviewAuthor}>{String(item.userName || 'Community Member')}</Text>
                <Text style={styles.reviewDate}>{formatReviewDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.reviewRating}>{formatReviewRatingLine(item.rating)}</Text>
              <Text style={styles.reviewText}>{String(item.reviewText || '').trim() || 'No comment provided.'}</Text>
              {!!item.reviewTargetType && (
                <Text style={styles.reviewMeta}>Type: {String(item.reviewTargetType)}</Text>
              )}
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Listings</Text>
          <Text style={styles.sectionSubtitle}>Marketplace posts from this member</Text>
        </View>

        {recentListings.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No marketplace listings yet.</Text>
          </View>
        ) : (
          recentListings.map((item) => (
            <GridListingCard
              key={item.id}
              title={item.title || 'Untitled Listing'}
              price={String(item.price || '')}
              category={item.category || ''}
              viewCount={item.viewCount}
              sellerName={item.sellerName || displayName}
              createdAt={toMillis(item.createdAt)}
              city={item.city || item.zipCode || ''}
              imageSource={Array.isArray(item.images) && item.images[0] ? { uri: item.images[0] } : undefined}
              isFeatured={!!item.isFeatured}
              onPress={() => router.push({ pathname: '/listing', params: { id: item.id } })}
            />
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Service Listings</Text>
          <Text style={styles.sectionSubtitle}>Services offered by this member</Text>
        </View>

        {serviceListings.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>No service listings yet.</Text>
          </View>
        ) : (
          serviceListings.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.serviceCard}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/(app)/service-details', params: { id: item.id } })}
            >
              {item.serviceImage ? (
                <Image source={{ uri: item.serviceImage }} style={styles.serviceImage} contentFit="cover" />
              ) : (
                <View style={styles.serviceImagePlaceholder}>
                  <Text style={styles.serviceEmoji}>{item.categoryIcon || '🧰'}</Text>
                </View>
              )}

              <View style={styles.serviceBody}>
                <Text style={styles.serviceTitle}>{item.serviceName || 'Service Listing'}</Text>
                <Text style={styles.serviceMeta}>{formatServicePrice(item)}</Text>
                <Text style={styles.serviceMeta}>
                  {item.category || 'General service'}
                  {item.serviceArea || item.city || item.zipCode ? `  |  ${item.serviceArea || item.city || item.zipCode}` : ''}
                </Text>
                <Text style={styles.serviceDescription} numberOfLines={2}>
                  {item.serviceDescription || 'No description provided.'}
                </Text>
                <Text style={styles.serviceLink}>View service details</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f8',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  stateText: {
    fontSize: 15,
    color: '#475569',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#dbeafe',
  },
  avatarFallback: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#115e59',
  },
  heroCopy: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subhead: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  metaGrid: {
    gap: 10,
  },
  metaCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#64748b',
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  metaSubValue: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  emptySection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptySectionText: {
    fontSize: 15,
    color: '#64748b',
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  reviewAuthor: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
  },
  reviewRating: {
    marginTop: 8,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '700',
  },
  reviewText: {
    marginTop: 8,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  reviewMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  serviceImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#e2e8f0',
  },
  serviceImagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceEmoji: {
    fontSize: 38,
  },
  serviceBody: {
    padding: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  serviceMeta: {
    fontSize: 14,
    color: '#475569',
    marginTop: 6,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#334155',
    marginTop: 8,
    lineHeight: 20,
  },
  serviceLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f766e',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});