import { useAccountStatus } from '@/hooks/useAccountStatus';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

type ReputationState = {
  loading: boolean;
  ratingAverage: number;
  ratingCount: number;
  newReviewsThisMonth: number;
  monthlyReviewTrend: number;
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function BusinessReputationScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && profile?.accountType === 'business';
  const [state, setState] = useState<ReputationState>({
    loading: true,
    ratingAverage: 0,
    ratingCount: 0,
    newReviewsThisMonth: 0,
    monthlyReviewTrend: 0,
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
        const profileData = (profile || {}) as any;

        const [userDoc, businessLocalDoc, reviewsSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)).catch(() => null),
          getDoc(doc(db, 'businessLocal', uid)).catch(() => null),
          getDocs(query(collection(db, 'businessReviews'), where('businessId', '==', uid), where('status', '==', 'approved'))).catch(() => null),
        ]);

        const userData = userDoc && userDoc.exists() ? userDoc.data() || {} : {};
        const businessData = businessLocalDoc && businessLocalDoc.exists() ? businessLocalDoc.data() || {} : {};

        const ratingAverage = Number(businessData.ratingAverage || userData.ratingAverage || profileData.ratingAverage || 0);
        const ratingCount = Number(businessData.ratingCount || userData.ratingCount || profileData.ratingCount || 0);

        let thisMonthCount = 0;
        let previousMonthCount = 0;

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        if (reviewsSnap && !reviewsSnap.empty) {
          reviewsSnap.forEach((snap) => {
            const data = snap.data() || {};
            const createdAt = toDate(data.createdAt);
            if (!createdAt) return;

            if (createdAt >= monthStart) thisMonthCount += 1;
            if (createdAt >= prevMonthStart && createdAt <= prevMonthEnd) previousMonthCount += 1;
          });
        }

        let monthlyReviewTrend = 0;
        if (previousMonthCount > 0) {
          monthlyReviewTrend = Math.round(((thisMonthCount - previousMonthCount) / previousMonthCount) * 100);
        } else if (thisMonthCount > 0) {
          monthlyReviewTrend = 100;
        }

        if (!cancelled) {
          setState({
            loading: false,
            ratingAverage,
            ratingCount,
            newReviewsThisMonth: thisMonthCount,
            monthlyReviewTrend,
          });
        }
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
  }, [hasBusinessAccess, user?.uid]);

  const trendLabel = useMemo(() => {
    const value = state.monthlyReviewTrend;
    return `${value >= 0 ? '+' : ''}${value}%`;
  }, [state.monthlyReviewTrend]);

  if (loading || waitingForProfile || state.loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading reputation metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasBusinessAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Business reputation is available for business accounts only.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Business Reputation</Text>
          <Text style={styles.heroSubtitle}>Track review quality and month-over-month momentum.</Text>
           <View style={styles.heroActions}>
             <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
               <Text style={styles.backBtnText}>Back to Business Hub</Text>
             </TouchableOpacity>
           </View>
        </View>

        <View style={styles.grid}>
          <Metric label="Average Rating" value={state.ratingCount > 0 ? state.ratingAverage.toFixed(1) : '0.0'} />
          <Metric label="Total Reviews" value={state.ratingCount.toLocaleString()} />
          <Metric label="New This Month" value={state.newReviewsThisMonth.toLocaleString()} />
          <Metric label="Monthly Trend" value={trendLabel} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
    marginBottom: 12,
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
    minHeight: 72,
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
});
