import { Image } from 'expo-image';
import React from 'react';
import { ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
  imageSource?: ImageSourcePropType;
  onPress?: () => void;
  isBusinessUser?: boolean;
};

export default function ListingCard({ title, subtitle, imageSource = require('../assets/images/icon.png'), onPress, isBusinessUser }: Props) {
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

  const formatSubtitle = (value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('$')) return trimmed;
    if (/^\d+(\.\d+)?$/.test(trimmed)) return `$${trimmed}`;
    return trimmed;
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        {isValidSource(imageSource) ? (
          <Image source={normalizedSource(imageSource)} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Image source={require('../assets/images/icon.png')} style={styles.placeholderImage} contentFit="contain" tintColor="#ccc" />
          </View>
        )}
        {isBusinessUser && (
          <View style={styles.businessBadge}>
            <Text style={styles.businessBadgeText}>💼</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{formatSubtitle(subtitle)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
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
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  businessBadge: {
    position: 'absolute',
    top: -8,
    right: 4,
    backgroundColor: '#1565C0',
    borderRadius: 20,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  businessBadgeText: {
    fontSize: 14,
  },
});