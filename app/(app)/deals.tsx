import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { db } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';

type DealRecord = {
  id: string;
  dealsTitle?: string;
  dealsDescription?: string;
  dealsCategory?: string;
  dealsStatus?: string;
  dealsStartdate?: unknown;
  dealsEnddate?: unknown;
  dealsisFeatured?: boolean;
  businessId?: string;
  createdByRole?: string;
  role?: string;
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
};

function normalizeDate(raw: unknown): Date | null {
  if (!raw) return null;

  if (typeof raw === 'object' && raw !== null && 'toDate' in raw && typeof (raw as { toDate?: () => Date }).toDate === 'function') {
    return (raw as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(raw as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(raw: unknown): string {
  const date = normalizeDate(raw);
  if (!date) return 'N/A';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function titleForCategory(rawCategory?: string): string {
  const category = String(rawCategory || '').trim();
  return category || 'Deal';
}

function getDealTag(deal: DealRecord): string {
  const category = String(deal.dealsCategory || '').trim();
  if (category) return category;
  if (deal.businessId) return 'Business Deal';
  return 'Admin Deal';
}

function getStatusText(status?: string): string {
  const value = String(status || '').trim();
  return value || 'pending';
}

function isAdminDeal(deal: DealRecord): boolean {
  const category = String(deal.dealsCategory || '').toLowerCase().trim();
  const role = String(deal.createdByRole || deal.role || '').toLowerCase().trim();
  return category.includes('admin') || role === 'admin';
}

function isApprovedDeal(deal: DealRecord): boolean {
  const statuses = [deal.dealsStatus, deal.status, deal.approvalStatus]
    .map((value) => String(value || '').toLowerCase().trim())
    .filter(Boolean);

  if (deal.isApproved === true) return true;
  return statuses.includes('approved');
}

export default function DealsScreen() {
  const { profile } = useAccountStatus();
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDeals = async () => {
      try {
        setLoadError(null);
        const snapshot = await getDocs(collection(db, 'deals'));
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<DealRecord, 'id'>),
        }));

        items.sort((left, right) => {
          const rightTime = normalizeDate(right.dealsStartdate)?.getTime() ?? 0;
          const leftTime = normalizeDate(left.dealsStartdate)?.getTime() ?? 0;
          return rightTime - leftTime;
        });

        if (isMounted) {
          setDeals(items);
        }
      } catch (error) {
        console.error('Error loading deals:', error);
        if (isMounted) {
          setLoadError('Could not load deals right now. Please try again.');
          setDeals([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDeals();

    return () => {
      isMounted = false;
    };
  }, []);

  const viewerIsAdmin = String(profile?.role || '').toLowerCase() === 'admin';

  const visibleDeals = useMemo(() => {
    return deals.filter((deal) => isApprovedDeal(deal) && (viewerIsAdmin || !isAdminDeal(deal)));
  }, [deals, viewerIsAdmin]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <BackToCommunityHubRow />
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Deals</Text>
        <Text style={styles.heroSubtitle}>Browse local deals from businesses and service providers near you.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Featured Deals</Text>
        <Text style={styles.panelText}>
          Live deals from your Firestore collection: business, service provider, and admin posts.
        </Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#d97706" />
            <Text style={styles.stateText}>Loading deals...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{loadError}</Text>
          </View>
        ) : visibleDeals.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No deals are available to display right now.</Text>
          </View>
        ) : (
          <View style={styles.dealsGrid}>
            {visibleDeals.map((deal) => {
              const title = String(deal.dealsTitle || titleForCategory(deal.dealsCategory));
              const description = String(deal.dealsDescription || 'No description available yet.');

              return (
                <View key={deal.id} style={styles.dealCard}>
                  <Text style={styles.tag}>{getDealTag(deal)}</Text>
                  <Text style={styles.dealTitle}>{title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaChip}>{getStatusText(deal.dealsStatus)}</Text>
                    {deal.dealsisFeatured ? <Text style={styles.metaChip}>Featured</Text> : null}
                  </View>
                  <Text style={styles.dealDescription}>{description}</Text>
                  <Text style={styles.expiresText}>Starts: {formatDate(deal.dealsStartdate)}</Text>
                  <Text style={styles.expiresText}>Ends: {formatDate(deal.dealsEnddate)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  content: {
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0d8b2',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  panel: {
    marginHorizontal: 14,
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  panelText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4b5563',
    marginBottom: 14,
  },
  stateCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    textAlign: 'center',
  },
  dealsGrid: {
    gap: 12,
  },
  dealCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  tag: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  metaChip: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
    color: '#3730a3',
    backgroundColor: '#eef2ff',
  },
  dealDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    marginBottom: 8,
  },
  expiresText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 20,
    color: '#4b5563',
  },
});