import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
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
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import UserReviewModal from '../components/UserReviewModal';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { submitUserReview } from '../utils/userReviews';

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
  const { id, businessId } = useLocalSearchParams();
  const { user } = useAccountStatus();
  const db = getFirestore(app);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const profileId = id || businessId;

  const isBusinessVerified = (business: BusinessProfile | null) => {
    const verifiedValue = business?.isVerified;
    const normalizedVerified = String(verifiedValue ?? '').trim().toLowerCase();
    return verifiedValue === true || verifiedValue === 1 || normalizedVerified === 'true' || normalizedVerified === '1';
  };

  const isOwnBusiness = !!user?.uid && !!profile && (
    profile.id === user.uid ||
    profile.userId === user.uid ||
    profile.ownerUserId === user.uid
  );
  const ratedBusinessUserId = String(profile?.ownerUserId || profile?.userId || profile?.id || '').trim();

  useEffect(() => {
    loadBusinessProfile();
  }, [profileId]);


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
    setReportModalVisible(true);
  };

  const handleReportBusinessReason = (reason: string) => {
    submitBusinessReport(reason);
    setReportModalVisible(false);
  };

  const handleSubmitBusinessReview = async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to review businesses.');
      return;
    }

    if (!ratedBusinessUserId) {
      Alert.alert('Error', 'Business owner account could not be identified for reviews.');
      return;
    }

    if (isOwnBusiness) {
      Alert.alert('Not allowed', 'You cannot review your own business.');
      return;
    }

    setSubmittingReview(true);
    try {
      await submitUserReview({
        currentUser,
        ratedUserId: ratedBusinessUserId,
        rating,
        reviewText,
        reviewTargetType: 'business',
        reviewTargetId: String(profile?.id || profileId || ''),
      });

      setReviewModalVisible(false);
      Alert.alert('Review submitted', 'Thanks. Your review is pending admin approval.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your review. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSubmittingReview(false);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

          {!!user && !isOwnBusiness && !!ratedBusinessUserId && (
            <TouchableOpacity style={styles.buttonReview} onPress={() => setReviewModalVisible(true)}>
              <Text style={styles.buttonReviewText}>⭐ Leave Business Review</Text>
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

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report Business Listing</Text>
              <TouchableOpacity
                style={styles.reportModalCloseButton}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.reportModalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reportModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.reportModalQuestion}>Why are you reporting this business listing?</Text>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportBusinessReason('spam')}>
                <Text style={styles.reportReasonText}>Spam</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportBusinessReason('scam')}>
                <Text style={styles.reportReasonText}>Scam/Fraud</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportBusinessReason('impersonation')}>
                <Text style={styles.reportReasonText}>Impersonation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportBusinessReason('misleading_content')}>
                <Text style={styles.reportReasonText}>Misleading Information</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.reportModalFooter}>
              <TouchableOpacity style={styles.reportCancelButton} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.reportCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <UserReviewModal
          visible={reviewModalVisible}
          title="Review Business"
          submitting={submittingReview}
          onClose={() => {
            if (!submittingReview) setReviewModalVisible(false);
          }}
          onSubmit={handleSubmitBusinessReview}
        />
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
  scrollContent: {
    paddingBottom: 48,
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
  buttonReview: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonReviewText: {
    color: '#3730a3',
    fontSize: 16,
    fontWeight: '700',
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
  spacer: {
    height: 24,
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
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reportModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxWidth: 500,
    width: '100%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  reportModalCloseButton: {
    padding: 4,
  },
  reportModalCloseButtonText: {
    fontSize: 24,
    color: '#666',
  },
  reportModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  reportModalQuestion: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
    fontWeight: '500',
  },
  reportReasonButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafbfc',
    marginBottom: 10,
  },
  reportReasonText: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  reportModalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  reportCancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  reportCancelButtonText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
});
