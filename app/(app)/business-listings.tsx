import { useAccountStatus } from '@/hooks/useAccountStatus';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

type ListingTab = 'marketplace' | 'services' | 'deals' | 'featured' | 'pending' | 'sold' | 'saved';

type ListingItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  imageUrl: string | null;
  kind: ListingTab;
  createdAt: number;
  listingId?: string;
};

const TABS: { key: ListingTab; label: string }[] = [
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'services', label: 'Services' },
  { key: 'deals', label: 'Deals' },
  { key: 'featured', label: 'Featured' },
  { key: 'pending', label: 'Pending' },
  { key: 'sold', label: 'Sold' },
  { key: 'saved', label: 'Saved' },
];

function toTimestamp(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return Number(value.toMillis()) || 0;
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isPending(data: any): boolean {
  const status = String(data?.status || '').toLowerCase();
  const approvalStatus = String(data?.approvalStatus || '').toLowerCase();
  return status === 'pending' || approvalStatus === 'pending' || data?.isApproved === false;
}

export default function BusinessListingsScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && profile?.accountType === 'business';

  const [activeTab, setActiveTab] = useState<ListingTab>('marketplace');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadListings = async () => {
      if (!hasBusinessAccess || !user?.uid) {
        if (!cancelled) {
          setListings([]);
          setLoadingListings(false);
        }
        return;
      }

      try {
        if (!cancelled) setLoadingListings(true);

        const db = getFirestore(app);
        const uid = user.uid;

        let docs: ListingItem[] = [];

        if (activeTab === 'marketplace') {
          const snap = await getDocs(query(collection(db, 'listings'), where('userId', '==', uid)));
          snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = String(data.status || '').toLowerCase();
            if (status === 'sold' || isPending(data)) return;
            docs.push({
              id: docSnap.id,
              title: String(data.title || 'Untitled Listing'),
              subtitle: String(data.category || 'Marketplace Listing'),
              status,
              imageUrl: Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null,
              kind: 'marketplace',
              createdAt: toTimestamp(data.createdAt),
            });
          });
        }

        if (activeTab === 'services') {
          const snap = await getDocs(query(collection(db, 'services'), where('userId', '==', uid)));
          snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (isPending(data)) return;
            docs.push({
              id: docSnap.id,
              title: String(data.title || data.serviceName || 'Untitled Service'),
              subtitle: 'Service Listing',
              status: String(data.status || ''),
              imageUrl: Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null,
              kind: 'services',
              createdAt: toTimestamp(data.createdAt),
            });
          });
        }

        if (activeTab === 'deals') {
          const snap = await getDocs(query(collection(db, 'deals'), where('userId', '==', uid)));
          snap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (isPending(data)) return;
            docs.push({
              id: docSnap.id,
              title: String(data.title || data.dealTitle || 'Untitled Deal'),
              subtitle: 'Deal Listing',
              status: String(data.status || ''),
              imageUrl: Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null,
              kind: 'deals',
              createdAt: toTimestamp(data.createdAt),
            });
          });
        }

        if (activeTab === 'featured' || activeTab === 'sold' || activeTab === 'pending') {
          const now = Date.now();
          const listingsSnap = await getDocs(query(collection(db, 'listings'), where('userId', '==', uid)));

          listingsSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const status = String(data.status || '').toLowerCase();
            const createdAt = toTimestamp(data.createdAt);
            const title = String(data.title || 'Untitled Listing');
            const subtitle = String(data.category || 'Marketplace Listing');
            const imageUrl = Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null;

            if (activeTab === 'sold' && status === 'sold') {
              docs.push({
                id: docSnap.id,
                title,
                subtitle,
                status,
                imageUrl,
                kind: 'sold',
                createdAt,
                listingId: docSnap.id,
              });
              return;
            }

            if (activeTab === 'pending' && isPending(data)) {
              docs.push({
                id: docSnap.id,
                title,
                subtitle,
                status,
                imageUrl,
                kind: 'pending',
                createdAt,
                listingId: docSnap.id,
              });
              return;
            }

            if (activeTab === 'featured' && data.isFeatured && data.featureExpiresAt) {
              const expiresAt = toTimestamp(data.featureExpiresAt);
              if (expiresAt > now) {
                docs.push({
                  id: docSnap.id,
                  title,
                  subtitle,
                  status,
                  imageUrl,
                  kind: 'featured',
                  createdAt,
                  listingId: docSnap.id,
                });
              }
            }
          });

          if (activeTab === 'pending') {
            const [servicesSnap, dealsSnap] = await Promise.all([
              getDocs(query(collection(db, 'services'), where('userId', '==', uid))),
              getDocs(query(collection(db, 'deals'), where('userId', '==', uid))),
            ]);

            servicesSnap.forEach((docSnap) => {
              const data = docSnap.data() || {};
              if (!isPending(data)) return;
              docs.push({
                id: `service-${docSnap.id}`,
                title: String(data.title || data.serviceName || 'Untitled Service'),
                subtitle: String(data.category || 'Service Listing'),
                status: String(data.status || 'pending'),
                imageUrl: data.serviceImage || data.businessLogo || null,
                kind: 'pending',
                createdAt: toTimestamp(data.createdAt),
              });
            });

            dealsSnap.forEach((docSnap) => {
              const data = docSnap.data() || {};
              if (!isPending(data)) return;
              docs.push({
                id: `deal-${docSnap.id}`,
                title: String(data.title || data.dealTitle || 'Untitled Deal'),
                subtitle: String(data.category || 'Deal Listing'),
                status: String(data.status || 'pending'),
                imageUrl: Array.isArray(data.images) && data.images[0] ? String(data.images[0]) : null,
                kind: 'pending',
                createdAt: toTimestamp(data.createdAt),
              });
            });
          }
        }

        if (activeTab === 'saved') {
          const savedSnap = await getDocs(query(collection(db, 'saveListings'), where('userId', '==', uid)));
          savedSnap.forEach((docSnap) => {
            const data = docSnap.data() || {};
            docs.push({
              id: docSnap.id,
              title: String(data.title || 'Untitled Listing'),
              subtitle: 'Saved Listing',
              status: 'saved',
              imageUrl: data.image ? String(data.image) : null,
              kind: 'saved',
              createdAt: toTimestamp(data.createdAt),
              listingId: typeof data.listingId === 'string' ? data.listingId : undefined,
            });
          });
        }

        docs.sort((a, b) => b.createdAt - a.createdAt);

        if (!cancelled) {
          setListings(docs);
          setLoadingListings(false);
        }
      } catch (error) {
        if (!cancelled) {
          setListings([]);
          setLoadingListings(false);
        }
      }
    };

    loadListings();

    return () => {
      cancelled = true;
    };
  }, [activeTab, hasBusinessAccess, user?.uid]);

  const emptyText = useMemo(() => {
    if (activeTab === 'services') return 'No services found for this account.';
    if (activeTab === 'deals') return 'No deals found for this account.';
    if (activeTab === 'featured') return 'No featured listings found for this account.';
    if (activeTab === 'pending') return 'No pending items right now.';
    if (activeTab === 'sold') return 'No sold listings found for this account.';
    if (activeTab === 'saved') return 'No saved listings found for this account.';
    return 'No marketplace listings found for this account.';
  }, [activeTab]);

  const selectedTabLabel = useMemo(() => {
    return TABS.find((tab) => tab.key === activeTab)?.label || 'Marketplace';
  }, [activeTab]);

  if (loading || waitingForProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading listings manager...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasBusinessAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Listings Manager is available for business accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Listings Manager</Text>
          <Text style={styles.heroSubtitle}>Choose what to display and manage your business listings from one place.</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Back to Business Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabsWrap}>
          <Text style={styles.tabsLabel}>Choose what to display</Text>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setIsDropdownOpen((prev) => !prev)}>
            <Text style={styles.dropdownButtonText}>{selectedTabLabel}</Text>
            <Text style={styles.dropdownChevron}>{isDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {isDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.dropdownItem, active ? styles.dropdownItemActive : null]}
                    onPress={() => {
                      setActiveTab(tab.key);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, active ? styles.dropdownItemTextActive : null]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>

        {activeTab === 'pending' ? (
          <View style={styles.pendingNotice}>
            <Text style={styles.pendingNoticeText}>
              Pending Review Notice: Items require admin approval to help prevent fraud and protect our community.
            </Text>
          </View>
        ) : null}

        {loadingListings ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Loading listings...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{emptyText}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {listings.map((item) => (
              <TouchableOpacity
                key={`${item.kind}-${item.id}`}
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => {
                  if (item.kind === 'marketplace' || item.kind === 'featured' || item.kind === 'sold' || item.kind === 'pending') {
                    const id = item.listingId || item.id;
                    router.push({ pathname: '/listing', params: { id } });
                  }
                  if (item.kind === 'services') {
                    router.push({ pathname: '/(app)/service-details', params: { id: item.id } });
                  }
                  if (item.kind === 'saved' && item.listingId) {
                    router.push({ pathname: '/listing', params: { id: item.listingId } });
                  }
                }}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" />
                ) : (
                  <View style={styles.cardPlaceholder}>
                    <Text style={styles.cardPlaceholderText}>No Image</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  hero: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  heroActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  backBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsWrap: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 16,
    zIndex: 30,
  },
  tabsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  dropdownChevron: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#ecfeff',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  dropdownItemTextActive: {
    color: '#0f766e',
  },
  pendingNotice: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pendingNoticeText: {
    fontSize: 12,
    color: '#9a3412',
    lineHeight: 18,
    fontWeight: '600',
  },
  stateCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  stateText: {
    textAlign: 'left',
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    gap: 12,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImage: {
    width: 112,
    height: 112,
    backgroundColor: '#e2e8f0',
  },
  cardPlaceholder: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  cardPlaceholderText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
});