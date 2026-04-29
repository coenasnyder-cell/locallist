import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AdminAllReports from '../../components/AdminAllReports';
import AdminAnalytics from '../../components/AdminAnalytics';
import AdminFeaturePurchases from '../../components/AdminFeaturePurchases';
import AdminListings from '../../components/AdminListings';
import AdminMobileActionCenter from '../../components/AdminMobileActionCenter';
import AdminPendingApprovals from '../../components/AdminPendingApprovals';
import AdminPendingBusinesses from '../../components/AdminPendingBusinesses';
import AdminReportedListings from '../../components/AdminReportedListings';
import AdminReportedMessages from '../../components/AdminReportedMessages';
import AdminSafetyModeration from '../../components/AdminSafetyModeration';
import AdminSiteSettings from '../../components/AdminSiteSettings';
import AdminUsersList from '../../components/AdminUsersList';
import { useAdminStatus } from '../../hooks/useAdminStatus';

// Clean admin panel without test email functionality

export default function AdminTabScreen() {
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus();
  const [currentPage, setCurrentPage] = useState<
    'dashboard'
    | 'analytics'
    | 'pending-users'
    | 'users'
    | 'pending-businesses'
    | 'safety-moderation'
    | 'pending-listings'
    | 'feature-purchases'
    | 'reported-messages'
    | 'reported-listings'
    | 'pending-reports'
    | 'site-settings'
  >('dashboard');

  const handleNavigateToAnalytics = () => {
    setCurrentPage('analytics');
  };

  const handleNavigateToPendingUsers = () => {
    setCurrentPage('pending-users');
  };

  const handleNavigateToUsers = () => {
    setCurrentPage('users');
  };

  const handleNavigateToPendingBusinesses = () => {
    setCurrentPage('pending-businesses');
  };

  const handleNavigateToPendingListings = () => {
    setCurrentPage('pending-listings');
  };

  const handleNavigateToSafetyModeration = () => {
    setCurrentPage('safety-moderation');
  };

  const handleNavigateToFeaturePurchases = () => {
    setCurrentPage('feature-purchases');
  };

  const handleNavigateToReportedMessages = () => {
    setCurrentPage('reported-messages');
  };

  const handleNavigateToReportedListings = () => {
    setCurrentPage('reported-listings');
  };

  const handleNavigateToReports = () => {
    setCurrentPage('pending-reports');
  };

  const handleNavigateToSiteSettings = () => {
    setCurrentPage('site-settings');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const getTitle = () => {
    switch (currentPage) {
      case 'analytics':
        return 'Analytics';
      case 'pending-users':
        return 'Pending Users';
      case 'users':
        return 'User Management';
      case 'pending-businesses':
        return 'Pending Businesses';
      case 'safety-moderation':
        return 'Safety Moderation';
      case 'pending-listings':
        return 'AI Flagged Listings';
      case 'feature-purchases':
        return 'Featured Purchases';
      case 'reported-messages':
        return 'Reported Messages';
      case 'reported-listings':
        return 'Reported Listings';
      case 'pending-reports':
        return 'All Reports';
      case 'site-settings':
        return 'Site Settings';
      default:
        return 'Admin Action Center';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('../(tabs)/profilebutton')}>
          <Feather name="arrow-left" size={18} color="#fff" />
          <Text style={styles.backBtnText}>Back to Profile</Text>
        </TouchableOpacity>
        {currentPage !== 'dashboard' ? (
          <TouchableOpacity style={styles.subBackBtn} onPress={handleBackToDashboard}>
            <Text style={styles.subBackBtnText}>Dashboard</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.title}>{getTitle()}</Text>

      <View style={styles.contentWrap}>
        {loading ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Checking authorization...</Text>
            <Text style={styles.stateBody}>Verifying your admin access.</Text>
          </View>
        ) : !isAdmin ? (
          <View style={styles.stateCard}>
            <Feather name="lock" size={28} color="#dc2626" />
            <Text style={styles.stateTitle}>Access Denied</Text>
            <Text style={styles.stateBody}>This panel is available to admin accounts only.</Text>
          </View>
        ) : currentPage === 'dashboard' ? (
          <AdminMobileActionCenter
            onNavigateToAnalytics={handleNavigateToAnalytics}
            onNavigateToPendingUsers={handleNavigateToPendingUsers}
            onNavigateToUsers={handleNavigateToUsers}
            onNavigateToPendingBusinesses={handleNavigateToPendingBusinesses}
            onNavigateToSafetyModeration={handleNavigateToSafetyModeration}
            onNavigateToFeaturePurchases={handleNavigateToFeaturePurchases}
            onNavigateToReportedMessages={handleNavigateToReportedMessages}
            onNavigateToReportedListings={handleNavigateToReportedListings}
            onNavigateToReports={handleNavigateToReports}
            onNavigateToSiteSettings={handleNavigateToSiteSettings}
          />
        ) : currentPage === 'analytics' ? (
          <AdminAnalytics />
        ) : currentPage === 'pending-users' ? (
          <AdminPendingApprovals />
        ) : currentPage === 'users' ? (
          <AdminUsersList />
        ) : currentPage === 'pending-businesses' ? (
          <AdminPendingBusinesses />
        ) : currentPage === 'safety-moderation' ? (
          <AdminSafetyModeration
            onNavigateToAiFlaggedListings={handleNavigateToPendingListings}
            onNavigateToReportedListings={handleNavigateToReportedListings}
          />
        ) : currentPage === 'feature-purchases' ? (
          <AdminFeaturePurchases />
        ) : currentPage === 'reported-messages' ? (
          <AdminReportedMessages />
        ) : currentPage === 'reported-listings' ? (
          <AdminReportedListings />
        ) : currentPage === 'pending-reports' ? (
          <AdminAllReports />
        ) : currentPage === 'site-settings' ? (
          <AdminSiteSettings />
        ) : (
          <AdminListings />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  subBackBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  subBackBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  contentWrap: {
    flex: 1,
  },
  stateCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  stateBody: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
