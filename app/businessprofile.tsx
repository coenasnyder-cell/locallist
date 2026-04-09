import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';

interface BusinessProfile {
  id: string;
  businessName?: string;
  businessDescription?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessWebsite?: string;
  businessAddress?: string;
  businessCategory?: string;
  businessHours?: string;
  businessTier?: string;
  businessImage?: string;
  businessLogo?: string;
  businessImages?: string[];
  businessCity?: string;
  businessState?: string;
  userId?: string;
  ownerUserId?: string;
  isClaimed?: boolean | number | string;
  isVerified?: boolean | number | string;
}

export default function BusinessProfileScreen() {
  const router = useRouter();
  const { id, businessId, claim } = useLocalSearchParams();
  const { user, profile: currentUserProfile, isBusinessAccount } = useAccountStatus();
  const db = getFirestore(app);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimImages, setClaimImages] = useState<string[]>([]);
  const [uploadingClaimImages, setUploadingClaimImages] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [existingClaimStatus, setExistingClaimStatus] = useState('');
  const [autoClaimHandled, setAutoClaimHandled] = useState(false);

  const profileId = id || businessId;
  const wantsClaimFlow = Array.isArray(claim) ? claim[0] === '1' : claim === '1';

  const isBusinessVerified = (business: BusinessProfile | null) => {
    const verifiedValue = business?.isVerified;
    const normalizedVerified = String(verifiedValue ?? '').trim().toLowerCase();
    return verifiedValue === true || verifiedValue === 1 || normalizedVerified === 'true' || normalizedVerified === '1';
  };

  const isBusinessClaimed = (business: BusinessProfile | null) => {
    const claimedValue = business?.isClaimed;
    const normalizedClaimed = String(claimedValue ?? '').trim().toLowerCase();
    const hasClaimedFlag = claimedValue === true || claimedValue === 1 || normalizedClaimed === 'true' || normalizedClaimed === '1';
    const hasOwner = !!(business?.ownerUserId && String(business.ownerUserId).trim() !== '');
    return hasClaimedFlag || hasOwner;
  };

  const isOwnBusiness = !!user?.uid && !!profile && (
    profile.id === user.uid ||
    profile.userId === user.uid ||
    profile.ownerUserId === user.uid
  );
  const canClaimBusiness = !!profile && !isBusinessVerified(profile) && !isBusinessClaimed(profile) && !isOwnBusiness;

  useEffect(() => {
    loadBusinessProfile();
  }, [profileId]);

  useEffect(() => {
    const loadExistingClaim = async () => {
      if (!user?.uid || !profile?.id) {
        setExistingClaimStatus('');
        return;
      }

      try {
        const claimDoc = await getDoc(doc(db, 'businessClaims', `${profile.id}_${user.uid}`));
        if (claimDoc.exists()) {
          const data = claimDoc.data() || {};
          setExistingClaimStatus(String(data.claimStatus || 'pending'));
        } else {
          setExistingClaimStatus('');
        }
      } catch (error) {
        console.error('Error loading claim status:', error);
        setExistingClaimStatus('');
      }
    };

    loadExistingClaim();
  }, [db, profile?.id, user?.uid]);

  useEffect(() => {
    if (!wantsClaimFlow || loading || !profile || autoClaimHandled) {
      return;
    }

    setAutoClaimHandled(true);
    handleOpenClaim();
  }, [autoClaimHandled, loading, profile, wantsClaimFlow]);

  const loadBusinessProfile = async () => {
    try {
      setLoading(true);

      if (!profileId) {
        Alert.alert('Error', 'No business ID provided');
        router.back();
        return;
      }

      let businessProfile = null;

      // Try businessLocal collection first
      try {
        const docRef = doc(db, 'businessLocal', profileId as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          businessProfile = { id: docSnap.id, ...docSnap.data() };
        }
      } catch (e) {
        console.log('Not in businessLocal collection');
      }

      // Fallback to legacy shopLocal collection
      if (!businessProfile) {
        try {
          const docRef = doc(db, 'shopLocal', profileId as string);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            businessProfile = { id: docSnap.id, ...docSnap.data() };
          }
        } catch (e) {
          console.log('Not in shopLocal collection');
        }
      }

      // Try users collection if not found
      if (!businessProfile) {
        try {
          const docRef = doc(db, 'users', profileId as string);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().accountType === 'business') {
            businessProfile = { id: docSnap.id, ...docSnap.data() };
          }
        } catch (e) {
          console.log('Not in users collection');
        }
      }

      if (businessProfile) {
        setProfile(businessProfile as any);
      } else {
        Alert.alert('Error', 'Business profile not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading business profile:', error);
      Alert.alert('Error', 'Failed to load business profile');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (profile?.businessPhone) {
      Linking.openURL(`tel:${profile.businessPhone}`);
    }
  };

  const handleEmail = () => {
    if (profile?.businessEmail) {
      Linking.openURL(`mailto:${profile.businessEmail}`);
    }
  };

  const handleWebsite = () => {
    if (profile?.businessWebsite) {
      Linking.openURL(profile.businessWebsite);
    }
  };

  const handleShare = () => {
    // This would use share API if available
    Alert.alert(
      'Share',
      `Check out ${profile?.businessName} on the Local List app!`,
      [{ text: 'OK' }]
    );
  };

  const submitBusinessReport = async (reason: string) => {
    if (!profile) return;

    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (isOwnBusiness) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      await addDoc(collection(db, 'reportedListings'), {
        listingId: profile.id,
        listingType: 'business',
        listingTitle: profile.businessName || 'Business listing',
        listingImage: profile.businessLogo || profile.businessImage || '',
        sellerId: profile.ownerUserId || profile.userId || '',
        sellerEmail: profile.businessEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from business profile screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch (error) {
      console.error('Error reporting business listing:', error);
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleReportBusiness = () => {
    Alert.alert('Report Listing', 'Why are you reporting this business listing?', [
      { text: 'Spam', onPress: () => submitBusinessReport('spam') },
      { text: 'Scam/Fraud', onPress: () => submitBusinessReport('scam') },
      { text: 'Impersonation', onPress: () => submitBusinessReport('impersonation') },
      { text: 'Misleading Information', onPress: () => submitBusinessReport('misleading_content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleOpenClaim = () => {
    if (!profile) {
      return;
    }

    if (!canClaimBusiness) {
      if (isBusinessVerified(profile)) {
        Alert.alert('Business verified', 'Verified local businesses cannot be claimed from the directory.');
        return;
      }

      if (isBusinessClaimed(profile)) {
        Alert.alert('Already claimed', 'This business has already been claimed.');
        return;
      }

      if (isOwnBusiness) {
        Alert.alert('Your business', 'You cannot submit a claim on your own business listing.');
      }
      return;
    }

    if (!user) {
      Alert.alert('Sign in required', 'Please sign in with your business account to submit a claim request.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign In',
          onPress: () =>
            router.push({
              pathname: '/signInOrSignUp' as any,
              params: {
                returnTo: `/businessprofile?id=${profile.id}&claim=1`,
              },
            }),
        },
      ]);
      return;
    }

    if (!isBusinessAccount) {
      Alert.alert('Business account required', 'Only business accounts can submit claim requests. Upgrade your account first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/upgrade-business' as any) },
      ]);
      return;
    }

    if (existingClaimStatus && existingClaimStatus !== 'denied') {
      Alert.alert('Claim already submitted', `Your claim is currently ${existingClaimStatus.replace(/_/g, ' ')}.`);
      return;
    }

    setClaimMessage('');
    setClaimImages([]);
    setClaimModalVisible(true);
  };

  const handlePickClaimImages = async () => {
    if (uploadingClaimImages || submittingClaim) {
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access to upload claim proof images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setClaimImages((prev) => {
        const next = [...prev];
        result.assets.forEach((asset) => {
          if (asset.uri && !next.includes(asset.uri) && next.length < 5) {
            next.push(asset.uri);
          }
        });
        return next;
      });
    } catch (error) {
      console.error('Error selecting claim images:', error);
      Alert.alert('Error', 'Could not select claim images right now.');
    }
  };

  const handleRemoveClaimImage = (uri: string) => {
    setClaimImages((prev) => prev.filter((item) => item !== uri));
  };

  const handleSubmitClaim = async () => {
    if (!user?.uid || !profile?.id) {
      Alert.alert('Error', 'Please sign in before submitting a claim request.');
      return;
    }

    if (!isBusinessAccount) {
      Alert.alert('Business account required', 'Only business accounts can submit claim requests.');
      return;
    }

    if (!canClaimBusiness) {
      Alert.alert('Unavailable', 'This business cannot be claimed.');
      return;
    }

    if (!claimMessage.trim()) {
      Alert.alert('Claim message required', 'Please include a short message explaining your claim.');
      return;
    }

    setSubmittingClaim(true);
    try {
      let proofUrls: string[] = [];

      if (claimImages.length > 0) {
        setUploadingClaimImages(true);
        const storage = getStorage(app);
        proofUrls = await Promise.all(
          claimImages.map(async (imageUri, index) => {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const imageRef = ref(storage, `businessClaimProofs/${user.uid}/${profile.id}_${Date.now()}_${index}.jpg`);
            await uploadBytes(imageRef, blob);
            return getDownloadURL(imageRef);
          })
        );
      }

      const claimDocId = `${profile.id}_${user.uid}`;
      await setDoc(
        doc(db, 'businessClaims', claimDocId),
        {
          businessId: profile.id,
          businessName: profile.businessName || '',
          claimImages: proofUrls,
          claimMessage: claimMessage.trim(),
          claimStatus: 'pending',
          createdAt: serverTimestamp(),
          userEmail: user.email || '',
          userId: user.uid,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', user.uid),
        {
          claimOwnershipRequest: true,
          claimStatus: 'pending',
          claimBusinessId: profile.id,
          claimBusinessName: profile.businessName || '',
          claimRequestedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setExistingClaimStatus('pending');
      setClaimModalVisible(false);
      setClaimMessage('');
      setClaimImages([]);
      Alert.alert('Claim submitted', 'Your claim request was submitted and is now pending admin review.');
    } catch (error) {
      console.error('Error submitting claim request:', error);
      Alert.alert('Error', 'Could not submit your claim request right now.');
    } finally {
      setUploadingClaimImages(false);
      setSubmittingClaim(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#475569" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Profile Not Found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Business Header */}
        <View style={styles.headerSection}>
          {profile.businessLogo && (
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: profile.businessLogo }}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
          )}
          <Text style={styles.businessName}>{profile.businessName || 'Business'}</Text>
          {isBusinessVerified(profile) ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>Local Business Verified</Text>
            </View>
          ) : null}
          {profile.businessDescription ? (
            <Text style={styles.businessDescription}>{profile.businessDescription}</Text>
          ) : null}
        </View>

        {!isBusinessVerified(profile) && !isBusinessClaimed(profile) ? (
          <View style={styles.claimSection}>
            <Text style={styles.claimSectionTitle}>Claim This Business</Text>
            <Text style={styles.claimSectionText}>
              If you own this business, submit a claim request for admin review.
            </Text>
            {existingClaimStatus ? (
              <View style={styles.claimStatusBox}>
                <Text style={styles.claimStatusText}>
                  Claim status: {existingClaimStatus.replace(/_/g, ' ')}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.claimButton} onPress={handleOpenClaim}>
                <Text style={styles.claimButtonText}>Claim This Business</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Contact Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>🔗 Contact Information</Text>

          {profile.businessPhone && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{profile.businessPhone}</Text>
            </View>
          )}

          {profile.businessEmail && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile.businessEmail}</Text>
            </View>
          )}

          {profile.businessWebsite && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Website</Text>
              <Text style={styles.infoValue}>{profile.businessWebsite}</Text>
            </View>
          )}

          {profile.businessAddress && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{profile.businessAddress}</Text>
            </View>
          )}
        </View>

        {/* Business Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>ℹ️ Business Information</Text>

          {profile.businessCategory && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{profile.businessCategory}</Text>
            </View>
          )}

          {profile.businessHours && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Hours</Text>
              <Text style={styles.infoValue}>{profile.businessHours}</Text>
            </View>
          )}

          {profile.businessTier && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Account Tier</Text>
              <Text style={styles.infoValue}>
                {profile.businessTier === 'premium' ? '⭐ Premium' : 'Free'}
              </Text>
            </View>
          )}
        </View>

        {/* Gallery */}
        {profile.businessImages && profile.businessImages.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={styles.sectionTitle}>📸 Gallery</Text>
            <FlatList
              data={profile.businessImages}
              keyExtractor={(item, index) => `image-${index}`}
              numColumns={2}
              columnWrapperStyle={styles.galleryRow}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={styles.galleryImage}
                  onPress={() => {
                    setSelectedImage(item);
                    setModalVisible(true);
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    style={styles.galleryImageItem}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {profile.businessWebsite && (
            <TouchableOpacity style={styles.buttonPrimary} onPress={handleWebsite}>
              <Text style={styles.buttonPrimaryText}>🌐 Visit Website</Text>
            </TouchableOpacity>
          )}

          {profile.businessEmail && (
            <TouchableOpacity style={styles.buttonSecondary} onPress={handleEmail}>
              <Text style={styles.buttonSecondaryText}>✉️ Send Email</Text>
            </TouchableOpacity>
          )}

          {!isOwnBusiness && (
            <TouchableOpacity style={styles.buttonDanger} onPress={handleReportBusiness}>
              <Text style={styles.buttonDangerText}>🚩 Report Listing</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={claimModalVisible}
        transparent
        onRequestClose={() => setClaimModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.claimModalBackdrop}>
          <View style={styles.claimModalCard}>
            <Text style={styles.claimModalTitle}>Claim This Business</Text>
            <Text style={styles.claimModalText}>
              Tell the admin team why this listing belongs to you. Your claim will be reviewed before any ownership change is made.
            </Text>
            <TextInput
              style={styles.claimInput}
              value={claimMessage}
              onChangeText={setClaimMessage}
              placeholder="Add a short explanation for your claim"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.proofPickerButton, (submittingClaim || uploadingClaimImages) && styles.claimSubmitButtonDisabled]}
              onPress={handlePickClaimImages}
              disabled={submittingClaim || uploadingClaimImages}
            >
              <Text style={styles.proofPickerButtonText}>
                {claimImages.length > 0 ? 'Add More Proof Images' : 'Add Proof Images'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.claimHelperText}>
              Accepted examples: storefront signage, website admin access, or social profile management screenshots. Do not upload tax documents.
            </Text>
            {claimImages.length > 0 ? (
              <View style={styles.claimPreviewWrap}>
                {claimImages.map((uri) => (
                  <View key={uri} style={styles.claimPreviewItem}>
                    <Image source={{ uri }} style={styles.claimPreviewImage} />
                    <TouchableOpacity
                      style={styles.claimPreviewRemove}
                      onPress={() => handleRemoveClaimImage(uri)}
                      disabled={submittingClaim || uploadingClaimImages}
                    >
                      <Text style={styles.claimPreviewRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.claimModalActions}>
              <TouchableOpacity
                style={styles.claimCancelButton}
                onPress={() => setClaimModalVisible(false)}
                disabled={submittingClaim}
              >
                <Text style={styles.claimCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.claimSubmitButton, submittingClaim && styles.claimSubmitButtonDisabled]}
                onPress={handleSubmitClaim}
                disabled={submittingClaim}
              >
                <Text style={styles.claimSubmitButtonText}>
                  {submittingClaim || uploadingClaimImages ? 'Submitting...' : 'Submit Claim'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalVisible}
        transparent
        onRequestClose={() => setModalVisible(false)}
        animationType="fade"
      >
        <View style={styles.imageModal}>
          <TouchableOpacity
            style={styles.imageModalOverlay}
            onPress={() => setModalVisible(false)}
          >
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 40,
    backgroundColor: 'white',
    marginBottom: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  businessDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  verifiedBadge: {
    marginBottom: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verifiedBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  claimSection: {
    backgroundColor: '#fff7ed',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  claimSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9a3412',
    marginBottom: 6,
  },
  claimSectionText: {
    fontSize: 14,
    color: '#7c2d12',
    lineHeight: 20,
    marginBottom: 12,
  },
  claimStatusBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  claimStatusText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
  },
  gallerySection: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  galleryRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  galleryImage: {
    width: '48%',
  },
  galleryImageItem: {
    width: '100%',
    height: 150,
    borderRadius: 8,
  },
  actionButtons: {
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: '#475569',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#e8f4f8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonSecondaryText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDanger: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDangerText: {
    color: '#b91c1c',
    fontSize: 16,
    fontWeight: '700',
  },
  claimButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    height: 24,
  },
  claimModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  claimModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  claimModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  claimModalText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  claimInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  proofPickerButton: {
    marginTop: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  proofPickerButtonText: {
    color: '#9a3412',
    fontSize: 14,
    fontWeight: '700',
  },
  claimHelperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
  },
  claimPreviewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  claimPreviewItem: {
    width: '30%',
    minWidth: 88,
  },
  claimPreviewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  claimPreviewRemove: {
    marginTop: 6,
    alignItems: 'center',
  },
  claimPreviewRemoveText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  claimModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  claimCancelButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  claimCancelButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  claimSubmitButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  claimSubmitButtonDisabled: {
    opacity: 0.6,
  },
  claimSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  imageModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '90%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});
