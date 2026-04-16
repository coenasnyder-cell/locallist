import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import UserReviewModal from '../../components/UserReviewModal';
import { app } from '../../firebase';
import { submitUserReview } from '../../utils/userReviews';

type ServiceDetails = {
  id: string;
  userId?: string;
  serviceName?: string;
  providerName?: string;
  category?: string;
  serviceDescription?: string;
  serviceImage?: string;
  images?: string[];
  serviceImages?: string[];
  galleryImages?: string[];
  priceType?: string;
  priceAmount?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
  serviceArea?: string | null;
  address?: string | null;
  locationAddress?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationZip?: string | null;
  state?: string | null;
  zipCode?: string | null;
  city?: string | null;
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
  businessHours?: string;
  contactMethod?: string;
  motto?: string;
  businessMotto?: string;
  logoImage?: string;
  isFeatured?: boolean;
};

function isApprovedService(data: any): boolean {
  const status = String(data?.status || '').toLowerCase();
  const approvalStatus = String(data?.approvalStatus || '').toLowerCase();
  if (data?.isApproved === true) return true;
  if (approvalStatus === 'approved') return true;
  return status === 'approved';
}

function getPriceLabel(service: ServiceDetails): string | null {
  const priceType = String(service.priceType || '').toLowerCase();
  const amount = service.priceAmount;
  if (priceType === 'quote') return 'Free Quote';
  if (priceType === 'negotiable') return 'Negotiable';
  if (!amount) return null;
  if (priceType === 'hourly') return `$${amount}/hr`;
  if (priceType === 'fixed') return `$${amount} flat`;
  return `$${amount}`;
}

function getServiceLocationLabel(service: ServiceDetails): string {
  const address = String(service.address || service.locationAddress || '').trim();
  const city = String(service.locationCity || service.city || '').trim();
  const state = String(service.locationState || service.state || '').trim();
  const zip = String(service.locationZip || service.zipCode || '').trim();
  if (address && city && state && zip) return `${address}, ${city}, ${state} ${zip}`;

  const serviceArea = String(service.serviceArea || '').trim();
  if (serviceArea) return serviceArea;
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return 'Location not provided';
}

function buildGalleryImages(service: ServiceDetails | null): string[] {
  if (!service) return [];
  const candidates: string[] = [
    ...(Array.isArray(service.serviceImages) ? service.serviceImages : []),
    ...(Array.isArray(service.images) ? service.images : []),
    ...(Array.isArray(service.galleryImages) ? service.galleryImages : []),
    String(service.serviceImage || '').trim(),
  ];

  return Array.from(new Set(candidates.filter((value) => /^https?:\/\//i.test(String(value || '').trim()))));
}

export default function ServiceDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const currentUser = getAuth().currentUser;
  const galleryImages = useMemo(() => buildGalleryImages(service), [service]);
  const isOwnService = !!currentUser && !!service?.userId && service.userId === currentUser.uid;

  useEffect(() => {
    const loadService = async () => {
      if (!idParam) {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'services', idParam));
        if (!snap.exists()) {
          setService(null);
          return;
        }

        const data = snap.data() as ServiceDetails;
        if (!isApprovedService(data)) {
          setService(null);
          return;
        }

        setService({ ...data, id: snap.id });
      } catch {
        setService(null);
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [idParam]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/serviceslist' as any);
  };

  const openPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openWebsite = (website: string) => {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    Linking.openURL(url);
  };

  const submitServiceReport = async (reason: string) => {
    if (!service) return;

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (service.userId && service.userId === currentUser.uid) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'reportedListings'), {
        listingId: service.id,
        listingType: 'service',
        listingTitle: service.serviceName || 'Service listing',
        listingImage: service.serviceImage || '',
        sellerId: service.userId || '',
        sellerEmail: service.contactEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from service details screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleReportService = () => {
    setReportModalVisible(true);
  };

  const handleReportServiceReason = (reason: string) => {
    submitServiceReport(reason);
    setReportModalVisible(false);
  };

  const handleSubmitServiceReview = async ({ rating, reviewText }: { rating: number; reviewText: string }) => {
    if (!service?.userId) {
      Alert.alert('Error', 'Service provider account could not be identified for reviews.');
      return;
    }

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to review service providers.');
      return;
    }

    if (service.userId === currentUser.uid) {
      Alert.alert('Not allowed', 'You cannot review your own service listing.');
      return;
    }

    setSubmittingReview(true);
    try {
      await submitUserReview({
        currentUser,
        ratedUserId: service.userId,
        rating,
        reviewText,
        reviewTargetType: 'service',
        reviewTargetId: service.id,
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#475569" />
          <Text style={styles.loadingText}>Loading service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Service Not Found</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const priceLabel = getPriceLabel(service);
  const locationLabel = getServiceLocationLabel(service);
  const motto = service.motto || service.businessMotto || '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow title={service.serviceName || 'Service Details'} />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Header */}
        <View style={styles.headerSection}>
          <View style={styles.coverContainer}>
            {service.serviceImage ? (
              <Image source={{ uri: service.serviceImage }} style={styles.coverImage} contentFit="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverPlaceholderText}>No Cover Image</Text>
              </View>
            )}

            {service.logoImage ? (
              <View style={styles.logoOverlayContainer}>
                <Image source={{ uri: service.logoImage }} style={styles.logoOverlayImage} contentFit="cover" />
              </View>
            ) : null}
          </View>

          {!!motto && <Text style={styles.businessMotto}>{motto}</Text>}

          {service.isFeatured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>⭐ Featured</Text>
            </View>
          )}
        </View>

        {/* Service Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>ℹ️ Service Information</Text>

          {!!service.category && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{service.category}</Text>
            </View>
          )}

          {!!priceLabel && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Pricing</Text>
              <Text style={styles.infoValue}>{priceLabel}</Text>
            </View>
          )}

          {!!service.businessHours && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Hours</Text>
              <Text style={styles.infoValue}>{service.businessHours}</Text>
            </View>
          )}

          {!!service.serviceDescription && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.infoValue}>{service.serviceDescription}</Text>
            </View>
          )}
        </View>

        {/* Contact Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>🔗 Contact Information</Text>

          {!!service.providerName && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Provider</Text>
              <Text style={styles.infoValue}>{service.providerName}</Text>
            </View>
          )}

          {!!service.contactPhone && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{service.contactPhone}</Text>
            </View>
          )}

          {!!service.contactEmail && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{service.contactEmail}</Text>
            </View>
          )}

          {!!service.contactWebsite && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Website</Text>
              <Text style={styles.infoValue}>{service.contactWebsite}</Text>
            </View>
          )}

          {!!service.contactMethod && (
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Preferred Contact</Text>
              <Text style={styles.infoValue}>{service.contactMethod}</Text>
            </View>
          )}
        </View>

        {/* Service Area */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>📍 Service Area</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{locationLabel}</Text>
          </View>
        </View>

        {/* Gallery */}
        {galleryImages.length > 0 && (
          <View style={styles.gallerySection}>
            <Text style={styles.sectionTitle}>📸 Gallery</Text>
            <FlatList
              data={galleryImages}
              keyExtractor={(item, index) => `image-${index}`}
              numColumns={2}
              columnWrapperStyle={styles.galleryRow}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.galleryImage}
                  onPress={() => {
                    setSelectedImage(item);
                    setImageModalVisible(true);
                  }}
                >
                  <Image source={{ uri: item }} style={styles.galleryImageItem} contentFit="cover" />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!!service.contactWebsite && (
            <TouchableOpacity style={styles.buttonPrimary} onPress={() => openWebsite(service.contactWebsite!)}>
              <Text style={styles.buttonPrimaryText}>🌐 Visit Website</Text>
            </TouchableOpacity>
          )}

          {!!service.contactPhone && (
            <TouchableOpacity style={styles.buttonPrimary} onPress={() => openPhone(service.contactPhone!)}>
              <Text style={styles.buttonPrimaryText}>📞 Call Provider</Text>
            </TouchableOpacity>
          )}

          {!!service.userId && (
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={() => router.push({ pathname: '/businessprofile' as any, params: { id: service.userId } })}
            >
              <Text style={styles.buttonPrimaryText}>View Provider Profile</Text>
            </TouchableOpacity>
          )}

          {!!currentUser && !isOwnService && !!service.userId && (
            <TouchableOpacity style={styles.buttonReview} onPress={() => setReviewModalVisible(true)}>
              <Text style={styles.buttonReviewText}>⭐ Leave Service Review</Text>
            </TouchableOpacity>
          )}

          {!isOwnService && (
            <TouchableOpacity style={styles.buttonDanger} onPress={handleReportService}>
              <Text style={styles.buttonDangerText}>🚩 Report Listing</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent
        onRequestClose={() => setImageModalVisible(false)}
        animationType="fade"
      >
        <View style={styles.imageModal}>
          <TouchableOpacity style={styles.imageModalOverlay} onPress={() => setImageModalVisible(false)}>
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.modalImage} contentFit="contain" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={() => setImageModalVisible(false)}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalContent}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report Service</Text>
              <TouchableOpacity style={styles.reportModalCloseButton} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.reportModalCloseButtonText}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reportModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.reportModalQuestion}>Why are you reporting this service?</Text>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportServiceReason('spam')}>
                <Text style={styles.reportReasonText}>Spam</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportServiceReason('scam')}>
                <Text style={styles.reportReasonText}>Scam/Fraud</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportServiceReason('prohibited_content')}>
                <Text style={styles.reportReasonText}>Prohibited Content</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportReasonButton} onPress={() => handleReportServiceReason('misleading_content')}>
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
        title="Review Service Provider"
        submitting={submittingReview}
        onClose={() => {
          if (!submittingReview) setReviewModalVisible(false);
        }}
        onSubmit={handleSubmitServiceReview}
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
  screenTitleRowWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
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
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: 'white',
    marginBottom: 12,
    marginHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  coverContainer: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  coverPlaceholderText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  logoOverlayContainer: {
    position: 'absolute',
    left: 16,
    bottom: -28,
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  logoOverlayImage: {
    width: '100%',
    height: '100%',
  },
  businessMotto: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 6,
  },
  featuredBadge: {
    marginBottom: 8,
    backgroundColor: '#475569',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featuredBadgeText: {
    color: '#fff',
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
