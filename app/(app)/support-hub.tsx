import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type SupportCard = {
  title: string;
  description: string;
  route: string;
};

const SUPPORT_CARDS: SupportCard[] = [
  {
    title: 'Community Guidelines',
    description: 'Read the rules for safe and respectful use of Local List.',
    route: '/(app)/community-guidelines',
  },
  {
    title: 'Help',
    description: 'Find answers to common questions and account support topics.',
    route: '/(app)/help',
  },
  {
    title: 'Terms of Use',
    description: 'Review the legal terms that apply when using Local List.',
    route: '/(app)/termsOfUse',
  },
  {
    title: 'Privacy Policy',
    description: 'Learn how your information is collected and protected.',
    route: '/(app)/privacy',
  },
  {
    title: 'Contact Us',
    description: 'Reach out to support for help, concerns, or feedback.',
    route: '/(app)/contactus',
  },
];

export default function SupportHubScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.title}>Support and Legal Hub</Text>
        <Text style={styles.subtitle}>
          Find key support and policy resources in one place.
        </Text>
      </View>

      <View style={styles.grid}>
        {SUPPORT_CARDS.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => router.push(card.route as any)}
          >
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  },
  hero: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
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
  grid: {
    gap: 12,
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
  },
  cardDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
});