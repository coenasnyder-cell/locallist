import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type PendingBusiness = {
  id: string;
  businessName?: string;
  businessCategory?: string;
  businessAddress?: string;
  businessCity?: string;
  businessState?: string;
  businessZipcode?: string;
  userEmail?: string;
  userId?: string;
  approvalStatus?: string;
  isApproved?: boolean;
  updatedAt?: any;
  createdAt?: any;
};

function isPendingBusiness(item: PendingBusiness) {
  const approvalStatus = String(item.approvalStatus || '').toLowerCase();
  return item.isApproved !== true && approvalStatus !== 'rejected' && approvalStatus !== 'deleted';
}

function formatDate(value: any) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminPendingBusinesses() {
  const [businesses, setBusinesses] = useState<PendingBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }

        const adminStatus = await checkIsAdmin(user.uid);
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const db = getFirestore(app);
    const unsubscribe = onSnapshot(
      collection(db, 'businessLocal'),
      (snapshot) => {
        const rows: PendingBusiness[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<PendingBusiness, 'id'>),
        }));
        setBusinesses(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading business approvals:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const pendingBusinesses = useMemo(() => businesses.filter((item) => isPendingBusiness(item)), [businesses]);

  const updateBusinessStatus = async (item: PendingBusiness, nextStatus: 'approved' | 'rejected') => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'businessLocal', item.id), {
        isApproved: nextStatus === 'approved',
        approvalStatus: nextStatus,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error marking business as ${nextStatus}:`, error);
      Alert.alert('Error', `Failed to ${nextStatus === 'approved' ? 'approve' : 'reject'} business.`);
    }
  };

  const confirmAction = (item: PendingBusiness, nextStatus: 'approved' | 'rejected') => {
    const actionLabel = nextStatus === 'approved' ? 'Approve' : 'Reject';
    Alert.alert(
      `${actionLabel} business`,
      `${actionLabel} ${item.businessName || 'this business profile'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: actionLabel, style: nextStatus === 'approved' ? 'default' : 'destructive', onPress: () => updateBusinessStatus(item, nextStatus) },
      ]
    );
  };

  const renderBusiness = ({ item }: { item: PendingBusiness }) => {
    const location = [item.businessCity, item.businessState, item.businessZipcode].filter(Boolean).join(', ');
    const submittedDate = formatDate(item.updatedAt || item.createdAt);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{item.businessName || 'Business'}</Text>
            {submittedDate ? <Text style={styles.cardMeta}>Submitted {submittedDate}</Text> : null}
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Pending</Text>
          </View>
        </View>

        {item.businessCategory ? <Text style={styles.detailText}>{item.businessCategory}</Text> : null}
        {location ? <Text style={styles.detailText}>{location}</Text> : null}
        {item.businessAddress ? <Text style={styles.detailText}>{item.businessAddress}</Text> : null}
        {item.userEmail ? <Text style={styles.detailText}>{item.userEmail}</Text> : null}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => confirmAction(item, 'approved')}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => confirmAction(item, 'rejected')}>
            <Feather name="x" size={16} color="#fff" />
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {checkingAuth ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Checking authorization...</Text>
        </View>
      ) : !isAdmin ? (
        <View style={styles.centerContent}>
          <Feather name="lock" size={64} color="#ef4444" />
          <Text style={styles.unauthorizedText}>Access Denied</Text>
          <Text style={styles.unauthorizedSubtext}>You do not have admin access.</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Pending Businesses</Text>
              <Text style={styles.headerSubtitle}>Approve or reject business profiles waiting for review.</Text>
            </View>
            <View style={styles.headerCount}>
              <Text style={styles.headerCountText}>{pendingBusinesses.length}</Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading business approvals...</Text>
            </View>
          ) : pendingBusinesses.length === 0 ? (
            <View style={styles.centerContent}>
              <Feather name="check-circle" size={52} color="#16a34a" />
              <Text style={styles.emptyTitle}>No pending businesses</Text>
              <Text style={styles.emptyBody}>The approval queue is clear.</Text>
            </View>
          ) : (
            <FlatList
              data={pendingBusinesses}
              keyExtractor={(item) => item.id}
              renderItem={renderBusiness}
              contentContainerStyle={styles.listContent}
            />
          )}
        </>
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
    gap: 12,
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
  headerCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f766e',
    paddingHorizontal: 10,
  },
  headerCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  unauthorizedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 16,
  },
  unauthorizedSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
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
    marginBottom: 10,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfeff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f766e',
  },
  detailText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
    marginTop: 4,
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
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
