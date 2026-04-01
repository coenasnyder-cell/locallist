import { Feather } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, getFirestore, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

const COMMUNITY_SPOTLIGHT_FONT_SIZE = 20;

interface NewsItem {
  id: string;
  title: string;
  image?: string;
  date: string;
  story?: string;
  callToAction?: string;
  ctaUrl?: string;
  isSpotlight?: boolean;
}

interface CommunityNewsProps {
  onNewsPress?: (newsId: string) => void;
}

interface CommunityDisplaySettings {
  showSpotlight: boolean;
  showNews: boolean;
  spotlightHeadline?: string;
  spotlightDescription?: string;
  spotlightImageUrl?: string;
  spotlightCtaText?: string;
  spotlightCtaUrl?: string;
}

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
  showSpotlight: true,
  showNews: false,
  spotlightHeadline: '',
  spotlightDescription: '',
  spotlightImageUrl: '',
  spotlightCtaText: '',
  spotlightCtaUrl: '',
};

export default function CommunityNews({ onNewsPress }: CommunityNewsProps) {
  const [spotlight, setSpotlight] = useState<NewsItem | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStoryExpanded, setIsStoryExpanded] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    fetchCommunityNews();
  }, []);

  const fetchCommunityNews = async () => {
    try {
      const db = getFirestore(app);
      const settingsRef = doc(db, 'community_settings', 'display');
      const settingsSnapshot = await getDoc(settingsRef);
      const settingsData = settingsSnapshot.exists()
        ? (settingsSnapshot.data() as Partial<CommunityDisplaySettings>)
        : {};

      const newSettings = {
        showSpotlight: settingsData.showSpotlight ?? DEFAULT_DISPLAY_SETTINGS.showSpotlight,
        showNews: settingsData.showNews ?? DEFAULT_DISPLAY_SETTINGS.showNews,
        spotlightHeadline: settingsData.spotlightHeadline ?? DEFAULT_DISPLAY_SETTINGS.spotlightHeadline,
        spotlightDescription: settingsData.spotlightDescription ?? DEFAULT_DISPLAY_SETTINGS.spotlightDescription,
        spotlightImageUrl: settingsData.spotlightImageUrl ?? DEFAULT_DISPLAY_SETTINGS.spotlightImageUrl,
        spotlightCtaText: settingsData.spotlightCtaText ?? DEFAULT_DISPLAY_SETTINGS.spotlightCtaText,
        spotlightCtaUrl: settingsData.spotlightCtaUrl ?? DEFAULT_DISPLAY_SETTINGS.spotlightCtaUrl,
      };
      setDisplaySettings(newSettings);

      const hasAdminSpotlightContent = [
        newSettings.spotlightHeadline,
        newSettings.spotlightDescription,
        newSettings.spotlightImageUrl,
        newSettings.spotlightCtaText,
      ].some((value) => typeof value === 'string' && value.trim().length > 0);

      const newsRef = collection(db, 'community_news');
      const q = query(
        newsRef,
        orderBy('date', 'desc'),
        limit(10)
      );

      const snapshot = await getDocs(q);
      
      const allItems: NewsItem[] = snapshot.docs.map((doc) => {
        return {
          id: doc.id,
          ...(doc.data() as Omit<NewsItem, 'id'>),
        };
      });

      const toMillis = (value: any) => {
        if (!value) return 0;
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (typeof value?.seconds === 'number') return value.seconds * 1000;
        const parsed = new Date(value).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      // Prefer admin-selected spotlight; fallback to legacy story-based spotlight.
      const spotlightCandidates = allItems.filter((item) => item.isSpotlight === true);
      const fallbackCandidates = allItems.filter((item) => item.story);
      const firestoreSpotlightItem = (spotlightCandidates.length > 0 ? spotlightCandidates : fallbackCandidates)
        .sort((a, b) => toMillis(b.date) - toMillis(a.date))[0];
      const newsItems = allItems.filter((item) => item.id !== firestoreSpotlightItem?.id);

      if (hasAdminSpotlightContent) {
        setSpotlight({
          id: 'admin-spotlight',
          title: (newSettings.spotlightHeadline || '').trim() || 'Community Spotlight',
          story: (newSettings.spotlightDescription || '').trim() || '',
          image: (newSettings.spotlightImageUrl || '').trim() || undefined,
          callToAction: (newSettings.spotlightCtaText || '').trim() || undefined,
          ctaUrl: (newSettings.spotlightCtaUrl || '').trim() || undefined,
          date: new Date().toISOString(),
          isSpotlight: true,
        });
      } else {
        setSpotlight(firestoreSpotlightItem || null);
      }

      setIsStoryExpanded(false);
      setNews(newsItems);
    } catch (error) {
      // Silently handle errors when not logged in or no data available
      setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const shouldShowSpotlight = displaySettings.showSpotlight && !!spotlight;
  const shouldShowNews = displaySettings.showNews && news.length > 0;

  const isValidHttpUrl = (url?: string) => {
    if (!url) return false;
    return /^https?:\/\//i.test(url.trim());
  };

  const handleSpotlightCtaPress = async () => {
    const ctaUrl = spotlight?.ctaUrl;
    if (!ctaUrl || !isValidHttpUrl(ctaUrl)) return;

    try {
      await Linking.openURL(ctaUrl.trim());
    } catch (error) {
      console.error('Failed to open spotlight CTA URL:', error);
    }
  };

  if (loading || (!shouldShowSpotlight && !shouldShowNews)) {
    return null;
  }

  const formatDate = (value: any) => {
    try {
      if (!value) return '';
      const date = (typeof value === 'object' && typeof value.toDate === 'function')
        ? value.toDate()
        : (typeof value?.seconds === 'number')
          ? new Date(value.seconds * 1000)
          : new Date(value);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return '';
    }
  };

  return (
    <View>
      {/* Spotlight Section */}
      {shouldShowSpotlight && spotlight && (
        <View style={styles.spotlightContainer}>
          <View style={styles.spotlightBadgeContainer}>
            <Text style={styles.badge}>Community Spotlight</Text>
          </View>
          {spotlight.image && (
            <View style={styles.spotlightImageFrame}>
              <Image
                source={{ uri: spotlight.image }}
                style={styles.spotlightImage}
              />
            </View>
          )}
          <View style={styles.spotlightTitleContainer}>
            <Text style={styles.spotlightTitle}>{spotlight.title}</Text>
          </View>
          
          <View style={styles.spotlightContent}>
            <Text style={styles.spotlightDate}>{formatDate(spotlight.date)}</Text>

            {spotlight.story && (
              <Text style={styles.spotlightStory} numberOfLines={isStoryExpanded ? undefined : 3}>
                {spotlight.story}
              </Text>
            )}

            {spotlight.story && (
              <TouchableOpacity 
                style={styles.viewMoreBtn}
                onPress={() => setIsStoryExpanded((prev) => !prev)}
              >
                <Text style={styles.viewMoreText}>
                  {isStoryExpanded ? 'Show Less' : 'Read More'}
                </Text>
                <Feather name={isStoryExpanded ? 'chevron-up' : 'arrow-right'} size={14} color="#475569" />
              </TouchableOpacity>
            )}

            {spotlight.callToAction && (
              isValidHttpUrl(spotlight.ctaUrl) ? (
                <TouchableOpacity style={styles.spotlightCtaButton} onPress={handleSpotlightCtaPress}>
                  <Text style={styles.spotlightCtaButtonText}>{spotlight.callToAction}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.ctaContainer}>
                  <Feather name="message-circle" size={14} color="#475569" />
                  <Text style={styles.cta}>{spotlight.callToAction}</Text>
                </View>
              )
            )}
          </View>
        </View>
      )}

      {/* News Section */}
      {shouldShowNews && (
        <View style={styles.newsSection}>
          <View style={styles.headerSection}>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Feather name="rss" size={24} color="#475569" />
              </View>
              <View style={styles.titleContainer}>
                <Text style={styles.header}>Community News</Text>
                <Text style={styles.subtitle}>What's happening in our area</Text>
              </View>
            </View>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.newsScroll}
            contentContainerStyle={styles.newsScrollContent}
          >
            {news.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.newsCard}
                onPress={() => onNewsPress?.(item.id)}
                activeOpacity={0.7}
              >
                {item.image && (
                  <Image 
                    source={{ uri: item.image }} 
                    style={styles.newsImage}
                  />
                )}
                <View style={styles.newsContent}>
                  <Text style={styles.newsTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {(item.story || item.callToAction) && (
                    <Text style={styles.newsStory} numberOfLines={2}>
                      {item.story || item.callToAction}
                    </Text>
                  )}
                  <View style={styles.newsFooter}>
                    <Feather name="calendar" size={12} color="#999" />
                    <Text style={styles.newsDate}>{formatDate(item.date)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  spotlightContainer: {
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
  spotlightTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    alignItems: 'center',
  },
  spotlightImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  spotlightImageFrame: {
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  spotlightContent: {
    padding: 16,
  },
  spotlightBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
  },
  badge: {
    fontSize: COMMUNITY_SPOTLIGHT_FONT_SIZE,
    fontWeight: '800',
    color: '#FF6B35',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotlightTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
    lineHeight: 28,
  },
  spotlightDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  spotlightStory: {
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
  spotlightCtaButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  spotlightCtaButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
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
  newsSection: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  container: {
    backgroundColor: '#f9f9f9',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    fontSize: 20,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  newsScroll: {
    paddingHorizontal: 16,
  },
  newsScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  newsCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  newsImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f0f0f0',
  },
  newsContent: {
    padding: 12,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
    lineHeight: 18,
  },
  newsStory: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    marginBottom: 8,
  },
  newsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newsDate: {
    fontSize: 10,
    color: '#999',
    fontWeight: '500',
  },
});
