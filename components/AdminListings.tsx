import { Feather } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

type ModerationConfidence = 'low' | 'medium' | 'high';

type ListingModeration = {
  flagged: boolean;
  reason: string;
  confidence: ModerationConfidence;
};

type Listing = {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  status?: string;
  createdAt?: any;
  moderation: ListingModeration;
};

const DEFAULT_MODERATION: ListingModeration = {
  flagged: false,
  reason: '',
  confidence: 'low',
};

function toDateLabel(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeModeration(data: Record<string, unknown> | undefined): ListingModeration {
  const confidence = data?.confidence;

  return {
    flagged: typeof data?.flagged === 'boolean' ? data.flagged : DEFAULT_MODERATION.flagged,
    reason: typeof data?.reason === 'string' ? data.reason.trim() : DEFAULT_MODERATION.reason,
    confidence:
      confidence === 'low' || confidence === 'medium' || confidence === 'high'
        ? confidence
        : DEFAULT_MODERATION.confidence,
  };
}

function getRiskPresentation(confidence: ModerationConfidence) {
  switch (confidence) {
    case 'high':
      return {
        label: 'High Risk',
        containerStyle: styles.highRiskBadge,
        textStyle: styles.highRiskBadgeText,
        cardStyle: styles.highRiskCard,
      };
    case 'medium':
      return {
        label: 'Medium Risk',
        containerStyle: styles.mediumRiskBadge,
        textStyle: styles.mediumRiskBadgeText,
        cardStyle: styles.mediumRiskCard,
      };
    default:
      return {
        label: 'Low Risk',
        containerStyle: styles.lowRiskBadge,
        textStyle: styles.lowRiskBadgeText,
        cardStyle: styles.lowRiskCard,
      };
  }
}

export default function AdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  useEffect(() => {
    const db = getFirestore(app);
    const listingsQuery = query(
      collection(db, 'listings'),
      where('status', '==', 'pending_review'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      listingsQuery,
      async (snapshot) => {
        try {
          const rows = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const moderationSnap = await getDoc(doc(db, 'listings', docSnap.id, 'moderation', 'result'));

              return {
                id: docSnap.id,
                ...(docSnap.data() as Omit<Listing, 'id' | 'moderation'>),
                moderation: moderationSnap.exists()
                  ? normalizeModeration(moderationSnap.data() as Record<string, unknown>)
                  : DEFAULT_MODERATION,
              };
            })
          );

          setListings(rows);
        } catch (error) {
          console.error('Error loading moderation metadata:', error);
          setListings([]);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error loading listings queue:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateListingStatus = async (item: Listing, nextStatus: 'active' | 'rejected') => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'listings', item.id), {
        status: nextStatus,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error marking listing as ${nextStatus}:`, error);
      Alert.alert('Error', `Failed to ${nextStatus === 'active' ? 'approve' : 'reject'} listing.`);
    }
  };

  const confirmUpdate = (item: Listing, nextStatus: 'active' | 'rejected') => {
    const actionLabel = nextStatus === 'active' ? 'Approve' : 'Reject';
    Alert.alert(
      `${actionLabel} listing`,
      `${actionLabel} ${item.title || 'this listing'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: actionLabel, style: nextStatus === 'active' ? 'default' : 'destructive', onPress: () => updateListingStatus(item, nextStatus) },
      ]
    );
  };

  const openListingDetails = (item: Listing) => {
    setSelectedListing(item);
    setDetailsVisible(true);
  };

  const renderListingCard = ({ item }: { item: Listing }) => {
    const risk = getRiskPresentation(item.moderation.confidence);

    return (
      <View style={[styles.card, risk.cardStyle]}>
        <View style={styles.cardHeader}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{item.title || 'Untitled Listing'}</Text>
            <Text style={styles.meta}>Submitted {toDateLabel(item.createdAt)}</Text>
          </View>
          <Text style={styles.price}>{typeof item.price === 'number' ? `$${item.price}` : 'No price'}</Text>
        </View>

        <Text style={styles.description} numberOfLines={3}>
          {item.description || 'No description provided.'}
        </Text>

        <View style={styles.statusRow}>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending Review</Text>
          </View>
          <View style={[styles.riskBadge, risk.containerStyle]}>
            <Text style={[styles.riskBadgeText, risk.textStyle]}>{risk.label}</Text>
          </View>
        </View>

        <View style={styles.flaggedSection}>
          <Text style={styles.flaggedLabel}>WHY THIS WAS FLAGGED</Text>
          <Text style={styles.flaggedReason}>
            {item.moderation.reason || 'No detailed reason was returned by moderation.'}
          </Text>
        </View>

        <Text style={styles.statusHint}>Confidence should drive the first-pass review decision.</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => confirmUpdate(item, 'active')}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => confirmUpdate(item, 'rejected')}>
            <Feather name="x" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.detailsButton} onPress={() => openListingDetails(item)}>
          <Feather name="eye" size={15} color="#1d4ed8" />
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
        <View style={styles.header}>
          <View>
          <Text style={styles.headerTitle}>AI Flagged Listings</Text>
          <Text style={styles.headerSubtitle}>Quick moderation decisions for listings held before publication.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{listings.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading listings...</Text>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={52} color="#16a34a" />
          <Text style={styles.emptyStateTitle}>No pending listings</Text>
          <Text style={styles.emptyStateText}>The queue is clear for now.</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingCard}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Listing Details</Text>
                <TouchableOpacity onPress={() => setDetailsVisible(false)} style={styles.modalCloseButton}>
                  <Feather name="x" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {selectedListing ? (
                <>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Title</Text>
                    <Text style={styles.modalValue}>{selectedListing.title || 'Untitled Listing'}</Text>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Description</Text>
                    <Text style={styles.modalBody}>{selectedListing.description || 'No description provided.'}</Text>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Moderation Confidence</Text>
                    <View style={[styles.modalRiskBadge, getRiskPresentation(selectedListing.moderation.confidence).containerStyle]}>
                      <Text style={[styles.modalRiskText, getRiskPresentation(selectedListing.moderation.confidence).textStyle]}>
                        {getRiskPresentation(selectedListing.moderation.confidence).label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Why This Was Flagged</Text>
                    <Text style={styles.modalBody}>
                      {selectedListing.moderation.reason || 'No detailed reason was returned by moderation.'}
                    </Text>
                  </View>

                  <View style={styles.modalMetaGrid}>
                    <View style={styles.modalMetaCard}>
                      <Text style={styles.modalMetaLabel}>Status</Text>
                      <Text style={styles.modalMetaValue}>{selectedListing.status || 'pending_review'}</Text>
                    </View>
                    <View style={styles.modalMetaCard}>
                      <Text style={styles.modalMetaLabel}>Created</Text>
                      <Text style={styles.modalMetaValue}>{toDateLabel(selectedListing.createdAt) || 'Unknown'}</Text>
                    </View>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  badge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  highRiskCard: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  mediumRiskCard: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  lowRiskCard: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  meta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  description: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  statusRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pendingBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c2410c',
  },
  riskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  highRiskBadge: {
    backgroundColor: '#dc2626',
  },
  highRiskBadgeText: {
    color: '#fff',
  },
  mediumRiskBadge: {
    backgroundColor: '#facc15',
  },
  mediumRiskBadgeText: {
    color: '#713f12',
  },
  lowRiskBadge: {
    backgroundColor: '#16a34a',
  },
  lowRiskBadgeText: {
    color: '#fff',
  },
  flaggedSection: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
    gap: 6,
  },
  flaggedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#991b1b',
  },
  flaggedReason: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  approveButton: {
    backgroundColor: '#16a34a',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  detailsButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
  },
  detailsButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalContent: {
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  modalSection: {
    marginTop: 14,
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  modalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  modalRiskBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalRiskText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalMetaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalMetaCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  modalMetaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
});
