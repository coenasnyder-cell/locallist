import { Feather } from '@expo/vector-icons';
import { collection, getDocs, getFirestore, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

interface Spotlight {
  id: string;
  title: string;
  excerpt: string;
  story: string;
  image?: string;
  date: string;
  callToAction?: string;
}

interface CommunitySpotlightProps {
  onViewMore?: (spotlightId: string) => void;
}

export default function CommunitySpotlight({ onViewMore }: CommunitySpotlightProps) {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestSpotlight();
  }, []);

  const fetchLatestSpotlight = async () => {
    try {
      const db = getFirestore(app);
      const newsRef = collection(db, 'community_news');
      const q = query(
        newsRef,
        orderBy('date', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      // Find the first item with a story field (spotlight items have detailed stories)
      const spotlightDoc = snapshot.docs.find((doc) => {
        const data = doc.data();
        return data.story; // Spotlight items have a 'story' field
      });

      if (spotlightDoc) {
        const data = spotlightDoc.data();
        setSpotlight({
          id: spotlightDoc.id,
          title: data.title,
          excerpt: data.excerpt,
          story: data.story,
          image: data.image,
          date: data.date,
          callToAction: data.callToAction,
        });
      }
    } catch (error) {
      console.error('Error fetching community spotlight:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !spotlight) {
    return null;
  }

  return (
    <View style={styles.container}>
      {spotlight.image && (
        <Image
          source={{ uri: spotlight.image }}
          style={styles.headerImage}
        />
      )}
      
      <View style={styles.content}>
        <View style={styles.badgeContainer}>
          <Feather name="star" size={14} color="#FF6B35" />
          <Text style={styles.badge}>Community Spotlight</Text>
        </View>

        <Text style={styles.title}>{spotlight.title}</Text>
        
        <Text style={styles.excerpt}>{spotlight.excerpt}</Text>

        <Text style={styles.story}>{spotlight.story}</Text>

        {spotlight.callToAction && (
          <View style={styles.ctaContainer}>
            <Feather name="message-circle" size={16} color="#475569" />
            <Text style={styles.cta}>{spotlight.callToAction}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.viewMoreBtn}
          onPress={() => onViewMore?.(spotlight.id)}
        >
          <Text style={styles.viewMoreText}>Learn More</Text>
          <Feather name="arrow-right" size={16} color="#475569" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  headerImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
  },
  excerpt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 12,
    lineHeight: 20,
  },
  story: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  ctaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F0F8FF',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
    marginBottom: 16,
  },
  cta: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
  },
  viewMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
