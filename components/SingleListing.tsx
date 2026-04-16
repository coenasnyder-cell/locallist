import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { getAuth } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { app } from "../firebase";
import { submitUserReview } from '../utils/userReviews';
import UserReviewModal from './UserReviewModal';

export type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  sellerName: string;
  sellerEmail: string;
  userId?: string;
  zipCode: string;
  city?: string;
  eventDate?: string;
  status: string;
  isFeatured: boolean;
  isSample: boolean;
  viewCount: number;
  favoritesCount: number;
  allowMessages: boolean;
  createdAt: any;
  expiresAt: any;
};

function getTimestampMs(value: any): number | null {
  if (!value) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatRelativeTime(ms: number | null): string {
  if (!ms) return '';
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
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

export default function SingleListing({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 920;
  const [isSaved, setIsSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportDetails, setReportDetails] = useState('');
  const [selectedReportReason, setSelectedReportReason] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [sellerPhotoUrl, setSellerPhotoUrl] = useState<string>('');
  const currentUser = getAuth().currentUser;
  const isOwnListing = !!currentUser && currentUser.uid === listing.userId;
  const postedTimeLabel = formatRelativeTime(getTimestampMs(listing.createdAt));

  useEffect(() => {
    const db = getFirestore(app);
    // Increment view count once per mount (owner views don't count)
    if (!isOwnListing) {
      updateDoc(doc(db, 'listings', listing.id), { viewCount: increment(1) }).catch(() => {});
    }
  }, [listing.id]);

  useEffect(() => {
    if (!currentUser || isOwnListing) return;
    const db = getFirestore(app);
    getDoc(doc(db, 'saveListings', `${currentUser.uid}_${listing.id}`))
      .then(snap => { setIsSaved(snap.exists()); })
      .catch(() => {});
  }, [listing.id]);

  useEffect(() => {
    const loadSellerPhoto = async () => {
      if (!listing.userId) {
        setSellerPhotoUrl('');
        return;
      }

      try {
        const db = getFirestore(app);
        const sellerSnap = await getDoc(doc(db, 'users', listing.userId));
        if (!sellerSnap.exists()) {
          setSellerPhotoUrl('');
          return;
        }

        const data = sellerSnap.data() as {
          profileImage?: string;
          profileimage?: string;
          photoURL?: string;
        };
        const photo = String(data.profileImage || data.profileimage || data.photoURL || '').trim();
        setSellerPhotoUrl(photo);
      } catch {
        setSellerPhotoUrl('');
      }
    };

    loadSellerPhoto();
  }, [listing.userId]);

  const toggleSave = async () => {
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to save listings.');
      return;
    }
    if (savingInProgress) return;
    setSavingInProgress(true);
    try {
      const db = getFirestore(app);
      const saveDocRef = doc(db, 'saveListings', `${currentUser.uid}_${listing.id}`);
      if (isSaved) {
        await deleteDoc(saveDocRef);
        setIsSaved(false);
      } else {
        await setDoc(saveDocRef, {
          listingId: listing.id,
          userId: currentUser.uid,
          title: listing.title || 'Untitled',
          description: listing.description || '',
          image: listing.images?.[0] || null,
          sellerName: listing.sellerName || '',
          price: listing.price || 0,
          city: listing.city || 'TBD',
          category: listing.category || '',
          savedAt: serverTimestamp(),
        });
        setIsSaved(true);
        Alert.alert('Listing Saved', 'You can view your saved listings under the Saved tab on your profile.', [{ text: 'OK' }]);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save listing. Please try again.');
    } finally {
      setSavingInProgress(false);
    }
  };

  const startThread = async () => {
  try {
    const db = getFirestore(app);
    const user = getAuth().currentUser;

    if (!user) {
      alert("Please log in to message sellers.");
      return;
    }

    if (!listing.userId) {
      alert("Seller ID missing on listing");
      return;
    }

    const threadsRef = collection(db, "threads");

    // Check if a thread already exists for this buyer and listing owner.
    const existingThreadQuery = query(
      threadsRef,
      where("listingId", "==", listing.id),
      where("participantIds", "array-contains", user.uid)
    );

    const existingThreadSnapshot = await getDocs(existingThreadQuery);

    if (!existingThreadSnapshot.empty) {
      const existingMatch = existingThreadSnapshot.docs.find((d) => {
        const ids: string[] = d.data().participantIds || [];
        return ids.includes(listing.userId || '');
      });

      if (existingMatch) {
        router.push({
          pathname: "/threadchat",
          params: { threadId: existingMatch.id }
        });
        return;
      }
    }

    const threadData = {
      listingId: listing.id,
      buyerId: user.uid,
      sellerId: listing.userId,
      participantIds: [user.uid, listing.userId],

      listingTitle: listing.title,
      listingImage: listing.images?.[0] || null,
      listingType: 'marketplace',
      leadType: 'marketplace',

      createdAt: serverTimestamp(),
      lastMessage: "",
      lastTimestamp: serverTimestamp(),
      unreadBy: [listing.userId],
    };

    const docRef = await addDoc(threadsRef, threadData);

    router.push({
      pathname: "/threadchat",
      params: { threadId: docRef.id }
    });

  } catch (error) {
    console.error(error);
    alert("Unable to start conversation.");
  }
};

  const submitListingReport = async (reason: string) => {
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return false;
    }

    if (isOwnListing) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return false;
    }

    setSubmittingReport(true);
    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'reportedListings'), {
        listingId: listing.id,
        listingTitle: listing.title || 'Untitled listing',
        listingImage: listing.images?.[0] || '',
        sellerId: listing.userId || '',
        sellerEmail: listing.sellerEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: reportDetails.trim() || 'Reported from listing details screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
      return true;
    } catch (error) {
      console.error('Error reporting listing:', error);
      Alert.alert('Error', 'Could not submit report. Please try again.');
      return false;
    } finally {
      setSubmittingReport(false);
    }
  };

  const reportListing = () => {
    setReportDetails('');
    setSelectedReportReason('');
    setReportModalVisible(true);
  };

  const handleReportReason = (reason: string) => {
    setSelectedReportReason(reason);
  };

  const handleSubmitReport = async () => {
    if (!selectedReportReason) {
      Alert.alert('Reason required', 'Please select a reason before submitting.');
      return;
    }

    const submitted = await submitListingReport(selectedReportReason);
    if (!submitted) {
      return;
    }

    setReportDetails('');
    setSelectedReportReason('');
    setReportModalVisible(false);
  };

  const handleSubmitSellerReview = async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to review sellers.');
      return;
    }

    if (!listing.userId) {
      Alert.alert('Error', 'Seller account could not be identified for this listing.');
      return;
    }

    setSubmittingReview(true);
    try {
      await submitUserReview({
        currentUser,
        ratedUserId: listing.userId,
        rating,
        reviewText,
        reviewTargetType: 'seller',
        reviewTargetId: listing.id,
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

  const isExpired = () => {
    if (!listing.expiresAt) return false;
    const expiresAt = listing.expiresAt.toDate
      ? listing.expiresAt.toDate()
      : new Date(listing.expiresAt);
    return expiresAt < new Date();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView>
        <View style={styles.headerSpacer} />
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.arrowButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.titleCenterWrapper}>
            <Text style={styles.listingDetailsTitle}>Listing Details</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <View style={[styles.detailsLayout, isWideLayout ? styles.detailsLayoutWide : null]}>
            {/* Images */}
            <View style={[styles.gallery, isWideLayout ? styles.galleryWide : null]}>
              {listing.images && listing.images.length > 0 ? (
                <View style={styles.galleryInner}>
                  <Image source={{ uri: listing.images[0] }} style={[styles.image, isWideLayout ? styles.imageWide : null]} />
                  {listing.images.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll} contentContainerStyle={styles.galleryRow}>
                      {listing.images.slice(1).map((img, idx) => (
                        <Image key={idx} source={{ uri: img }} style={styles.imageSmall} />
                      ))}
                    </ScrollView>
                  )}
                </View>
              ) : (
                <View style={[styles.imagePlaceholder, isWideLayout ? styles.imageWide : null]}>
                  <Text>No Images</Text>
                </View>
              )}
            </View>

            <View style={[styles.detailsColumn, isWideLayout ? styles.detailsColumnWide : null]}>
              {/* Details */}
              <View style={styles.titlePriceRow}>
                <Text style={styles.title}>{listing.title}</Text>
                <Text style={styles.price}>${listing.price}</Text>
              </View>
              <View style={styles.metaPillRow}>
                {!!listing.category && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{listing.category}</Text>
                  </View>
                )}
                {!!listing.condition && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{listing.condition}</Text>
                  </View>
                )}
                {!!postedTimeLabel && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{postedTimeLabel}</Text>
                  </View>
                )}
              </View>
              <View style={styles.viewCountRow}>
                <Feather name="eye" size={13} color="#999" />
                <Text style={styles.viewCountText}>{(listing.viewCount || 0) + (isOwnListing ? 0 : 1)} views</Text>
              </View>

              {listing.eventDate && (
                <Text style={styles.meta}>Event Date: {listing.eventDate}</Text>
              )}

              {isExpired() && (
                <Text style={styles.expiredText}>This listing has expired</Text>
              )}

              <Text style={styles.description}>{listing.description}</Text>

              {/* Seller Info */}
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerLabel}>Seller Information:</Text>
                <View style={styles.sellerRow}>
                  {sellerPhotoUrl ? (
                    <Image source={{ uri: sellerPhotoUrl }} style={styles.sellerAvatar} contentFit="cover" />
                  ) : (
                    <View style={styles.sellerAvatarFallback}>
                      <Text style={styles.sellerAvatarFallbackText}>{String(listing.sellerName || 'U').trim().charAt(0).toUpperCase() || 'U'}</Text>
                    </View>
                  )}
                  {listing.userId ? (
                    <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/public-profile', params: { userId: listing.userId } })}>
                      <Text style={[styles.sellerName, styles.profileLink]}>{listing.sellerName}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.sellerName}>{listing.sellerName}</Text>
                  )}
                </View>
                <View style={styles.sellerLocationRow}>
                  <Feather name="map-pin" size={13} color="#ec4899" />
                  <Text style={styles.sellerLocation}>{listing.city || 'TBD'}</Text>
                </View>
              </View>
              {!!currentUser && !isOwnListing && !!listing.userId && (
                <TouchableOpacity style={styles.reviewButton} onPress={() => setReviewModalVisible(true)}>
                  <Text style={styles.reviewButtonText}>Leave Seller Review</Text>
                </TouchableOpacity>
              )}
              <View style={styles.primaryActionsRow}>
                <TouchableOpacity
                  style={[styles.messageButton, !isOwnListing && styles.rowActionButton]}
                  onPress={startThread}
                >
                  <Text style={styles.messageButtonText}>Message Seller</Text>
                </TouchableOpacity>
                {!isOwnListing && (
                  <TouchableOpacity
                    style={[styles.saveButton, styles.rowActionButton, isSaved && styles.saveButtonSaved]}
                    onPress={toggleSave}
                    disabled={savingInProgress}
                  >
                    <Feather name="bookmark" size={16} color={isSaved ? '#fff' : '#475569'} />
                    <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextSaved]}>
                      {isSaved ? 'Saved' : 'Save Listing'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {!isOwnListing && (
                <TouchableOpacity style={styles.reportLinkWrap} onPress={reportListing}>
                  <Text style={styles.reportLinkText}>Report Listing</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <UserReviewModal
        visible={reviewModalVisible}
        title="Review Seller"
        submitting={submittingReview}
        onClose={() => {
          if (!submittingReview) setReviewModalVisible(false);
        }}
        onSubmit={handleSubmitSellerReview}
      />

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report Listing</Text>
              <TouchableOpacity
                style={styles.reportModalCloseButton}
                onPress={() => setReportModalVisible(false)}
              >
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reportModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.reportModalQuestion}>Why are you reporting this listing?</Text>

              <TouchableOpacity
                style={[styles.reportReasonButton, selectedReportReason === 'spam' && styles.reportReasonButtonSelected]}
                onPress={() => handleReportReason('spam')}
              >
                <Text style={[styles.reportReasonText, selectedReportReason === 'spam' && styles.reportReasonTextSelected]}>Spam</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportReasonButton, selectedReportReason === 'scam' && styles.reportReasonButtonSelected]}
                onPress={() => handleReportReason('scam')}
              >
                <Text style={[styles.reportReasonText, selectedReportReason === 'scam' && styles.reportReasonTextSelected]}>Scam/Fraud</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportReasonButton, selectedReportReason === 'prohibited_item' && styles.reportReasonButtonSelected]}
                onPress={() => handleReportReason('prohibited_item')}
              >
                <Text style={[styles.reportReasonText, selectedReportReason === 'prohibited_item' && styles.reportReasonTextSelected]}>Prohibited Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportReasonButton, selectedReportReason === 'misleading_content' && styles.reportReasonButtonSelected]}
                onPress={() => handleReportReason('misleading_content')}
              >
                <Text style={[styles.reportReasonText, selectedReportReason === 'misleading_content' && styles.reportReasonTextSelected]}>Misleading Content</Text>
              </TouchableOpacity>

              <Text style={styles.reportDetailsLabel}>Additional details (optional)</Text>
              <TextInput
                style={styles.reportDetailsInput}
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="Add any context that would help moderators review this listing"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={styles.reportModalFooter}>
              <TouchableOpacity
                style={styles.reportCancelButton}
                onPress={() => {
                  setReportModalVisible(false);
                  setSelectedReportReason('');
                  setReportDetails('');
                }}
              >
                <Text style={styles.reportCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportSubmitButton, (!selectedReportReason || submittingReport) && styles.reportSubmitButtonDisabled]}
                onPress={handleSubmitReport}
                disabled={!selectedReportReason || submittingReport}
              >
                <Text style={styles.reportSubmitButtonText}>{submittingReport ? 'Submitting...' : 'Submit Report'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  detailsContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 24,
    // You can adjust/add more styling as needed
  },
  detailsLayout: {
    width: '100%',
  },
  detailsLayoutWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  headerSpacer: {
    height: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
    height: 32,
  },
  arrowButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
    zIndex: 2,
  },
  titleCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  gallery: {
    marginBottom: 16,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',

  },
  galleryWide: {
    width: '42%',
    marginBottom: 0,
    marginRight: 14,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    paddingRight: 12,
  },
  galleryInner: {
    width: '100%',
  },
  galleryScroll: {
    marginTop: 8,
  },
  galleryRow: {
    gap: 8,
    paddingRight: 8,
  },
  imageSmall: {
    width: 84,
    height: 84,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',

  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: '#eee',
     alignItems: 'center',
    justifyContent: 'center',
  },
  imageWide: {
    height: 320,
  },
  imagePlaceholder: {
    width: '100%',
    height: 240,
    borderRadius: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsColumn: {
    width: '100%',
  },
  detailsColumnWide: {
    width: '58%',
  },
  titlePriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 8,
    flex: 1,
  },
  price: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '500',
  },
  metaPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  meta: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
    fontWeight: '500',
  },
  viewCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  viewCountText: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    marginVertical: 12,
    color: '#333',
  },
  sellerInfo: {
    marginTop: 12,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  sellerLabel: {
    fontWeight: '500',
    fontSize: 15,
  },
  sellerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
  },
  sellerAvatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarFallbackText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#115e59',
  },
  sellerName: {
    fontSize: 15,
    color: '#222',
  },
  profileLink: {
    color: '#0f766e',
    textDecorationLine: 'underline',
  },
  sellerLocation: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  sellerLocationRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewButton: {
    marginTop: 8,
    marginBottom: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3730a3',
  },
  expiredText: {
    color: '#999',
    fontWeight: '500',
    fontSize: 15,
    marginTop: 8,
  },
  messageButton: {
    backgroundColor: '#475569',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  rowActionButton: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 10,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#475569',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  saveButtonSaved: {
    backgroundColor: '#475569',
    borderColor: '#475569',
  },
  saveButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 15,
  },
  saveButtonTextSaved: {
    color: '#fff',
  },
  reportLinkWrap: {
    alignSelf: 'center',
    marginTop: 2,
    marginBottom: 24,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  reportLinkText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listingDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 0.5,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
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
  reportDetailsLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    marginBottom: 6,
  },
  reportDetailsInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 90,
    fontSize: 13,
    color: '#111827',
    marginBottom: 14,
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
  reportReasonButtonSelected: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  reportReasonText: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  reportReasonTextSelected: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  reportModalFooter: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reportCancelButton: {
    flex: 1,
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
  reportSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});
