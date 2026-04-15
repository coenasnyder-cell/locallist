import { useAccountStatus } from '@/hooks/useAccountStatus';
import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

type AnalyticsState = {
  loading: boolean;
  activeListings: number;
  services: number;
  deals: number;
  activePromotions: number;
  promoImpressions: number;
  promoClicks: number;
  promoLeads: number;
  promoCtr: number;
  trackedCampaigns: number;
};

function toDateFromDateKey(dateKey: unknown): Date | null {
  if (typeof dateKey !== 'string') return null;
  const match = dateKey.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function BusinessAnalyticsScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && profile?.accountType === 'business';
  const [state, setState] = useState<AnalyticsState>({
    loading: true,
    activeListings: 0,
    services: 0,
    deals: 0,
    activePromotions: 0,
    promoImpressions: 0,
    promoClicks: 0,
    promoLeads: 0,
    promoCtr: 0,
    trackedCampaigns: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasBusinessAccess || !user?.uid) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        const db = getFirestore(app);
        const uid = user.uid;

        const [listingsSnap, servicesSnap, dealsSnap, promotionsSnap, promoStatsSnap] = await Promise.all([
          getDocs(query(collection(db, 'listings'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'services'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'deals'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'promotions'), where('businessId', '==', uid))),
          getDocs(query(collection(db, 'promotionDailyStats'), where('businessId', '==', uid))).catch(() => null),
        ]);

        let activeListings = 0;
        listingsSnap.forEach((snap) => {
          const data = snap.data() || {};
          const status = String(data.status || '').toLowerCase();
          if (status !== 'sold') activeListings += 1;
        });

        let services = 0;
        servicesSnap.forEach((snap) => {
          const data = snap.data() || {};
          const pending = data.isApproved === false || data.status === 'pending' || data.approvalStatus === 'pending';
          if (!pending) services += 1;
        });

        let deals = 0;
        dealsSnap.forEach((snap) => {
          const data = snap.data() || {};
          const status = String(data.status || '').toLowerCase();
          if (status !== 'pending') deals += 1;
        });

        let activePromotions = 0;
        promotionsSnap.forEach((snap) => {
          const data = snap.data() || {};
          if (String(data.status || '').toLowerCase() === 'active') activePromotions += 1;
        });

        let promoImpressions = 0;
        let promoClicks = 0;
        let promoLeads = 0;
        const tracked = new Set<string>();
        const now = new Date();
        const windowStart = new Date(now);
        windowStart.setDate(windowStart.getDate() - 6);
        windowStart.setHours(0, 0, 0, 0);

        if (promoStatsSnap && !promoStatsSnap.empty) {
          promoStatsSnap.forEach((snap) => {
            const data = snap.data() || {};
            const day = toDateFromDateKey(data.dateKey);
            if (!day || day < windowStart || day > now) return;

            promoImpressions += Number(data.impressions || 0);
            promoClicks += Number(data.clicks || 0);
            promoLeads += Number(data.leads || 0);
            if (data.promotionId) tracked.add(String(data.promotionId));
          });
        }

        const promoCtr = promoImpressions > 0 ? Math.round((promoClicks / promoImpressions) * 100) : 0;

        if (cancelled) return;
        setState({
          loading: false,
          activeListings,
          services,
          deals,
          activePromotions,
          promoImpressions,
          promoClicks,
          promoLeads,
          promoCtr,
          trackedCampaigns: tracked.size,
        });
      } catch (error) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, hasBusinessAccess]);

  if (loading || waitingForProfile || state.loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading business analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasBusinessAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Business analytics are available for business accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Business Analytics</Text>
          <Text style={styles.heroSubtitle}>Detailed performance snapshot for your business activity.</Text>
           <View style={styles.heroActions}>
             <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(tabs)/businesshubbutton')}>
               <Text style={styles.backBtnText}>Back to Business Hub</Text>
             </TouchableOpacity>
           </View>
        </View>

        <Text style={styles.sectionTitle}>Listings Overview</Text>
        <View style={styles.grid}>
          <Metric label="Active Listings" value={state.activeListings} />
          <Metric label="Services" value={state.services} />
          <Metric label="Deals" value={state.deals} />
          <Metric label="Active Promotions" value={state.activePromotions} />
        </View>

        <Text style={styles.sectionTitle}>Promotion Performance (Last 7 Days)</Text>
        <View style={styles.grid}>
          <Metric label="Impressions" value={state.promoImpressions} />
          <Metric label="Clicks" value={state.promoClicks} />
          <Metric label="Leads" value={state.promoLeads} />
          <Metric label="CTR" value={`${state.promoCtr}%`} />
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>{state.trackedCampaigns.toLocaleString()} campaigns produced tracked events in the last 7 days.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 12,
    paddingBottom: 24,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
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
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    minHeight: 70,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  noteCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 11,
  },
  noteText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
});
