import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getFirestore, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type PendingListing = {
  id: string;
  title?: string;
  price?: number;
  sellerName?: string;
  sellerEmail?: string;
  zipCode?: string;
  createdAt?: any;
  flaggedOutOfState?: boolean;
};

export default function AdminPendingListings() {
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([]);
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
    if (!isAdmin) return;

    const db = getFirestore(app);
    const q = query(collection(db, 'listings'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PendingListing[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setPendingListings(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const approveListing = async (listingId: string) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'listings', listingId), {
        status: 'approved',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not approve listing.');
    }
  };

  const rejectListing = async (listingId: string) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'listings', listingId), {
        status: 'rejected',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not reject listing.');
    }
  };

  const deleteListing = async (listingId: string) => {
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to permanently delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = getFirestore(app);
              await deleteDoc(doc(db, 'listings', listingId));
              Alert.alert('Success', 'Listing deleted.');
            } catch (error) {
              Alert.alert('Error', 'Could not delete listing.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: PendingListing }) => {
    const createdLabel = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : '';
    const priceLabel = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : '';
    const sellerLabel = item.sellerName || item.sellerEmail || '';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title || 'Listing'}</Text>
          {priceLabel ? <Text style={styles.price}>{priceLabel}</Text> : null}
        </View>
        {sellerLabel ? <Text style={styles.meta}>Seller: {sellerLabel}</Text> : null}
        {item.zipCode ? <Text style={styles.meta}>Zip: {item.zipCode}</Text> : null}
        {createdLabel ? <Text style={styles.meta}>Created: {createdLabel}</Text> : null}
        {item.flaggedOutOfState && (
          <Text style={[styles.meta, { color: '#FF9800', fontWeight: 'bold' }]}>⚠️ Flagged for location review - mentions out-of-state references</Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.approveButton]} onPress={() => approveListing(item.id)}>
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.rejectButton]} onPress={() => rejectListing(item.id)}>
            <Feather name="x" size={16} color="#fff" />
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={() => deleteListing(item.id)}>
            <Feather name="trash-2" size={16} color="#fff" />
            <Text style={styles.buttonText}>Delete</Text>
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
          <Feather name="lock" size={64} color="#F44336" />
          <Text style={styles.unauthorizedText}>Access Denied</Text>
          <Text style={styles.unauthorizedSubtext}>You do not have admin access.</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pending Listings</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingListings.length}</Text>
            </View>
          </View>
          {loading ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : pendingListings.length === 0 ? (
            <View style={styles.centerContent}>
              <Feather name="check-circle" size={64} color="#4CAF50" />
              <Text style={styles.emptyText}>No pending listings</Text>
              <Text style={styles.emptySubtext}>All listings are reviewed.</Text>
            </View>
          ) : (
            <FlatList
              data={pendingListings}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  badge: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  unauthorizedText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    marginTop: 16,
  },
  unauthorizedSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  deleteButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
