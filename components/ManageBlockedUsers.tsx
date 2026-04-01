import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { arrayRemove, doc, getFirestore, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

type BlockedUser = {
  id: string;
  email?: string;
  name?: string;
};

export default function ManageBlockedUsers() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userRef, async (userSnap) => {
      const userData = userSnap.data();
      const blockedUserIds = userData?.blockedUsers || [];

      if (blockedUserIds.length === 0) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }

      // Fetch details for each blocked user
      try {
        const blockedUsersData: BlockedUser[] = [];
        for (const blockedUserId of blockedUserIds) {
          const blockedUserRef = doc(db, 'users', blockedUserId);
          const blockedUserSnap = await new Promise<any>((resolve) => {
            const unsub = onSnapshot(blockedUserRef, (snap) => {
              unsub();
              resolve(snap);
            });
          });

          if (blockedUserSnap.exists()) {
            const data = blockedUserSnap.data();
            blockedUsersData.push({
              id: blockedUserId,
              email: data.email,
              name: data.name,
            });
          }
        }
        setBlockedUsers(blockedUsersData);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const unblockUser = async (blockedUserId: string) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) return;

    setUnblockingId(blockedUserId);
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        blockedUsers: arrayRemove(blockedUserId),
      });

      Alert.alert('Success', 'User unblocked');
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', 'Failed to unblock user.');
    } finally {
      setUnblockingId(null);
    }
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.card}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.name || item.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.name}>{item.name || 'Unknown User'}</Text>
          <Text style={styles.email}>{item.email || 'No email'}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => {
          Alert.alert('Unblock user', `Unblock ${item.name || item.email}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unblock',
              style: 'destructive',
              onPress: () => unblockUser(item.id),
            },
          ]);
        }}
        disabled={unblockingId === item.id}
      >
        <Feather name="unlock" size={18} color="#4CAF50" />
        <Text style={styles.unblockButtonText}>
          {unblockingId === item.id ? 'Unblocking...' : 'Unblock'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centerContent}>
          <Feather name="check-circle" size={64} color="#4CAF50" />
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySubtext}>
            Users you block won't be able to message you
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Blocked Users</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{blockedUsers.length}</Text>
            </View>
          </View>
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderBlockedUser}
            contentContainerStyle={styles.listContent}
          />
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
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  badge: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  email: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    gap: 6,
  },
  unblockButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
});
