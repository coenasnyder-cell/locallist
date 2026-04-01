import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  title: string;
  price: string;
  location?: string;
  imageSource?: ImageSourcePropType;
  onPress?: () => void;
};

export default function GridListingCard({ title, price, location, imageSource = require('../assets/images/icon.png'), onPress }: Props) {
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

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        {isValidSource(imageSource) ? (
          <Image source={normalizedSource(imageSource)} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Image source={require('../assets/images/icon.png')} style={styles.placeholderImage} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        {location && <Text style={styles.location}>{location}</Text>}
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
  content: {
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    marginTop: 6,
    color: '#444',
  },
  price: {
    fontSize: 17,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 4,
  },
  location: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});