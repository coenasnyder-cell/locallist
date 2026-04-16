import { Image } from 'expo-image';
import React from 'react';
import { ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  price: string;
  location?: string;
  category?: string;
  viewCount?: number;
  sellerName?: string;
  createdAt?: number;
  city?: string;
  imageSource?: ImageSourcePropType;
  isFeatured?: boolean;
  onPress?: () => void;
};

function formatRelativeTime(ms?: number): string {
  if (!ms) return '';
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just posted';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function GridListingCard({
  title,
  price,
  location,
  category,
  viewCount,
  sellerName,
  createdAt,
  city,
  imageSource = require('../assets/images/icon.png'),
  isFeatured,
  onPress,
}: Props) {
  const isValidSource = (src?: ImageSourcePropType) => {
    if (!src) return false;
    if (typeof src === 'number') return true;
    if (typeof src === 'string') return true;
    if (typeof src === 'object' && 'uri' in (src as any) && typeof (src as any).uri === 'string') return true;
    return false;
  };

  const normalizedSource = (src?: ImageSourcePropType) => {
    if (!src) return undefined;
    if (typeof src === 'string') return { uri: src };
    return src;
  };

  const formatPrice = (value: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('$')) return trimmed;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return `$${trimmed}`;
    return trimmed;
  };

  const timeLabel = formatRelativeTime(createdAt);
  const locationLabel = city || location;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {isFeatured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredBadgeText}>⭐ Featured</Text>
          </View>
        )}
        {isValidSource(imageSource) ? (
          <Image source={normalizedSource(imageSource)} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Image source={require('../assets/images/icon.png')} style={styles.placeholderImage} contentFit="contain" tintColor="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.titleRow} numberOfLines={1}>
          {title} <Text style={styles.priceInline}>{formatPrice(price)}</Text>
        </Text>
        <View style={styles.metaRow}>
          {!!category && <View style={styles.pill}><Text style={styles.pillText}>{category}</Text></View>}
          {!!timeLabel && <Text style={styles.metaText}>{timeLabel}</Text>}
          {viewCount != null && <Text style={styles.metaText}>{viewCount.toLocaleString()} views</Text>}
        </View>
        {!!locationLabel && <Text style={styles.locationText}>{locationLabel}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 10,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#eee',
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
  },
  placeholderImage: {
    width: '60%',
    height: '60%',
  },
  featuredBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: '#475569',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    opacity: 0.95,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  content: {
    width: '100%',
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  titleRow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    numberOfLines: 1,
  },
  priceInline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 6,
  },
  pill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
  },
  locationText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
});