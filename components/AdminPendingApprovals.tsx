import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

interface PendingUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  zipCode: string;
  requestedAt: any;
}

export default function AdminPendingApprovals() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);


  // Check if current user is admin
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

  // Only load pending users if admin
  useEffect(() => {
    if (!isAdmin) return;
    
    const db = getFirestore(app);
    const pendingRef = collection(db, 'pendingApprovals');

    // Real-time listener for pending approvals
    const unsubscribe = onSnapshot(pendingRef, (snapshot) => {
      const users: PendingUser[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        userId: doc.data().userId || doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        zipCode: doc.data().zipCode || '',
        requestedAt: doc.data().requestedAt,
      }));

      // Sort by most recent first
      users.sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0));
      setPendingUsers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const approveUser = async (userId: string, email: string) => {
    try {
      const db = getFirestore(app);

      // Update user status to approved
      await updateDoc(doc(db, 'users', userId), {
        status: 'approved',
        zipApproved: true,
        isDisabled: false,
        isBanned: false,
      });

      // Update pending approval status
      await updateDoc(doc(db, 'pendingApprovals', userId), {
        status: 'approved',
      });

      Alert.alert('Success', `User ${email} has been approved!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to approve user');
      console.error('Approval error:', error);
    }
  };

  const rejectUser = async (userId: string, email: string) => {
    try {
      const db = getFirestore(app);

      // Update pending approval status to rejected
      await updateDoc(doc(db, 'pendingApprovals', userId), {
        status: 'rejected',
      });

      await updateDoc(doc(db, 'users', userId), {
        status: 'rejected',
        zipApproved: false,
      });

      // Optionally delete the user (comment out if you want to keep rejected users)
      // await deleteDoc(doc(db, 'users', userId));

      Alert.alert('Success', `User ${email} has been rejected!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject user');
      console.error('Rejection error:', error);
    }
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const renderPendingUser = ({ item }: { item: PendingUser }) => {
    const requestDate = item.requestedAt?.toDate?.();
    const formattedDate = requestDate
      ? requestDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
    const displayName = item.name || item.email || 'User';

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={32} color="#bbb" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.name}>{displayName}</Text>
            {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
            {item.zipCode ? <Text style={styles.zipCode}>Zip: {item.zipCode}</Text> : null}
            {formattedDate ? <Text style={styles.date}>Requested: {formattedDate}</Text> : null}
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() =>
              confirmAction(
                'Approve user',
                `Approve ${item.email}? They will be allowed to post and message.`,
                () => approveUser(item.userId, item.email)
              )
            }
          >
            <Feather name="check" size={20} color="#fff" />
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() =>
              confirmAction(
                'Reject user',
                `Reject ${item.email}? They will be blocked from posting and messaging.`,
                () => rejectUser(item.userId, item.email)
              )
            }
          >
            <Feather name="x" size={20} color="#fff" />
            <Text style={styles.buttonText}>Reject</Text>
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
          <Text style={styles.unauthorizedSubtext}>You don't have admin access. Please contact support.</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Pending Approvals</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingUsers.length}</Text>
            </View>
          </View>

          {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : pendingUsers.length === 0 ? (
        <View style={styles.centerContent}>
          <Feather name="check-circle" size={64} color="#4CAF50" />
          <Text style={styles.emptyText}>All users approved!</Text>
          <Text style={styles.emptySubtext}>No pending approvals at this time.</Text>
        </View>
      ) : (
        <FlatList
          data={pendingUsers}
          renderItem={renderPendingUser}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
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
    fontSize: 24,
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
  userCard: {
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
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  zipCode: {
    fontSize: 13,
    color: '#FF9800',
    marginTop: 4,
    fontWeight: '600',
  },
  date: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
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
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
