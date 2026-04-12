import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { app } from '../../firebase';

type ServiceDetails = {
  id: string;
  userId?: string;
  serviceName?: string;
  providerName?: string;
  category?: string;
  categoryIcon?: string;
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
  isActive?: boolean;
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

  // Show full address only when full structured address is available.
  if (address && city && state && zip) {
    return `${address}, ${city}, ${state} ${zip}`;
  }

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

  return Array.from(
    new Set(
      candidates.filter((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()))
    )
  );
}

export default function ServiceDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = getAuth().currentUser;

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

        const data = snap.data();
        if (data?.isActive === false || !isApprovedService(data)) {
          setService(null);
          return;
        }

        setService({ id: snap.id, ...(data as Omit<ServiceDetails, 'id'>) });
      } catch (error) {
        console.error('Error loading service details:', error);
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
    Alert.alert('Report Listing', 'Why are you reporting this service listing?', [
      { text: 'Spam', onPress: () => submitServiceReport('spam') },
      { text: 'Scam/Fraud', onPress: () => submitServiceReport('scam') },
      { text: 'Prohibited Content', onPress: () => submitServiceReport('prohibited_content') },
      { text: 'Misleading Information', onPress: () => submitServiceReport('misleading_content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          <Text style={styles.stateText}>Service not found or not available.</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back to Services</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const price = getPriceLabel(service);
  const locationLabel = getServiceLocationLabel(service);
  const galleryImages = useMemo(() => buildGalleryImages(service), [service]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackToCommunityHubRow />

        <View style={styles.card}>
          {service.serviceImage ? (
            <Image source={{ uri: service.serviceImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderIcon}>{service.categoryIcon || '🧰'}</Text>
            </View>
          )}

          <View style={styles.body}>
            <Text style={styles.title}>{service.serviceName || 'Service'}</Text>
            {!!service.providerName && <Text style={styles.provider}>by {service.providerName}</Text>}
            <View style={styles.pillRow}>
              {!!service.category && (
                <Text style={styles.categoryPill}>{service.categoryIcon} {service.category}</Text>
              )}
              {!!price && <Text style={styles.pricePill}>{price}</Text>}
            </View>

            {!!service.serviceDescription && (
              <Text style={styles.description}>{service.serviceDescription}</Text>
            )}

            <Text style={styles.ratingText}>Rating: Coming soon</Text>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Service Information</Text>
              <Text style={styles.meta}>Type of Service: {service.category || 'Other'}</Text>
              <Text style={styles.meta}>Location: {locationLabel}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              {!!service.contactPhone && <Text style={styles.meta}>Phone: {service.contactPhone}</Text>}
              {!!service.contactEmail && <Text style={styles.meta}>Email: {service.contactEmail}</Text>}
              {!!service.contactWebsite && <Text style={styles.meta}>Website: {service.contactWebsite}</Text>}
              {!service.contactPhone && !service.contactEmail && !service.contactWebsite && (
                <Text style={styles.meta}>No contact details provided.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Gallery</Text>
              {galleryImages.length > 0 ? (
                <View style={styles.galleryGrid}>
                  {galleryImages.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
                  ))}
                </View>
              ) : (
                <Text style={styles.meta}>No gallery images yet.</Text>
              )}
            </View>

            <View style={styles.bottomActionsWrap}>
              <TouchableOpacity
                style={[styles.actionButton, !service.contactWebsite ? styles.actionButtonDisabled : null]}
                onPress={() => service.contactWebsite && openWebsite(service.contactWebsite)}
                disabled={!service.contactWebsite}
              >
                <Text style={styles.actionButtonText}>Visit Website</Text>
              </TouchableOpacity>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 24,
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
  ratingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
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
});
