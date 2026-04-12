import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HubItem = {
  title: string;
  subtitle: string;
  emoji: string;
  route: string;
  params?: Record<string, string>;
};

const HUB_ITEMS: HubItem[] = [
  {
    title: 'Sell An Item',
    subtitle: 'Post items for local buyers',
    emoji: '🛒',
    route: '/create-listing',
    params: { category: 'Home' },
  },
  {
    title: 'Yard Sale',
    subtitle: 'Promote your garage or yard sale',
    emoji: '🏷️',
    route: '/create-yard-sale',
  },
 
  {
    title: 'Pet Lost',
    subtitle: 'Report a lost pet quickly',
    emoji: '🔎',
    route: '/create-pet-post',
  },
  {
    title: 'Pet Found',
    subtitle: 'Report a found pet',
    emoji: '🐾',
    route: '/create-pet-post',
    params: { type: 'found' },
  },
  {
    title: 'Adopt A Pet',
    subtitle: 'List pets for adoption',
    emoji: '💙',
    route: '/create-adoption-listing',
  },
   {
    title: 'Event',
    subtitle: 'Share upcoming local events',
    emoji: '🎉',
    route: '/create-event-listing',
  },
  
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  titleWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 24,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 126,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
});

export default function ListScreen() {
  const router = useRouter();
  const visibleItems = HUB_ITEMS;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>List Hub</Text>
        <Text style={styles.subtitle}>Choose the type of listing you want to create</Text>
      </View>

      <View style={styles.grid}>
        {visibleItems.map((item) => (
          <TouchableOpacity
            key={`${item.route}-${item.title}`}
            style={styles.card}
            activeOpacity={0.86}
            onPress={() => {
              router.push({
                pathname: item.route as any,
                params: item.params,
              });
            }}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
