import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BETA_COHORTS = [
  'New users: sign up and first listing in < 2 minutes',
  'Sellers: draft restore, photo upload, featured checkout',
  'Browsers: search, category filters, listing details, messaging',
  'Business users: profile, services, events, and promotions',
];

const BETA_DEVICES = [
  'Android 12+ (low/mid/high tier)',
  'iOS 16+ (at least 2 different iPhone models)',
  'Low-bandwidth test pass (3G throttled)',
  'Permission-denied scenarios (camera/photos/location)',
];

const FEEDBACK_TEMPLATE = [
  'Device + OS version',
  'Build number + environment (preview/production)',
  'Steps to reproduce',
  'Expected result',
  'Actual result',
  'Screenshots or video if available',
].join('\n- ');

export default function BetaTestingScreen() {
  const router = useRouter();

  const openReleaseChecklist = () => {
    Linking.openURL('https://local-list-wski21.web.app/support-legal-hub.html').catch(() => {
      Alert.alert('Unable to open link', 'Please try again in a moment.');
    });
  };

  const openFeedbackForm = () => {
    router.push('/(app)/beta-feedback' as any);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>Beta Testing Program</Text>
        <Text style={styles.subtitle}>
          Use this rollout to validate quality gates, compliance behavior, and real-device stability before store submission.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Scope</Text>
        {BETA_COHORTS.map((item) => (
          <Text key={item} style={styles.item}>- {item}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Matrix</Text>
        {BETA_DEVICES.map((item) => (
          <Text key={item} style={styles.item}>- {item}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bug Report Format</Text>
        <Text style={styles.item}>- {FEEDBACK_TEMPLATE}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exit Criteria</Text>
        <Text style={styles.item}>- No P0/P1 issues open</Text>
        <Text style={styles.item}>- Startup median {'<='} 3s on test devices</Text>
        <Text style={styles.item}>- Funnel events recorded for all core flows</Text>
        <Text style={styles.item}>- Featured checkout pass rate {'>='} 99%</Text>
      </View>

      <TouchableOpacity style={styles.cta} onPress={openFeedbackForm}>
        <Text style={styles.ctaText}>Submit Beta Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ctaSecondary} onPress={openReleaseChecklist}>
        <Text style={styles.ctaSecondaryText}>Open Legal/Release Hub</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5e1',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  item: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    marginBottom: 4,
  },
  cta: {
    marginTop: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  ctaSecondary: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: '#1e293b',
    fontSize: 14,
    fontWeight: '700',
  },
});
