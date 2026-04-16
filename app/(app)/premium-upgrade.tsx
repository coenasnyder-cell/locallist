import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth, db } from '@/firebase';
import { handleUpgrade, STRIPE_UPGRADE_CANCELED } from '@/lib/payments/handleUpgrade';

type CompareRow = { feature: string; free: 'yes' | 'no'; premium: 'yes' | 'no' };

const COMPARE_ROWS: CompareRow[] = [
  { feature: 'Business profile and posting', free: 'yes', premium: 'yes' },
  { feature: 'Messaging', free: 'yes', premium: 'yes' },
  { feature: 'Basic analytics', free: 'yes', premium: 'yes' },
  { feature: 'Customer interest insights', free: 'no', premium: 'yes' },
  { feature: 'Review management', free: 'no', premium: 'yes' },
  { feature: 'Featured placement', free: 'no', premium: 'yes' },
  { feature: 'Deals boost', free: 'no', premium: 'yes' },
];

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  toolbarTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  contentCentered: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#0f766e',
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 28,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.92)',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  sectionLead: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 20,
  },
  valueCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  valueEmoji: {
    fontSize: 20,
    marginBottom: 8,
    fontWeight: '800',
    color: '#0f766e',
  },
  valueTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  valueBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    minHeight: 44,
  },
  tableHeadRow: {
    borderTopWidth: 0,
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  tableCellFeature: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  tableColNarrow: {
    width: 72,
    alignItems: 'center',
  },
  tableIconCell: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tableHeadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cellIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellIconYes: {
    backgroundColor: '#16a34a',
  },
  cellIconNo: {
    backgroundColor: '#dc2626',
  },
  pricingText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
  },
  pricingStrong: {
    fontWeight: '800',
    color: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
    textAlign: 'center',
    maxWidth: 340,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0f766e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});

function CellIcon({ kind }: { kind: 'yes' | 'no' }) {
  if (kind === 'yes') {
    return (
      <View style={[styles.cellIcon, styles.cellIconYes]}>
        <Feather name="check" size={14} color="#fff" />
      </View>
    );
  }

  return (
    <View style={[styles.cellIcon, styles.cellIconNo]}>
      <Feather name="x" size={14} color="#fff" />
    </View>
  );
}

function ValueCard({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <View style={styles.valueCard}>
      <Text style={styles.valueEmoji} accessibilityLabel="">
        {label}
      </Text>
      <Text style={styles.valueTitle}>{title}</Text>
      <Text style={styles.valueBody}>{body}</Text>
    </View>
  );
}

export default function PremiumUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [alreadyPremium, setAlreadyPremium] = useState(false);

  const refreshPremiumStatus = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setAlreadyPremium(false);
      return false;
    }

    try {
      await user.reload();
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setAlreadyPremium(false);
        return false;
      }

      const data = userDoc.data();
      const tier = String(data?.businessTier || '').toLowerCase();
      const status = String(data?.premiumStatus || '').toLowerCase();
      const premium =
        (data?.isPremium === true && status === 'active') ||
        (String(data?.accountType || '').toLowerCase() === 'business' && tier === 'premium');

      setAlreadyPremium(Boolean(premium));
      return Boolean(premium);
    } catch (err) {
      console.warn('premium-upgrade: refresh failed', err);
      return false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPremiumStatus();
    }, [refreshPremiumStatus]),
  );

  async function onUpgradePress() {
    if (!auth.currentUser) {
      router.push({
        pathname: '/signInOrSignUp' as any,
        params: { mode: 'login', returnTo: '/premium-upgrade' },
      });
      return;
    }

    setBusy(true);
    try {
      const result = await handleUpgrade();

      if (result.success) {
        let premiumActive = false;

        for (let attempt = 0; attempt < 5; attempt += 1) {
          premiumActive = await refreshPremiumStatus();
          if (premiumActive) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (premiumActive) {
          Alert.alert('Premium active', 'You now have Premium business tools.', [
            {
              text: 'Go to Business Hub',
              onPress: () => router.replace('/(app)/business-hub'),
            },
            { text: 'OK', style: 'cancel' },
          ]);
        } else {
          Alert.alert(
            'Payment received',
            'Your checkout completed. Premium should activate shortly once the payment webhook finishes syncing your account.'
          );
        }
        return;
      }

      if (result.error === STRIPE_UPGRADE_CANCELED) {
        return;
      }

      if (result.error === 'Sign in to upgrade to Premium.') {
        router.push({
          pathname: '/signInOrSignUp' as any,
          params: { mode: 'login', returnTo: '/premium-upgrade' },
        });
        return;
      }

      console.log('premium-upgrade:', result.error);
      Alert.alert('Upgrade failed', result.error);
    } finally {
      setBusy(false);
    }
  }

  const onFreeBusinessPress = () => {
    router.push('/(app)/upgrade-business' as any);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/shoplocallist'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          Business: Free or Premium
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {alreadyPremium ? (
        <View style={styles.contentCentered}>
          <Text style={styles.title}>You&apos;re on Premium</Text>
          <Text style={styles.body}>Manage your business from Business Hub.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(app)/business-hub')}>
            <Text style={styles.primaryBtnText}>Business Hub</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>Local List for Business</Text>
              <Text style={styles.heroTitle}>Get your business seen by more local customers</Text>
              <Text style={styles.heroSubtitle}>
                Reach locals with featured placement, deeper analytics, and reputation tools, or start free and upgrade
                anytime.
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Why businesses choose Premium</Text>
              </View>
              <ValueCard
                label="TOP"
                title="Get seen first"
                body="Featured placement puts listings, services, and deals in front of shoppers when it matters."
              />
              <ValueCard
                label="DATA"
                title="Understand customers"
                body="Go beyond views with richer analytics like clicks, trends, and promotion tracking."
              />
              <ValueCard
                label="TRUST"
                title="Build trust"
                body="Review tools and a stronger presence help customers choose you with confidence."
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Free vs Premium</Text>
              </View>
              <Text style={styles.sectionLead}>Compare what&apos;s included at a glance.</Text>

              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeadRow]}>
                  <Text style={[styles.tableCell, styles.tableCellFeature, styles.tableHeadText]}>Feature</Text>
                  <Text style={[styles.tableCell, styles.tableColNarrow, styles.tableHeadText]}>Free</Text>
                  <Text style={[styles.tableCell, styles.tableColNarrow, styles.tableHeadText]}>Premium</Text>
                </View>
                {COMPARE_ROWS.map((row) => (
                  <View key={row.feature} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableCellFeature]}>{row.feature}</Text>
                    <View style={[styles.tableCell, styles.tableColNarrow, styles.tableIconCell]}>
                      <CellIcon kind={row.free} />
                    </View>
                    <View style={[styles.tableCell, styles.tableColNarrow, styles.tableIconCell]}>
                      <CellIcon kind={row.premium} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Simple pricing</Text>
              </View>
              <Text style={styles.pricingText}>
                Premium is <Text style={styles.pricingStrong}>$10/month</Text>. Pay in the app with Apple Pay or card.
                Cancel anytime. Free accounts stay free, add your business and grow at your pace.
              </Text>
            </View>

            <View style={{ height: 120 }} />
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={onFreeBusinessPress}
              accessibilityRole="button"
              accessibilityLabel="Create a free business account"
            >
              <Text style={styles.outlineBtnText}>Free business</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              onPress={() => void onUpgradePress()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Premium with in-app payment"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Premium - checkout</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}
