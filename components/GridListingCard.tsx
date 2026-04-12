import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const viewLabel = viewCount != null ? `👀 ${viewCount.toLocaleString()} views` : null;
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
          <Image source={normalizedSource(imageSource)} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Image source={require('../assets/images/icon.png')} style={styles.placeholderImage} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <View style={styles.metaRow}>
          {!!category && <Text style={styles.metaText}>{category}</Text>}
          {!!category && !!timeLabel && <Text style={styles.metaDot}>·</Text>}
          {!!timeLabel && <Text style={styles.metaText}>{timeLabel}</Text>}
        </View>
        {viewLabel ? <Text style={styles.viewCount}>{viewLabel}</Text> : null}
        <View style={styles.footer}>
          {!!sellerName && <Text style={styles.footerText}>👤 {sellerName}</Text>}
          {!!locationLabel && <Text style={styles.footerText}>📍 {locationLabel}</Text>}
        </View>
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
    resizeMode: 'cover',
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
    resizeMode: 'contain',
    tintColor: '#ccc',
  },
  featuredBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 10,
    backgroundColor: '#f97316',
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
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    color: '#1a1a1a',
  },
  price: {
    fontSize: 18,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#555',
  },
  metaDot: {
    fontSize: 12,
    color: '#aaa',
  },
  viewCount: {
    fontSize: 12,
    color: '#555',
    marginTop: 4,
  },
  footer: {
    marginTop: 6,
    gap: 2,
  },
  footerText: {
    fontSize: 12,
    color: '#444',
  },
});