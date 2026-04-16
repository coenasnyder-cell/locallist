import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SafeAreaContext from 'react-native-safe-area-context';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import UserReviewModal from '../../components/UserReviewModal';
import { app } from '../../firebase';
import { submitUserReview } from '../../utils/userReviews';

const { SafeAreaView } = SafeAreaContext;

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
  const currentUser = getAuth().currentUser;
  const galleryImages = useMemo(() => buildGalleryImages(service), [service]);

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
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#0f766e" />
          <Text style={styles.stateText}>Loading service...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <BackToCommunityHubRow />
        <View style={styles.centerState}>
          <Text style={styles.stateText}>Service not found.</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back to Services</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const priceLabel = getPriceLabel(service);
  const locationLabel = getServiceLocationLabel(service);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackToCommunityHubRow fallbackRoute="/(app)/serviceslist" />

        <View style={styles.card}>
          {service.serviceImage ? (
            <Image source={{ uri: service.serviceImage }} style={styles.heroImage} contentFit="cover" />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderIcon}>🛠️</Text>
            </View>
          )}

          <View style={styles.body}>
            <Text style={styles.title}>{service.serviceName || 'Service'}</Text>
            {!!service.providerName && <Text style={styles.provider}>By {service.providerName}</Text>}
            {!!service.userId && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/businessprofile', params: { id: service.userId } })}>
                <Text style={styles.profileLink}>View Provider Profile</Text>
              </TouchableOpacity>
            )}

            <View style={styles.pillRow}>
              {!!service.category && <Text style={styles.categoryPill}>{service.category}</Text>}
              {!!priceLabel && <Text style={styles.pricePill}>{priceLabel}</Text>}
            </View>

            {!!service.serviceDescription && <Text style={styles.description}>{service.serviceDescription}</Text>}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Service Area</Text>
              <Text style={styles.meta}>{locationLabel}</Text>
            </View>

            {galleryImages.length > 1 ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Gallery</Text>
                <View style={styles.galleryGrid}>
                  {galleryImages.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={styles.galleryImage} contentFit="cover" />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.bottomActionsWrap}>
              <TouchableOpacity
                style={[styles.actionButton, !service.contactWebsite ? styles.actionButtonDisabled : null]}
                onPress={() => service.contactWebsite && openWebsite(service.contactWebsite)}
                disabled={!service.contactWebsite}
              >
                <Text style={styles.actionButtonText}>Visit Website</Text>
              </TouchableOpacity>

              {!!service.contactPhone && (
                <TouchableOpacity style={styles.backButton} onPress={() => openPhone(service.contactPhone as string)}>
                  <Text style={styles.backButtonText}>Call Provider</Text>
                </TouchableOpacity>
              )}

              {!!currentUser && service.userId !== currentUser.uid && (
                <TouchableOpacity style={styles.reviewButton} onPress={() => setReviewModalVisible(true)}>
                  <Text style={styles.reviewButtonText}>Leave Service Review</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>Back to Services</Text>
              </TouchableOpacity>

              {(!currentUser || service.userId !== currentUser.uid) && (
                <TouchableOpacity onPress={handleReportService} activeOpacity={0.8}>
                  <Text style={styles.reportProviderLink}>Report service provider</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <UserReviewModal
        visible={reviewModalVisible}
        title="Review Service Provider"
        submitting={submittingReview}
        onClose={() => {
          if (!submittingReview) setReviewModalVisible(false);
        }}
        onSubmit={handleSubmitServiceReview}
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
              <Text style={styles.reportModalTitle}>Report Service</Text>
              <TouchableOpacity
                style={styles.reportModalCloseButton}
                onPress={() => setReportModalVisible(false)}
              >
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 56,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  stateText: {
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#cbd5e1',
  },
  placeholderImage: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  body: {
    padding: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
  },
  provider: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
  },
  profileLink: {
    marginTop: 4,
    fontSize: 14,
    color: '#0f766e',
    fontWeight: '700',
  },
  pillRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    fontSize: 13,
    color: '#0f766e',
    fontWeight: '700',
    backgroundColor: '#e6f6f4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pricePill: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  sectionCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  galleryGrid: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  galleryImage: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  bottomActionsWrap: {
    marginTop: 14,
  },
  actionButton: {
    marginTop: 0,
    borderRadius: 8,
    backgroundColor: '#0f766e',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  reviewButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#eef2ff',
  },
  reviewButtonText: {
    color: '#3730a3',
    fontWeight: '700',
    fontSize: 13,
  },
  backButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  backButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  reportProviderLink: {
    marginTop: 12,
    textAlign: 'center',
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
