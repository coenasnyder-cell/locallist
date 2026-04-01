import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../components/Header';

type PostType = 'lost' | 'found' | 'adoption';

export default function ListingPostedScreen() {
  const router = useRouter();
  const { petId, postType, listingId } = useLocalSearchParams<{ petId?: string; postType?: string; listingId?: string }>();
  const isMarketplaceListing = typeof listingId === 'string' && listingId.length > 0;

  const normalizedPostType: PostType =
    postType === 'found' || postType === 'adoption' ? postType : 'lost';

  const confirmationMessage =
    isMarketplaceListing
      ? 'Posting successful. To see your listing, tap below, or go to your profile to manage it later.'
      : normalizedPostType === 'found'
        ? 'Your found pet post is now live. Where would you like to go next?'
        : normalizedPostType === 'adoption'
          ? 'Your pet has been listed for adoption. Where would you like to go next?'
          : 'Your lost pet post is now live. Where would you like to go next?';

  const goToPetCorner = () => {
    if (isMarketplaceListing) {
      router.replace('/(tabs)/profilebutton' as any);
      return;
    }

    router.replace('/(tabs)/petbutton' as any);
  };

  const viewListing = () => {
    if (isMarketplaceListing) {
      router.replace({
        pathname: '/SingleListing' as any,
        params: { id: listingId },
      });
      return;
    }

    if (!petId) {
      goToPetCorner();
      return;
    }

    router.replace({
      pathname: '/pet-details' as any,
      params: {
        petId,
        postType: normalizedPostType,
      },
    });
  };

  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.title}>{isMarketplaceListing ? 'Posting Successful' : 'Listing Posted'}</Text>
          <Text style={styles.message}>{confirmationMessage}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={viewListing} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>{isMarketplaceListing ? 'View Listing' : 'View Listing'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={goToPetCorner} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>{isMarketplaceListing ? 'Go To Profile' : 'Back To The Pet Corner'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef3f8',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e4f2',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  checkmark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1f7a44',
    color: '#ffffff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 30,
    fontWeight: '800',
    overflow: 'hidden',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#16324a',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#4c6178',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#0c6ecf',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8e4f2',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '700',
  },
});
