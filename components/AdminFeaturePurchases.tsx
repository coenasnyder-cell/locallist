import { collection, doc, getDocs, getFirestore, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

interface FeaturePurchase {
  id: string;
  listingId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  purchasedAt: string;
  expiresAt: string;
  notes?: string;
}

export default function AdminFeaturePurchases() {
  const [purchases, setPurchases] = useState<FeaturePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  useEffect(() => {
    fetchFeaturePurchases();
  }, []);

  const fetchFeaturePurchases = async () => {
    try {
      const db = getFirestore(app);
      const purchasesRef = collection(db, 'featurePurchases');
      const q = query(purchasesRef);

      const snapshot = await getDocs(q);
      const fetchedPurchases: FeaturePurchase[] = [];

      snapshot.forEach((docSnap) => {
        fetchedPurchases.push({
          id: docSnap.id,
          ...docSnap.data(),
        } as FeaturePurchase);
      });

      // Sort by date (newest first)
      const sorted = fetchedPurchases.sort(
        (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
      );

      setPurchases(sorted);
    } catch (error) {
      console.error('Error fetching feature purchases:', error);
      Alert.alert('Error', 'Failed to load feature purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async (purchaseId: string) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'featurePurchases', purchaseId), {
        status: 'completed',
        notes: `Payment verified by admin on ${new Date().toLocaleDateString()}`,
      });
      Alert.alert('Success', 'Feature purchase marked as completed');
      fetchFeaturePurchases();
    } catch (error) {
      console.error('Error updating purchase:', error);
      Alert.alert('Error', 'Failed to update purchase status');
    }
  };

  const handleMarkAsFailed = async (purchaseId: string) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'featurePurchases', purchaseId), {
        status: 'failed',
        notes: `Payment rejected by admin on ${new Date().toLocaleDateString()}`,
      });
      Alert.alert('Success', 'Feature purchase marked as failed');
      fetchFeaturePurchases();
    } catch (error) {
      console.error('Error updating purchase:', error);
      Alert.alert('Error', 'Failed to update purchase status');
    }
  };

  const filteredPurchases = purchases.filter((p) =>
    filter === 'all' ? true : p.status === filter
  );

  const pendingCount = purchases.filter((p) => p.status === 'pending').length;
  const completedCount = purchases.filter((p) => p.status === 'completed').length;
  const totalRevenue = purchases
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>${totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
            Completed ({completedCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {/* Purchases List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredPurchases.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No {filter} purchases</Text>
          </View>
        ) : (
          filteredPurchases.map((purchase) => (
            <View key={purchase.id} style={styles.purchaseCard}>
              <View style={styles.purchaseHeader}>
                <View>
                  <Text style={styles.purchaseTitle}>
                    ${purchase.amount.toFixed(2)} - Listing {purchase.listingId.slice(0, 8)}...
                  </Text>
                  <Text style={styles.purchaseSubtext}>
                    User: {purchase.userId.slice(0, 8)}...
                  </Text>
                </View>
                <View style={[styles.statusBadge, styles[`status${purchase.status}`]]}>
                  <Text style={styles.statusText}>{purchase.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.purchaseDetails}>
                <Text style={styles.detailText}>
                  Method: <Text style={styles.detailValue}>{purchase.paymentMethod}</Text>
                </Text>
                <Text style={styles.detailText}>
                  Purchased: <Text style={styles.detailValue}>{new Date(purchase.purchasedAt).toLocaleDateString()}</Text>
                </Text>
                <Text style={styles.detailText}>
                  Expires: <Text style={styles.detailValue}>{new Date(purchase.expiresAt).toLocaleDateString()}</Text>
                </Text>
                {purchase.notes && (
                  <Text style={styles.detailText}>
                    Notes: <Text style={styles.detailValue}>{purchase.notes}</Text>
                  </Text>
                )}
              </View>

              {/* Actions */}
              {purchase.status === 'pending' && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() =>
                      Alert.alert(
                        'Verify Payment',
                        `Mark this ${purchase.amount} purchase as completed?`,
                        [
                          { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                          {
                            text: 'Verify',
                            onPress: () => handleMarkAsCompleted(purchase.id),
                            style: 'default',
                          },
                        ]
                      )
                    }
                  >
                    <Text style={styles.actionButtonText}>✓ Verify Payment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() =>
                      Alert.alert(
                        'Reject Payment',
                        `Mark this purchase as failed?`,
                        [
                          { text: 'Cancel', onPress: () => {}, style: 'cancel' },
                          {
                            text: 'Reject',
                            onPress: () => handleMarkAsFailed(purchase.id),
                            style: 'destructive',
                          },
                        ]
                      )
                    }
                  >
                    <Text style={styles.actionButtonText}>✕ Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#475569',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#475569',
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  purchaseCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d4a574',
  },
  purchaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  purchaseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  purchaseSubtext: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statuspending: {
    backgroundColor: '#fff3cd',
  },
  statuscompleted: {
    backgroundColor: '#d4edda',
  },
  statusfailed: {
    backgroundColor: '#f8d7da',
  },
  statusrefunded: {
    backgroundColor: '#e2e3e5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  purchaseDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontWeight: '600',
    color: '#333',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#d4edda',
  },
  rejectButton: {
    backgroundColor: '#f8d7da',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
  },
});
