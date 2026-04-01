import { Feather } from '@expo/vector-icons';
import { collection, doc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

type Listing = {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
  createdAt?: any;
};

function isPendingListing(item: Listing) {
  const status = String(item.status || '').toLowerCase();
  const approvalStatus = String(item.approvalStatus || '').toLowerCase();
  return status === 'pending' || approvalStatus === 'pending' || item.isApproved === false;
}

function toDateLabel(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore(app);
    const unsubscribe = onSnapshot(
      collection(db, 'listings'),
      (snapshot) => {
        const rows: Listing[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Listing, 'id'>),
        }));
        setListings(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading listings queue:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pendingListings = useMemo(
    () => listings.filter(isPendingListing),
    [listings]
  );

  const updateListingStatus = async (item: Listing, nextStatus: 'approved' | 'rejected') => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'listings', item.id), {
        status: nextStatus,
        approvalStatus: nextStatus,
        isApproved: nextStatus === 'approved',
        reviewedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error marking listing as ${nextStatus}:`, error);
      Alert.alert('Error', `Failed to ${nextStatus === 'approved' ? 'approve' : 'reject'} listing.`);
    }
  };

  const confirmUpdate = (item: Listing, nextStatus: 'approved' | 'rejected') => {
    const actionLabel = nextStatus === 'approved' ? 'Approve' : 'Reject';
    Alert.alert(
      `${actionLabel} listing`,
      `${actionLabel} ${item.title || 'this listing'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: actionLabel, style: nextStatus === 'approved' ? 'default' : 'destructive', onPress: () => updateListingStatus(item, nextStatus) },
      ]
    );
  };

  const renderListingCard = ({ item }: { item: Listing }) => (
    <View style={styles.card}>
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
          <Text style={styles.pendingBadgeText}>Pending</Text>
        </View>
        <Text style={styles.statusHint}>Feature placement and other advanced controls stay on web admin.</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => confirmUpdate(item, 'approved')}>
          <Feather name="check" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => confirmUpdate(item, 'rejected')}>
          <Feather name="x" size={16} color="#fff" />
          <Text style={styles.actionButtonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Pending Listings</Text>
          <Text style={styles.headerSubtitle}>Fast approve or reject decisions only.</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingListings.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading listings...</Text>
        </View>
      ) : pendingListings.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="check-circle" size={52} color="#16a34a" />
          <Text style={styles.emptyStateTitle}>No pending listings</Text>
          <Text style={styles.emptyStateText}>The queue is clear for now.</Text>
        </View>
      ) : (
        <FlatList
          data={pendingListings}
          keyExtractor={(item) => item.id}
          renderItem={renderListingCard}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  statusHint: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
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
});
