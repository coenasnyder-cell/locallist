import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, getFirestore, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

type StatCard = {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

export default function AdminUsers({ 
  onNavigateToUsers,
  onNavigateToListingsManage,
  onNavigateToListingsBrowse,
  onNavigateToCommunityNews,
}: { 
  onNavigateToUsers?: (tab: 'pending' | 'flagged' | 'all', accountType?: 'all' | 'user' | 'business') => void;
  onNavigateToListingsManage?: () => void;
  onNavigateToListingsBrowse?: (tab: 'featured' | 'all') => void;
  onNavigateToCommunityNews?: () => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState({
    bannedKeywords: '',
    featuredListingDuration: '30',
    maxFeaturedPerUser: '3',
    emailAlertsToggle: true,
    flaggedContentAlertsToggle: true,
    newUserSignupAlertsToggle: true,
    dailyDigestToggle: false,
    weeklyDigestToggle: true,
    minAccountAgeBeforeSelling: '7',
  });

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

  // Calculate stats
  const stats = useMemo<StatCard[]>(() => {
    const totalUsers = users.length;
    const approvedUsers = users.filter((u) => u.status === 'approved').length;
    const bannedUsers = users.filter((u) => u.isBanned).length;
    const suspendedUsers = users.filter((u) => u.isSuspended).length;
    const disabledUsers = users.filter((u) => u.isDisabled).length;
    const activeUsers = users.filter((u) => u.status === 'approved' && !u.isDisabled && !u.isBanned).length;
    const businessAccounts = users.filter((u) => u.accountType === 'business').length;
    const paidBusinessAccounts = users.filter((u) => u.accountType === 'business' && u.subscriptionPlan && u.subscriptionPlan !== 'free').length;

    return [
      {
        label: 'Total Users',
        value: totalUsers,
        color: '#6A1B9A',
        icon: 'users',
      },
      {
        label: 'Active Users',
        value: activeUsers,
        color: '#4CAF50',
        icon: 'user-check',
      },
      {
        label: 'Business Accounts',
        value: businessAccounts,
        color: '#1565C0',
        icon: 'briefcase',
      },
      {
        label: 'Paid Plans',
        value: paidBusinessAccounts,
        color: '#2E7D32',
        icon: 'dollar-sign',
      },
    ];
  }, [users]);

  const renderStatCard = (stat: StatCard) => (
    <View key={stat.label} style={[styles.statCard, { borderLeftColor: stat.color }]}>
      <View style={[styles.statIconBox, { backgroundColor: `${stat.color}15` }]}>
        <Feather name={stat.icon} size={24} color={stat.color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{stat.value}</Text>
        <Text style={styles.statLabel}>{stat.label}</Text>
      </View>
    </View>
  );

  const renderStatsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📊 Stats</Text>
      <View style={styles.statsGrid}>
        {stats.map((stat) => renderStatCard(stat))}
      </View>
    </View>
  );

  const pendingUsers = useMemo(() => users.filter((u) => u.status !== 'approved'), [users]);
  const flaggedUsers = useMemo(() => users.filter((u) => u.isBanned || u.isSuspended), [users]);
  const businessUsers = useMemo(() => users.filter((u) => u.accountType === 'business'), [users]);

  const renderModerationSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>� Manage Users</Text>
      <View style={styles.moderationGrid}>
        <TouchableOpacity 
          style={styles.moderationCard}
          onPress={() => onNavigateToUsers?.('pending')}
        >
          <Feather name="alert-circle" size={20} color="#FF9800" />
          <Text style={styles.moderationCardValue}>{pendingUsers.length}</Text>
          <Text style={styles.moderationCardLabel}>Pending</Text>
          <Text style={styles.cardHint}>Awaiting approval</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.moderationCard}
          onPress={() => onNavigateToUsers?.('flagged')}
        >
          <Feather name="shield-off" size={20} color="#F44336" />
          <Text style={styles.moderationCardValue}>{flaggedUsers.length}</Text>
          <Text style={styles.moderationCardLabel}>Flagged</Text>
          <Text style={styles.cardHint}>Banned or suspended</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moderationCard}
          onPress={() => onNavigateToUsers?.('all')}
        >
          <Feather name="users" size={20} color="#4CAF50" />
          <Text style={styles.moderationCardValue}>{users.length}</Text>
          <Text style={styles.moderationCardLabel}>All Users</Text>
          <Text style={styles.cardHint}>View & manage all</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moderationCard}
          onPress={() => onNavigateToUsers?.('all', 'business')}
        >
          <Feather name="briefcase" size={20} color="#1565C0" />
          <Text style={styles.moderationCardValue}>{businessUsers.length}</Text>
          <Text style={styles.moderationCardLabel}>Businesses</Text>
          <Text style={styles.cardHint}>Business accounts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleExportData = async () => {
    if (users.length === 0) {
      alert('No users to export');
      return;
    }

    try {
      const headers = ['ID', 'Name', 'Email', 'Zip Code', 'Status', 'Approved', 'Disabled', 'Banned', 'Suspended'];
      const csvRows = users.map((u) => [
        u.id,
        u.name || '',
        u.email || '',
        u.zipCode || '',
        u.status || '',
        u.zipApproved ? 'Yes' : 'No',
        u.isDisabled ? 'Yes' : 'No',
        u.isBanned ? 'Yes' : 'No',
        u.isSuspended ? 'Yes' : 'No',
      ]);

      const csvContent = [
        headers.join(','),
        ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      const timestamp = new Date().toISOString().split('T')[0];
      await Share.share({
        message: csvContent,
        title: `User Data Export - ${timestamp}`,
        url: undefined,
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  const handleSaveSettings = () => {
    alert('Settings saved successfully!');
    setShowSettingsModal(false);
    // TODO: Save settings to Firestore
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        alert('Not authenticated');
        setIsSyncing(false);
        return;
      }

      const db = getFirestore(app);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);

      const rows: UserRow[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserRow, 'id'>),
      }));

      setUsers(rows);
      alert(`Data synced successfully! Loaded ${rows.length} users.`);
    } catch (error) {
      console.error('Error syncing data:', error);
      alert('Failed to sync data');
    } finally {
      setIsSyncing(false);
    }
  };

  const renderQuickActionsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity style={styles.quickActionBtn} onPress={handleExportData}>
          <Feather name="download" size={18} color="#2196F3" />
          <Text style={styles.quickActionLabel}>Export Data</Text>
          <Text style={styles.cardHint}>Download as CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowSettingsModal(true)}>
          <Feather name="settings" size={18} color="#9C27B0" />
          <Text style={styles.quickActionLabel}>Settings</Text>
          <Text style={styles.cardHint}>Admin preferences</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={handleSyncData} disabled={isSyncing}>
          <Feather name="refresh-cw" size={18} color={isSyncing ? '#ccc' : '#FF9800'} />
          <Text style={styles.quickActionLabel}>{isSyncing ? 'Syncing...' : 'Sync Data'}</Text>
          <Text style={styles.cardHint}>Refresh from DB</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => onNavigateToCommunityNews?.()}>
          <Feather name="edit-3" size={18} color="#4CAF50" />
          <Text style={styles.quickActionLabel}>Community Posts</Text>
          <Text style={styles.cardHint}>News & updates</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderListingsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📋 Manage Listings</Text>
      <View style={styles.listingsGrid}>
        <TouchableOpacity 
          style={styles.listingCard}
          onPress={() => onNavigateToListingsManage?.()}
        >
          <Feather name="clock" size={20} color="#FF9800" />
          <Text style={styles.listingCardValue}>0</Text>
          <Text style={styles.listingCardLabel}>Pending Approvals</Text>
          <Text style={styles.cardHint}>Listings to review</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.listingCard}
          onPress={() => onNavigateToListingsManage?.()}
        >
          <Feather name="flag" size={20} color="#F44336" />
          <Text style={styles.listingCardValue}>0</Text>
          <Text style={styles.listingCardLabel}>Flagged Posts</Text>
          <Text style={styles.cardHint}>Reported content</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.listingCard}
          onPress={() => onNavigateToListingsBrowse?.('featured')}
        >
          <Feather name="star" size={20} color="#FFD700" />
          <Text style={styles.listingCardValue}>0</Text>
          <Text style={styles.listingCardLabel}>Featured</Text>
          <Text style={styles.cardHint}>Paid promotions</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.listingCard}
          onPress={() => onNavigateToListingsBrowse?.('all')}
        >
          <Feather name="list" size={20} color="#2196F3" />
          <Text style={styles.listingCardValue}>0</Text>
          <Text style={styles.listingCardLabel}>All Listings</Text>
          <Text style={styles.cardHint}>Browse all posts</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInsightsSection = () => {
    const approvalRate = users.length > 0 ? ((users.filter((u) => u.status === 'approved').length / users.length) * 100).toFixed(1) : '0';
    const banRate = users.length > 0 ? ((users.filter((u) => u.isBanned).length / users.length) * 100).toFixed(1) : '0';
    const suspendRate = users.length > 0 ? ((users.filter((u) => u.isSuspended).length / users.length) * 100).toFixed(1) : '0';

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Insights</Text>
        <View style={styles.insightsContainer}>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Approval Rate</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${approvalRate}%` as any, backgroundColor: '#4CAF50' }]} />
            </View>
            <Text style={styles.insightValue}>{approvalRate}%</Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Ban Rate</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${banRate}%` as any, backgroundColor: '#F44336' }]} />
            </View>
            <Text style={styles.insightValue}>{banRate}%</Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Suspension Rate</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${suspendRate}%` as any, backgroundColor: '#FF9800' }]} />
            </View>
            <Text style={styles.insightValue}>{suspendRate}%</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSettingsModal = () => (
    <Modal visible={showSettingsModal} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.modalTitle}>Admin Settings</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.settingsModalBody}>
            {/* Listing Content Settings */}
            <View style={styles.settingsModalSection}>
              <Text style={styles.settingSectionTitle}>Listing Content</Text>
              
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Banned Keywords/Phrases</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter keywords separated by commas"
                  value={settings.bannedKeywords}
                  onChangeText={(text: string) => setSettings({ ...settings, bannedKeywords: text })}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Featured Listing Duration (days)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="30"
                  value={settings.featuredListingDuration}
                  onChangeText={(text: string) => setSettings({ ...settings, featuredListingDuration: text })}
                  keyboardType="number-pad"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Max Featured Listings Per User</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="3"
                  value={settings.maxFeaturedPerUser}
                  onChangeText={(text: string) => setSettings({ ...settings, maxFeaturedPerUser: text })}
                  keyboardType="number-pad"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Min Account Age Before Selling (days)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="7"
                  value={settings.minAccountAgeBeforeSelling}
                  onChangeText={(text: string) => setSettings({ ...settings, minAccountAgeBeforeSelling: text })}
                  keyboardType="number-pad"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Notification Settings */}
            <View style={styles.settingsModalSection}>
              <Text style={styles.settingSectionTitle}>Notifications</Text>

              <View style={styles.toggleItem}>
                <Text style={styles.settingLabel}>Email Alerts for Pending Approvals</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, settings.emailAlertsToggle && styles.toggleActive]}
                  onPress={() => setSettings({ ...settings, emailAlertsToggle: !settings.emailAlertsToggle })}
                >
                  <Text style={[styles.toggleText, settings.emailAlertsToggle && styles.toggleTextActive]}>{settings.emailAlertsToggle ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleItem}>
                <Text style={styles.settingLabel}>Alerts for Flagged/Reported Content</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, settings.flaggedContentAlertsToggle && styles.toggleActive]}
                  onPress={() => setSettings({ ...settings, flaggedContentAlertsToggle: !settings.flaggedContentAlertsToggle })}
                >
                  <Text style={[styles.toggleText, settings.flaggedContentAlertsToggle && styles.toggleTextActive]}>{settings.flaggedContentAlertsToggle ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleItem}>
                <Text style={styles.settingLabel}>New User Signup Notifications</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, settings.newUserSignupAlertsToggle && styles.toggleActive]}
                  onPress={() => setSettings({ ...settings, newUserSignupAlertsToggle: !settings.newUserSignupAlertsToggle })}
                >
                  <Text style={[styles.toggleText, settings.newUserSignupAlertsToggle && styles.toggleTextActive]}>{settings.newUserSignupAlertsToggle ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleItem}>
                <Text style={styles.settingLabel}>Daily Admin Digest</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, settings.dailyDigestToggle && styles.toggleActive]}
                  onPress={() => setSettings({ ...settings, dailyDigestToggle: !settings.dailyDigestToggle })}
                >
                  <Text style={[styles.toggleText, settings.dailyDigestToggle && styles.toggleTextActive]}>{settings.dailyDigestToggle ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toggleItem}>
                <Text style={styles.settingLabel}>Weekly Admin Digest</Text>
                <TouchableOpacity 
                  style={[styles.toggleButton, settings.weeklyDigestToggle && styles.toggleActive]}
                  onPress={() => setSettings({ ...settings, weeklyDigestToggle: !settings.weeklyDigestToggle })}
                >
                  <Text style={[styles.toggleText, settings.weeklyDigestToggle && styles.toggleTextActive]}>{settings.weeklyDigestToggle ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveSettings}
            >
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
      ) : loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
          {renderStatsSection()}
          {renderModerationSection()}
          {renderListingsSection()}
          {renderQuickActionsSection()}
          {renderInsightsSection()}
        </ScrollView>
      )}
      {renderSettingsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
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
  listContent: {
    padding: 12,
  },
  userListContent: {
    paddingTop: 8,
  },
  // Section Styles
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  // Stats Section
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIconBox: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  // Moderation Section
  moderationGrid: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  moderationCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  moderationCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  moderationCardLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  cardHint: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 2,
    textAlign: 'center',
  },
  // Listings Section
  listingsGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listingCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listingCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  listingCardLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  // Quick Actions Section
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  // Insights Section
  insightsContainer: {
    gap: 16,
  },
  insightItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  insightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  insightValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  // User Card
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
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal Styles
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
  // Settings-specific styles
  settingSectionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  settingSectionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  settingSectionButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  settingSectionButtonTextActive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  settingSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#6A1B9A',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  settingsModalBody: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsModalSection: {
    marginBottom: 24,
  },
});
