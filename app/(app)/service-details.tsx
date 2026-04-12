import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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
  priceType?: string;
  priceAmount?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactWebsite?: string | null;
  serviceArea?: string | null;
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
            {!!service.category && (
              <Text style={styles.category}>{service.categoryIcon} {service.category}</Text>
            )}
            {!!price && <Text style={styles.price}>{price}</Text>}

            {!!service.serviceDescription && (
              <Text style={styles.description}>{service.serviceDescription}</Text>
            )}

            {!!service.serviceArea && <Text style={styles.meta}>Service Area: {service.serviceArea}</Text>}
            {!!service.city && <Text style={styles.meta}>City: {service.city}</Text>}

            {!!service.contactPhone && (
              <TouchableOpacity style={styles.actionButton} onPress={() => openPhone(service.contactPhone!)}>
                <Text style={styles.actionButtonText}>Call {service.contactPhone}</Text>
              </TouchableOpacity>
            )}

            {!!service.contactWebsite && (
              <TouchableOpacity style={styles.actionButton} onPress={() => openWebsite(service.contactWebsite!)}>
                <Text style={styles.actionButtonText}>Visit Website</Text>
              </TouchableOpacity>
            )}

            {(!currentUser || service.userId !== currentUser.uid) && (
              <TouchableOpacity style={styles.reportButton} onPress={handleReportService}>
                <Text style={styles.reportButtonText}>Report Listing</Text>
              </TouchableOpacity>
            )}

            {!!service.contactEmail && (
              <Text style={styles.meta}>Contact Email: {service.contactEmail}</Text>
            )}

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back to Services</Text>
            </TouchableOpacity>
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
  category: {
    marginTop: 10,
    fontSize: 14,
    color: '#0f766e',
    fontWeight: '700',
  },
  price: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  meta: {
    marginTop: 10,
    fontSize: 13,
    color: '#475569',
  },
  actionButton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#0f766e',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  reportButton: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fff1f2',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 13,
  },
  backButton: {
    marginTop: 14,
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
});
