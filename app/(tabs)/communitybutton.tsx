import { useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type CommunityItem = {
  emoji: string;
  title: string;
  subtitle: string;
  accentColor: string;
  route: string;
};

const ITEMS: CommunityItem[] = [
  {
    emoji: '🐾',
    title: 'The Pet Corner',
    subtitle: 'Lost & found pets, adoptions',
    accentColor: '#7C3AED',
    route: '/(tabs)/petbutton',
  },
  {
    emoji: '💼',
    title: 'Job Board',
    subtitle: 'Local job opportunities',
    accentColor: '#0066cc',
    route: '/(app)/joblistings',
  },
  {
    emoji: '🛍️',
    title: 'Deals',
    subtitle: 'Featured and promoted listings',
    accentColor: '#D97706',
    route: '/deals',
  },
  {
    emoji: '🎉',
    title: 'Events',
    subtitle: 'Local events & happenings',
    accentColor: '#059669',
    route: '/eventslist',
  },
  {
    emoji: '🏷️',
    title: 'Yard Sales',
    subtitle: 'Garage & yard sales near you',
    accentColor: '#DC2626',
    route: '/yardsalelistings',
  },
  {
    emoji: '🛍️',
    title: 'Explore Local Businesses',
    subtitle: 'Browse trusted local businesses',
    accentColor: '#475569',
    route: '/(app)/shoplocallist',
  },
  {
    emoji: '🧰',
    title: 'Services',
    subtitle: 'Find local professionals for hire',
    accentColor: '#0F766E',
    route: '/(app)/serviceslist',
  },
];

export default function CommunityScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Community</Text>
        <Text style={styles.heroSubtitle}>
          Everything happening in your local area
        </Text>
      </View>

      <View style={styles.grid}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.iconCircle, { backgroundColor: item.accentColor + '18' }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            <View style={[styles.pill, { backgroundColor: item.accentColor }]}>
              <Text style={styles.pillText}>Explore →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  hero: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '47.5%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 26,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 14,
    lineHeight: 17,
  },
  pill: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  bottomPad: {
    height: 80,
  },
});
