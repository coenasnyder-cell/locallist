import Header from '@/components/Header';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import { Redirect, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../firebase';

type HubTool = {
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
};

type HubAnalytics = {
  loading: boolean;
  profileViews: number;
  activeListings: number;
  services: number;
  deals: number;
  activePromotions: number;
  unreadThreads: number;
  ratingAverage: number;
  ratingCount: number;
  newReviewsThisMonth: number;
  monthlyReviewTrend: number;
  promoImpressions: number;
  promoClicks: number;
  promoLeads: number;
  promoCtr: number;
  promoTrackedCampaigns: number;
};

export default function BusinessHubScreen({ showHeader = true }: { showHeader?: boolean }) {
  const router = useRouter();
  const { user, profile, loading, isBusinessAccount } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const [analytics, setAnalytics] = useState<HubAnalytics>({
    loading: true,
    profileViews: 0,
    activeListings: 0,
    services: 0,
    deals: 0,
    activePromotions: 0,
    unreadThreads: 0,
    ratingAverage: 0,
    ratingCount: 0,
    newReviewsThisMonth: 0,
    monthlyReviewTrend: 0,
    promoImpressions: 0,
    promoClicks: 0,
    promoLeads: 0,
    promoCtr: 0,
    promoTrackedCampaigns: 0,
  });

  const displayName = profile?.displayName || user?.displayName || 'Business User';
  const email = user?.email || profile?.email || '';

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      if (!user?.uid || !isBusinessAccount) {
        if (!cancelled) {
          setAnalytics((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        if (!cancelled) {
          setAnalytics((prev) => ({ ...prev, loading: true }));
        }

        const db = getFirestore(app);
        const uid = user.uid;

        const toDateFromDateKey = (dateKey: unknown): Date | null => {
          if (typeof dateKey !== 'string') return null;
          const match = dateKey.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!match) return null;
          const year = Number(match[1]);
          const month = Number(match[2]);
          const day = Number(match[3]);
          if (!year || !month || !day) return null;
          return new Date(year, month - 1, day);
        };

        const [businessLocalDoc, listingsSnap, servicesSnap, dealsSnap, promotionsSnap, threadsSnap, reviewsSnap, promoStatsSnap] = await Promise.all([
          getDoc(doc(db, 'businessLocal', uid)).catch(() => null),
          getDocs(query(collection(db, 'listings'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'services'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'deals'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'promotions'), where('businessId', '==', uid))),
          getDocs(query(collection(db, 'threads'), where('participantIds', 'array-contains', uid))),
          getDocs(query(collection(db, 'businessReviews'), where('businessId', '==', uid), where('status', '==', 'approved'))).catch(() => null),
          getDocs(query(collection(db, 'promotionDailyStats'), where('businessId', '==', uid))).catch(() => null),
        ]);

        const businessData = businessLocalDoc && businessLocalDoc.exists() ? businessLocalDoc.data() || {} : {};
        const profileData = (profile || {}) as any;
        const profileViews = Number(businessData.viewCount || profileData.viewCount || 0);
        const ratingAverage = Number(businessData.ratingAverage || profileData.ratingAverage || 0);
        const ratingCount = Number(businessData.ratingCount || profileData.ratingCount || 0);

        let activeListings = 0;
        listingsSnap.forEach((snap) => {
          const data = snap.data() || {};
          const status = String(data.status || '').toLowerCase();
          if (status !== 'sold') {
            activeListings += 1;
          }
        });

        let activeServices = 0;
        servicesSnap.forEach((snap) => {
          const data = snap.data() || {};
          const pending = data.isApproved === false || data.status === 'pending' || data.approvalStatus === 'pending';
          if (!pending) {
            activeServices += 1;
          }
        });

        let activeDeals = 0;
        dealsSnap.forEach((snap) => {
          const data = snap.data() || {};
          const status = String(data.status || '').toLowerCase();
          if (status !== 'pending') {
            activeDeals += 1;
          }
        });

        let activePromotions = 0;
        promotionsSnap.forEach((snap) => {
          const data = snap.data() || {};
          if (String(data.status || '').toLowerCase() === 'active') {
            activePromotions += 1;
          }
        });

        let unreadThreads = 0;
        threadsSnap.forEach((snap) => {
          const data = snap.data() || {};
          const unreadBy = Array.isArray(data.unreadBy) ? data.unreadBy : [];
          if (unreadBy.includes(uid)) {
            unreadThreads += 1;
          }
        });

        let newReviewsThisMonth = 0;
        let previousMonthReviews = 0;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        if (reviewsSnap && !reviewsSnap.empty) {
          reviewsSnap.forEach((snap) => {
            const data = snap.data() || {};
            const ts = data.createdAt && typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate() : null;
            if (!ts) return;
            if (ts >= monthStart) newReviewsThisMonth += 1;
            if (ts >= prevMonthStart && ts <= prevMonthEnd) previousMonthReviews += 1;
          });
        }

        let monthlyReviewTrend = 0;
        if (previousMonthReviews > 0) {
          monthlyReviewTrend = Math.round(((newReviewsThisMonth - previousMonthReviews) / previousMonthReviews) * 100);
        } else if (newReviewsThisMonth > 0) {
          monthlyReviewTrend = 100;
        }

        let promoImpressions = 0;
        let promoClicks = 0;
        let promoLeads = 0;
        const trackedCampaigns = new Set<string>();
        const promoWindowStart = new Date(now);
        promoWindowStart.setDate(promoWindowStart.getDate() - 6);
        promoWindowStart.setHours(0, 0, 0, 0);

        if (promoStatsSnap && !promoStatsSnap.empty) {
          promoStatsSnap.forEach((snap) => {
            const data = snap.data() || {};
            const day = toDateFromDateKey(data.dateKey);
            if (!day || day < promoWindowStart || day > now) return;

            promoImpressions += Number(data.impressions || 0);
            promoClicks += Number(data.clicks || 0);
            promoLeads += Number(data.leads || 0);
            if (data.promotionId) trackedCampaigns.add(String(data.promotionId));
          });
        }

        const promoCtr = promoImpressions > 0 ? Math.round((promoClicks / promoImpressions) * 100) : 0;

        if (!cancelled) {
          setAnalytics({
            loading: false,
            profileViews,
            activeListings,
            services: activeServices,
            deals: activeDeals,
            activePromotions,
            unreadThreads,
            ratingAverage,
            ratingCount,
            newReviewsThisMonth,
            monthlyReviewTrend,
            promoImpressions,
            promoClicks,
            promoLeads,
            promoCtr,
            promoTrackedCampaigns: trackedCampaigns.size,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setAnalytics((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [isBusinessAccount, profile, user?.uid]);

  if (!loading && !user) {
    return <Redirect href="/signInOrSignUp" />;
  }

  // If this screen is opened as a standalone route, bounce to the tabs route
  // so the bottom tab bar is always visible for business users.
  if (!loading && user && profile && isBusinessAccount && showHeader) {
    return <Redirect href="/(tabs)/businesshubbutton" />;
  }

  if (!loading && user && profile && !isBusinessAccount) {
    return <Redirect href="/(tabs)/profilebutton" />;
  }

  const tools: HubTool[] = [
    {
      title: 'Business Settings',
      description: 'Update your business profile details, contact information, and branding.',
      cta: 'Open Settings',
      onPress: () => router.push('/business-settings'),
    },
    {
      title: 'Listings Manager',
      description: 'Manage your marketplace listings, services, and deal content in one place.',
      cta: 'Open Listings',
      onPress: () => router.push('/business-listings'),
    },
    {
      title: 'Post & Promote',
      description: 'Create jobs, deals, and service posts to grow your local visibility.',
      cta: 'Open Post & Promote',
      onPress: () => router.push('/post-promote'),
    },
    {
      title: 'Performance Analytics',
      description: 'View detailed analytics and metrics for your business activity and performance.',
      cta: 'Open Analytics',
      onPress: () => router.push('/business-analytics'),
    },
    {
      title: 'Leads and Inbox',
      description: 'Track inbound inquiries and unread conversations from shoppers.',
      cta: 'Open Leads & Inbox',
      onPress: () => router.push('/threadchat'),
    },
    {
      title: 'Reputation Tools',
      description: 'Review snapshot and momentum for your business profile.',
      cta: 'Open Reputation',
      onPress: () => router.push('/business-reputation'),
    },
  ];

  const claimOwnershipRequest = Boolean((profile as any)?.claimOwnershipRequest);
  const claimStatus = String((profile as any)?.claimStatus || '');
  const claimInProgress = claimOwnershipRequest || claimStatus === 'pending' || claimStatus === 'under_review';
  const claimApproved = claimStatus === 'approved';
  const claimDenied = claimStatus === 'denied';

  if (loading || waitingForProfile) {
    return (
      <SafeAreaView style={styles.container}>
        {showHeader ? <Header /> : null}
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading Business Hub...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {showHeader ? <Header /> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.userSummary}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{String(displayName).trim().charAt(0).toUpperCase() || 'B'}</Text>
          </View>
          <View style={styles.userTextWrap}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userEmail}>{email}</Text>
            <View style={styles.userActions}>
              <TouchableOpacity onPress={() => router.push('/business-settings')}>
                <Text style={styles.inlineLink}>Update Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/blocked-users')}>
                <Text style={styles.inlineLink}>Blocked Users</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Business account access active.</Text>
        </View>

        <View style={styles.claimSetupCard}>
          <Text style={styles.claimSetupTitle}>Finish Your Business Claim</Text>
          <Text style={styles.claimSetupSub}>
            Follow these steps to claim an existing listing and submit documentation for admin review.
          </Text>

          <View style={styles.claimSetupStepRow}>
            <View style={[styles.claimSetupStepDot, styles.claimSetupStepDotDone]}>
              <Text style={styles.claimSetupStepDotText}>1</Text>
            </View>
            <View style={styles.claimSetupStepTextWrap}>
              <Text style={styles.claimSetupStepTitle}>Find the business listing</Text>
              <Text style={styles.claimSetupStepText}>Open Local Businesses and select your business profile.</Text>
            </View>
          </View>

          <View style={styles.claimSetupStepRow}>
            <View style={[styles.claimSetupStepDot, claimInProgress || claimApproved ? styles.claimSetupStepDotDone : styles.claimSetupStepDotPending]}>
              <Text style={styles.claimSetupStepDotText}>2</Text>
            </View>
            <View style={styles.claimSetupStepTextWrap}>
              <Text style={styles.claimSetupStepTitle}>Tap Claim This Business</Text>
              <Text style={styles.claimSetupStepText}>Start the claim flow on the public business profile screen.</Text>
            </View>
          </View>

          <View style={styles.claimSetupStepRow}>
            <View style={[styles.claimSetupStepDot, claimInProgress || claimApproved ? styles.claimSetupStepDotDone : styles.claimSetupStepDotPending]}>
              <Text style={styles.claimSetupStepDotText}>3</Text>
            </View>
            <View style={styles.claimSetupStepTextWrap}>
              <Text style={styles.claimSetupStepTitle}>Submit documentation</Text>
              <Text style={styles.claimSetupStepText}>Include ownership proof images and a clear claim message in the claim modal.</Text>
            </View>
          </View>

          <View style={styles.claimDocsBox}>
            <Text style={styles.claimDocsTitle}>Suggested proof documents</Text>
            <Text style={styles.claimDocsItem}>• Business license or registration certificate</Text>
            <Text style={styles.claimDocsItem}>• Utility bill or tax document showing business name and address</Text>
            <Text style={styles.claimDocsItem}>• Government-issued ID matching the business owner or manager</Text>
          </View>

          <View style={styles.claimSetupActions}>
            <TouchableOpacity style={styles.claimSetupButton} onPress={() => router.push('/(app)/shoplocallist')}>
              <Text style={styles.claimSetupButtonText}>Open Local Businesses</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.claimSetupSecondaryButton}
              onPress={() => router.push('/business-settings')}
            >
              <Text style={styles.claimSetupSecondaryButtonText}>Update Business Details</Text>
            </TouchableOpacity>
          </View>

          {claimApproved ? (
            <Text style={styles.claimSetupSuccess}>Your claim is approved. Your business ownership is now confirmed.</Text>
          ) : claimDenied ? (
            <Text style={styles.claimSetupWarning}>Your last claim was denied. You can resubmit with stronger proof documents.</Text>
          ) : claimInProgress ? (
            <Text style={styles.claimSetupInfo}>Claim submitted. Monitor status below while admins review your documents.</Text>
          ) : null}
        </View>

        {claimOwnershipRequest && (
          <View style={styles.claimProgressCard}>
            <Text style={styles.claimProgressTitle}>Business Claim Status</Text>
            <Text style={styles.claimProgressSub}>
              Our team will review your claim and reach out if additional information is needed.
            </Text>
            {[
              {
                label: 'Claim Submitted',
                done: true,
                active: false,
                denied: false,
                note: 'Your claim request has been received.',
              },
              {
                label: 'Admin Review',
                done: claimStatus === 'approved' || claimStatus === 'denied',
                active: claimStatus === 'under_review',
                denied: false,
                note:
                  claimStatus === 'approved' || claimStatus === 'denied'
                    ? 'Review complete.'
                    : claimStatus === 'under_review'
                    ? 'Being reviewed by our team.'
                    : 'Awaiting review.',
              },
              {
                label: 'Claim Decision',
                done: claimStatus === 'approved',
                active: false,
                denied: claimStatus === 'denied',
                note:
                  claimStatus === 'approved'
                    ? 'Your claim has been approved!'
                    : claimStatus === 'denied'
                    ? 'Claim not approved. Please contact support.'
                    : 'Pending a decision.',
              },
            ].map((step, i) => (
              <View key={step.label}>
                {i > 0 && <View style={styles.claimStepLine} />}
                <View style={styles.claimStepRow}>
                  <View
                    style={[
                      styles.claimStepDot,
                      step.done && styles.claimStepDotDone,
                      step.active && styles.claimStepDotActive,
                      step.denied && styles.claimStepDotDenied,
                    ]}
                  >
                    <Text style={styles.claimStepDotText}>
                      {step.done ? '✓' : step.denied ? '✕' : step.active ? '·' : '○'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.claimStepLabel,
                        (step.done || step.active) && styles.claimStepLabelActive,
                        step.denied && styles.claimStepLabelDenied,
                      ]}
                    >
                      {step.label}
                    </Text>
                    <Text style={styles.claimStepNote}>{step.note}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Analytics Snapshot</Text>
        <View style={styles.analyticsPanel}>
          {analytics.loading ? (
            <Text style={styles.analyticsLoading}>Loading analytics...</Text>
          ) : (
            <View style={styles.analyticsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Profile Views</Text>
                <Text style={styles.metricValue}>{analytics.profileViews.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Active Listings</Text>
                <Text style={styles.metricValue}>{analytics.activeListings.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Services</Text>
                <Text style={styles.metricValue}>{analytics.services.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Deals</Text>
                <Text style={styles.metricValue}>{analytics.deals.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Active Promotions</Text>
                <Text style={styles.metricValue}>{analytics.activePromotions.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Unread Threads</Text>
                <Text style={styles.metricValue}>{analytics.unreadThreads.toLocaleString()}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Average Rating</Text>
                <Text style={styles.metricValue}>{analytics.ratingCount > 0 ? analytics.ratingAverage.toFixed(1) : '0.0'}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Reviews</Text>
                <Text style={styles.metricValue}>{analytics.ratingCount.toLocaleString()}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Business Tools</Text>

        <View style={styles.grid}>
          {tools.map((tool) => (
            <View key={tool.title} style={styles.card}>
              <Text style={styles.cardTitle}>{tool.title}</Text>
              <Text style={styles.cardDescription}>{tool.description}</Text>
              <TouchableOpacity style={styles.cardButton} onPress={tool.onPress}>
                <Text style={styles.cardButtonText}>{tool.cta}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            try {
              const auth = getAuth(app);
              await auth.signOut();
            } catch (error) {
              Alert.alert('Logout Error', 'Could not sign out right now. Please try again.');
            } finally {
              router.replace('/signInOrSignUp');
            }
          }}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 12,
    paddingBottom: 80,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  userSummary: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  userTextWrap: {
    flex: 1,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 8,
  },
  userActions: {
    flexDirection: 'row',
    gap: 14,
  },
  inlineLink: {
    fontSize: 14,
    color: '#1e3a8a',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  statusBanner: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  analyticsPanel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
  },
  analyticsLoading: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    padding: 6,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  analyticsFootnote: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    marginBottom: 8,
  },
  secondaryAction: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  secondaryActionText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#f8fafc',
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
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  card: {
    width: '48%',
    minHeight: 185,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  claimProgressCard: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 14,
  },
  claimProgressTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  claimProgressSub: {
    fontSize: 13,
    color: '#3b82f6',
    marginBottom: 14,
    lineHeight: 18,
  },
  claimStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  claimStepLine: {
    width: 2,
    height: 12,
    backgroundColor: '#bfdbfe',
    marginLeft: 11,
    marginVertical: 2,
  },
  claimStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  claimStepDotDone: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  claimStepDotActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  claimStepDotDenied: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c',
  },
  claimStepDotText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  claimStepLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  claimStepLabelActive: {
    color: '#0f172a',
  },
  claimStepLabelDenied: {
    color: '#dc2626',
  },
  claimStepNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
    lineHeight: 16,
  },
  claimSetupCard: {
    marginTop: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 14,
  },
  claimSetupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#9a3412',
    marginBottom: 4,
  },
  claimSetupSub: {
    fontSize: 13,
    color: '#b45309',
    lineHeight: 18,
    marginBottom: 12,
  },
  claimSetupStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  claimSetupStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  claimSetupStepDotDone: {
    backgroundColor: '#16a34a',
    borderColor: '#15803d',
  },
  claimSetupStepDotPending: {
    backgroundColor: '#fdba74',
    borderColor: '#f97316',
  },
  claimSetupStepDotText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  claimSetupStepTextWrap: {
    flex: 1,
  },
  claimSetupStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7c2d12',
    marginBottom: 2,
  },
  claimSetupStepText: {
    fontSize: 12,
    color: '#9a3412',
    lineHeight: 17,
  },
  claimDocsBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 10,
    marginBottom: 10,
  },
  claimDocsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9a3412',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  claimDocsItem: {
    fontSize: 12,
    color: '#7c2d12',
    lineHeight: 17,
    marginBottom: 2,
  },
  claimSetupActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  claimSetupButton: {
    backgroundColor: '#ea580c',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  claimSetupButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  claimSetupSecondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fb923c',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  claimSetupSecondaryButtonText: {
    color: '#9a3412',
    fontSize: 12,
    fontWeight: '700',
  },
  claimSetupSuccess: {
    marginTop: 10,
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  claimSetupWarning: {
    marginTop: 10,
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '700',
  },
  claimSetupInfo: {
    marginTop: 10,
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '700',
  },
});
