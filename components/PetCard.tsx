import { Image } from 'expo-image';
import React from 'react';
import { ImageSourcePropType, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Pet } from '../types/Pet';

type Props = {
  pet: Pet;
  onPress?: () => void;
  compact?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PetCard({ pet, onPress, compact = false, containerStyle }: Props) {
  const isValidSource = (src?: string) => {
    if (!src) return false;
    if (typeof src === 'string') return true;
    return false;
  };

  const displayLocation = (() => {
    const rawLocation = typeof pet.petSeenLocation === 'string' ? pet.petSeenLocation.trim() : '';

    if (!rawLocation) {
      return '';
    }

    const cleanedLocation = rawLocation.replace(/\s+/g, ' ').split(/\r?\n/)[0].trim();
    const descriptionLikePattern = /\b(friendly|timid|shy|wearing|collar|microchipp|reward|answers to|please call|contact me|description)\b/i;

    if (cleanedLocation.length > 80 || descriptionLikePattern.test(cleanedLocation)) {
      return '';
    }

    return cleanedLocation;
  })();

  const normalizedSource = (src?: string): ImageSourcePropType | undefined => {
    if (!src) return undefined;
    if (typeof src === 'string') return { uri: src };
    return undefined;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reunited':
        return '#4CAF50'; // Green
      case 'adopted':
        return '#2196F3'; // Blue
      case 'lost':
        return '#FF9800'; // Orange
      default:
        return '#9C27B0'; // Purple
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'reunited':
        return 'Reunited';
      case 'adopted':
        return 'Adopted';
      case 'lost':
        return 'Still Lost';
      case 'found':
        return 'Found';
      default:
        return status;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, compact && styles.containerCompact, containerStyle]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {isValidSource(pet.petImages?.[0] || pet.petPhoto) ? (
          <Image source={normalizedSource(pet.petImages?.[0] || pet.petPhoto)} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderEmoji}>🐾</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.statusBadge,
            compact && styles.statusBadgeCompact,
            { backgroundColor: getStatusColor(pet.petStatus) },
          ]}
        >
          <Text style={[styles.statusText, compact && styles.statusTextCompact]}>{getStatusLabel(pet.petStatus)}</Text>
        </View>

        <Text style={[styles.petName, compact && styles.petNameCompact]} numberOfLines={1}>
          {pet.petName}
        </Text>

        <View style={styles.detailsRow}>
          <Text style={[styles.petType, compact && styles.petTypeCompact]} numberOfLines={1}>
            {pet.petType} • {pet.petBreed}
          </Text>
        </View>

        {!compact && (
          <View style={styles.detailsRow}>
            <Text style={styles.petDetails}>
              Age: {pet.petAge} | {pet.petGender}
            </Text>
          </View>
        )}

        {displayLocation ? (
          <Text style={[styles.location, compact && styles.locationCompact]} numberOfLines={1}>
            📍 {displayLocation}
          </Text>
        ) : null}

        {!compact && pet.petAdoptionFee && pet.postType === 'adoption' ? (
          <Text style={styles.adoptionFee}>
            Fee: ${pet.petAdoptionFee}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  containerCompact: {
    marginBottom: 0,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    aspectRatio: 16 / 9,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#eee',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusTextCompact: {
    fontSize: 11,
  },
  content: {
    padding: 12,
  },
  petName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: '#333',
  },
  petNameCompact: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailsRow: {
    marginBottom: 4,
  },
  petType: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  petTypeCompact: {
    fontSize: 12,
  },
  petDetails: {
    fontSize: 12,
    color: '#888',
  },
  location: {
    fontSize: 12,
    color: '#555',
    marginTop: 6,
  },
  locationCompact: {
    marginTop: 4,
    fontSize: 11,
  },
  adoptionFee: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 6,
  },
});
