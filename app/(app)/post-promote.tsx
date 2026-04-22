import { useAccountStatus } from '@/hooks/useAccountStatus';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type PromoteAction = {
  title: string;
  description: string;
  route: string;
  cta: string;
  params?: Record<string, string>;
};

const ACTIONS: PromoteAction[] = [
  {
    title: '🏪 Add A Business',
    description: 'Edit or update your existing business profile.',
    route: './businesslocal',
    cta: 'Open Business Profile',
  },
  {
    title: '💼 Job Post',
    description: 'Post hiring opportunities to reach local candidates.',
    route: './create-job-listing',
    cta: 'Create Job Post',
  },
  {
    title: '🔥 Deals',
    description: 'Promote discounts and special offers to local shoppers.',
    route: './create-deal-listing',
    cta: 'Create Deal',
  },
  {
    title: '🧰 Add A Service',
    description: 'List your professional services for local customers to find.',
    route: './create-listing',
    params: { category: 'Services' },
    cta: 'Create Service',
  },
];

export default function PostPromoteScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && profile?.accountType === 'business';

  if (loading || waitingForProfile) {
    return null;
  }

  if (!hasBusinessAccess) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.title}>Post & Promote</Text>
          <Text style={styles.subtitle}>Post & Promote is available for business accounts only.</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroBackBtn} onPress={() => router.back()}>
              <Text style={styles.heroBackBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.title}>Post & Promote</Text>
        <Text style={styles.subtitle}>
          Build and launch local promotions in minutes, then monitor impressions, clicks, and leads.
        </Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heroBackBtn} onPress={() => router.back()}>
            <Text style={styles.heroBackBtnText}>Back to Business Hub</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Post & Promote</Text>

      <View style={styles.panel}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.title}
            style={styles.actionCard}
            activeOpacity={0.88}
            onPress={() =>
              router.push({
                pathname: action.route as any,
                params: action.params,
              })
            }
          >
            <Text style={styles.actionTitle}>{action.title}</Text>
            <Text style={styles.actionDescription}>{action.description}</Text>
            <Text style={styles.actionLink}>{action.cta}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.infoPanelTitle}>Want To Manage Your Current Listings and Promotions?</Text>
        <Text style={styles.infoPanelSubtitle}>To view all your promotions and listings, go to Listings Manager.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('./business-listings')}>
          <Text style={styles.primaryBtnText}>Open Listings Manager</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  content: {
    padding: 14,
    paddingBottom: 28,
    gap: 12,
  },
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  heroActions: {
    marginTop: 10,
    alignItems: 'flex-end',
  },
  heroBackBtn: {
    borderRadius: 8,
    backgroundColor: '#334155',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  heroBackBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  panel: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#475569',
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionDescription: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  actionLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  infoPanel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  infoPanelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  infoPanelSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  primaryBtn: {
    borderRadius: 10,
    backgroundColor: '#0f766e',
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
