import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  accountType?: 'user' | 'business';
  businessName?: string | null;
  businessDescription?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  subscriptionPlan?: 'free' | 'basic' | 'premium' | 'enterprise';
  subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'trial';
  subscriptionStartedAt?: any;
  subscriptionExpiresAt?: any;
  zipCode?: string;
  status?: string;
  zipApproved?: boolean;
  isDisabled?: boolean;
  isBanned?: boolean;
  isSuspended?: boolean;
  suspendedUntil?: any;
  suspendReason?: string | null;
  suspendedAt?: any;
  suspendedBy?: string | null;
  role?: string;
  banReason?: string | null;
  bannedAt?: any;
  bannedBy?: string | null;
};

interface AdminUsersListProps {
  initialTab?: 'pending' | 'flagged' | 'all';
  initialAccountTypeFilter?: 'all' | 'user' | 'business';
  onBack?: () => void;
}

export default function AdminUsersList({ initialTab = 'all', initialAccountTypeFilter = 'all', onBack }: AdminUsersListProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'flagged' | 'all'>(initialTab);
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'user' | 'business'>(initialAccountTypeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendDuration, setSuspendDuration] = useState('7');
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);

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
    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const rows: UserRow[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<UserRow, 'id'>),
        }));
        setUsers(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Snapshot listener error (users):', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  const setUserFields = async (userId: string, fields: Partial<UserRow>) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', userId), fields);
    } catch (error) {
      console.error('Failed to update user:', error);
      Alert.alert('Error', 'Failed to update user.');
    }
  };

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  };

  const openBanModal = (target: UserRow) => {
    setBanTarget(target);
    setBanReason('');
    setBanModalVisible(true);
  };

  const submitBan = async () => {
    if (!banTarget) return;
    if (!banReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for the ban.');
      return;
    }

    try {
      const db = getFirestore(app);
      const auth = getAuth();
      await updateDoc(doc(db, 'users', banTarget.id), {
        isBanned: true,
        banReason: banReason.trim(),
        bannedAt: serverTimestamp(),
        bannedBy: auth.currentUser?.uid || null,
      });
      setBanModalVisible(false);
    } catch (error) {
      console.error('Failed to ban user:', error);
      Alert.alert('Error', 'Failed to ban user.');
    }
  };

  const openSuspendModal = (target: UserRow) => {
    setSuspendTarget(target);
    setSuspendReason('');
    setSuspendDuration('7');
    setSuspendModalVisible(true);
  };

  const submitSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for the suspension.');
      return;
    }

    try {
      const db = getFirestore(app);
      const auth = getAuth();
      const suspendUntil = new Date();
      suspendUntil.setDate(suspendUntil.getDate() + parseInt(suspendDuration));
      
      await updateDoc(doc(db, 'users', suspendTarget.id), {
        isSuspended: true,
        suspendReason: suspendReason.trim(),
        suspendedAt: serverTimestamp(),
        suspendedBy: auth.currentUser?.uid || null,
        suspendedUntil: suspendUntil,
      });
      setSuspendModalVisible(false);
    } catch (error) {
      console.error('Failed to suspend user:', error);
      Alert.alert('Error', 'Failed to suspend user.');
    }
  };

  const unsuspendUser = async (userId: string) => {
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'users', userId), {
        isSuspended: false,
        suspendReason: null,
        suspendedAt: null,
        suspendedBy: null,
        suspendedUntil: null,
      });
    } catch (error) {
      console.error('Failed to unsuspend user:', error);
      Alert.alert('Error', 'Failed to unsuspend user.');
    }
  };

  const toggleAccountType = async (target: UserRow) => {
    const currentType = target.accountType === 'business' ? 'business' : 'user';
    const nextType = currentType === 'business' ? 'user' : 'business';
    const targetName = target.email || target.name || 'this user';

    confirmAction(
      `${nextType === 'business' ? 'Convert to business' : 'Convert to user'}`,
      `Change ${targetName} to a ${nextType} account?`,
      async () => {
        const nextFields: Partial<UserRow> = {
          accountType: nextType,
        };

        if (nextType === 'business') {
          nextFields.businessName = target.businessName ?? null;
          nextFields.businessDescription = target.businessDescription ?? null;
          nextFields.businessPhone = target.businessPhone ?? null;
          nextFields.businessWebsite = target.businessWebsite ?? null;
          nextFields.subscriptionPlan = target.subscriptionPlan || 'free';
          nextFields.subscriptionStatus = target.subscriptionStatus || 'active';
          if (!target.subscriptionStartedAt) {
            nextFields.subscriptionStartedAt = serverTimestamp();
          }
        } else {
          nextFields.businessName = null;
          nextFields.businessDescription = null;
          nextFields.businessPhone = null;
          nextFields.businessWebsite = null;
          nextFields.subscriptionPlan = 'free';
          nextFields.subscriptionStatus = 'active';
        }

        await setUserFields(target.id, nextFields);
      }
    );
  };

  const pendingUsers = users.filter((u) => u.status !== 'approved');
  const flaggedUsers = users.filter((u) => u.isBanned || u.isSuspended);
  const tabUsers = activeTab === 'pending' ? pendingUsers : activeTab === 'flagged' ? flaggedUsers : users;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const displayUsers = tabUsers.filter((user) => {
    const normalizedType = user.accountType === 'business' ? 'business' : 'user';
    if (accountTypeFilter !== 'all' && normalizedType !== accountTypeFilter) return false;

    if (!normalizedSearch) return true;
    return (
      user.name?.toLowerCase().includes(normalizedSearch)
      || user.email?.toLowerCase().includes(normalizedSearch)
      || user.zipCode?.toLowerCase().includes(normalizedSearch)
      || user.businessName?.toLowerCase().includes(normalizedSearch)
    );
  });

  const renderItem = ({ item }: { item: UserRow }) => {
    const statusLabel = item.status || '';
    const accountTypeLabel = item.accountType === 'business' ? 'Business' : 'User';
    const disabledLabel = item.isDisabled ? 'Disabled' : 'Active';
    const bannedLabel = item.isBanned ? 'Banned' : 'Not banned';
    const zipLabel = item.zipCode || '';
    const displayName = item.name || item.email || 'User';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.name}>{displayName}</Text>
          {item.email ? <Text style={styles.email}>{item.email}</Text> : null}
        </View>
        {statusLabel ? <Text style={styles.meta}>Status: {statusLabel}</Text> : null}
        <Text style={styles.meta}>Type: {accountTypeLabel}</Text>
        {item.accountType === 'business' && item.businessName && (
          <Text style={styles.meta}>Business: {item.businessName}</Text>
        )}
        {item.accountType === 'business' && (
          <Text style={[styles.meta, { color: item.subscriptionPlan === 'free' ? '#666' : '#1565C0', fontWeight: '600' }]}>
            Plan: {(item.subscriptionPlan || 'free').toUpperCase()} {item.subscriptionStatus && `(${item.subscriptionStatus})`}
          </Text>
        )}
        {zipLabel ? <Text style={styles.meta}>ZIP: {zipLabel} {item.zipApproved ? '(approved)' : '(unapproved)'}</Text> : null}
        <Text style={styles.meta}>Account: {disabledLabel} | {bannedLabel}</Text>
        {item.isSuspended && (
          <Text style={[styles.meta, { color: '#FF9800', fontWeight: 'bold' }]}>⏸️ Suspended</Text>
        )}
        {!!item.banReason && item.isBanned && (
          <Text style={styles.meta}>Ban reason: {item.banReason}</Text>
        )}
        {!!item.suspendReason && item.isSuspended && (
          <Text style={styles.meta}>Suspend reason: {item.suspendReason}</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.approveButton]}
            onPress={() =>
              confirmAction(
                'Approve user',
                `Approve ${item.email || 'this user'} for posting and messaging?`,
                () => setUserFields(item.id, { status: 'approved', zipApproved: true, isDisabled: false, isBanned: false })
              )
            }
          >
            <Feather name="check" size={16} color="#fff" />
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton]}
            onPress={() =>
              confirmAction(
                'Reject user',
                `Reject ${item.email || 'this user'}? They will be blocked from posting and messaging.`,
                () => setUserFields(item.id, { status: 'rejected', zipApproved: false })
              )
            }
          >
            <Feather name="x" size={16} color="#fff" />
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, item.isDisabled ? styles.enableButton : styles.disableButton]}
            onPress={() =>
              confirmAction(
                item.isDisabled ? 'Enable account' : 'Disable account',
                `${item.isDisabled ? 'Enable' : 'Disable'} ${item.email || 'this user'}?`,
                () => setUserFields(item.id, { isDisabled: !item.isDisabled })
              )
            }
          >
            <Feather name={item.isDisabled ? 'unlock' : 'lock'} size={16} color="#fff" />
            <Text style={styles.buttonText}>{item.isDisabled ? 'Enable' : 'Disable'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, item.isBanned ? styles.enableButton : styles.banButton]}
            onPress={() =>
              item.isBanned
                ? confirmAction(
                    'Unban account',
                    `Unban ${item.email || 'this user'}?`,
                    () => setUserFields(item.id, { isBanned: false, banReason: null, bannedAt: null, bannedBy: null })
                  )
                : openBanModal(item)
            }
          >
            <Feather name={item.isBanned ? 'user-check' : 'user-x'} size={16} color="#fff" />
            <Text style={styles.buttonText}>{item.isBanned ? 'Unban' : 'Ban'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, item.isSuspended ? styles.enableButton : styles.suspendButton]}
            onPress={() =>
              item.isSuspended
                ? confirmAction(
                    'Unsuspend account',
                    `Unsuspend ${item.email || 'this user'}?`,
                    () => unsuspendUser(item.id)
                  )
                : openSuspendModal(item)
            }
          >
            <Feather name={item.isSuspended ? 'play' : 'pause'} size={16} color="#fff" />
            <Text style={styles.buttonText}>{item.isSuspended ? 'Unsuspend' : 'Suspend'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, item.accountType === 'business' ? styles.accountToUserButton : styles.accountToBusinessButton]}
            onPress={() => toggleAccountType(item)}
          >
            <Feather name="briefcase" size={16} color="#fff" />
            <Text style={styles.buttonText}>{item.accountType === 'business' ? 'Set User' : 'Set Business'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (checkingAuth) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.loadingText}>Checking authorization...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centerContent}>
        <Feather name="lock" size={64} color="#F44336" />
        <Text style={styles.unauthorizedText}>Access Denied</Text>
        <Text style={styles.unauthorizedSubtext}>You do not have admin access.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({pendingUsers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'flagged' && styles.activeTab]}
          onPress={() => setActiveTab('flagged')}
        >
          <Text style={[styles.tabText, activeTab === 'flagged' && styles.activeTabText]}>
            Flagged ({flaggedUsers.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({users.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, ZIP, business"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        <View style={styles.typeFilterRow}>
          <TouchableOpacity
            style={[styles.typeFilterChip, accountTypeFilter === 'all' && styles.typeFilterChipActive]}
            onPress={() => setAccountTypeFilter('all')}
          >
            <Text style={[styles.typeFilterText, accountTypeFilter === 'all' && styles.typeFilterTextActive]}>All Types</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeFilterChip, accountTypeFilter === 'user' && styles.typeFilterChipActive]}
            onPress={() => setAccountTypeFilter('user')}
          >
            <Text style={[styles.typeFilterText, accountTypeFilter === 'user' && styles.typeFilterTextActive]}>Users</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeFilterChip, accountTypeFilter === 'business' && styles.typeFilterChipActive]}
            onPress={() => setAccountTypeFilter('business')}
          >
            <Text style={[styles.typeFilterText, accountTypeFilter === 'business' && styles.typeFilterTextActive]}>Businesses</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.filterSummary}>Showing {displayUsers.length} of {tabUsers.length}</Text>
      </View>

      <FlatList
        data={displayUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>Try changing the filters or search text.</Text>
          </View>
        }
      />

      <Modal
        visible={banModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ban account</Text>
            <Text style={styles.modalText}>
              Enter a reason for banning {banTarget?.email || 'this user'}.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for ban"
              value={banReason}
              onChangeText={setBanReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBanModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={submitBan}>
                <Text style={styles.modalConfirmText}>Ban user</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={suspendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuspendModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Suspend account</Text>
            <Text style={styles.modalText}>
              Enter a reason for suspending {suspendTarget?.email || 'this user'}.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for suspension"
              value={suspendReason}
              onChangeText={setSuspendReason}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.modalLabel}>Duration (days):</Text>
            <View style={styles.durationOptions}>
              {['1', '3', '7', '14', '30'].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.durationButton,
                    suspendDuration === days && styles.durationButtonActive,
                  ]}
                  onPress={() => setSuspendDuration(days)}
                >
                  <Text
                    style={[
                      styles.durationButtonText,
                      suspendDuration === days && styles.durationButtonTextActive,
                    ]}
                  >
                    {days}d
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setSuspendModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={submitSuspend}>
                <Text style={styles.modalConfirmText}>Suspend user</Text>
              </TouchableOpacity>
            </View>
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6A1B9A',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#6A1B9A',
    fontWeight: '700',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  filterBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  typeFilterChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  typeFilterChipActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  typeFilterText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  typeFilterTextActive: {
    color: '#fff',
  },
  filterSummary: {
    marginTop: 8,
    fontSize: 12,
    color: '#777',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
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
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 13,
    color: '#666',
  },
  meta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#E53935',
  },
  disableButton: {
    backgroundColor: '#FF9800',
  },
  enableButton: {
    backgroundColor: '#2E7D32',
  },
  banButton: {
    backgroundColor: '#6A1B9A',
  },
  suspendButton: {
    backgroundColor: '#FF9800',
  },
  accountToBusinessButton: {
    backgroundColor: '#1565C0',
  },
  accountToUserButton: {
    backgroundColor: '#455A64',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  durationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    gap: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: '#6A1B9A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  durationButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  durationButtonActive: {
    backgroundColor: '#6A1B9A',
    borderColor: '#6A1B9A',
  },
  durationButtonText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  durationButtonTextActive: {
    color: '#fff',
  },
});
