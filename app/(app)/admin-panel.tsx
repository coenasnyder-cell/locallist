import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AdminAllReports from '../../components/AdminAllReports';
import AdminListings from '../../components/AdminListings';
import AdminMobileActionCenter from '../../components/AdminMobileActionCenter';
import AdminPendingApprovals from '../../components/AdminPendingApprovals';
import AdminPendingBusinesses from '../../components/AdminPendingBusinesses';
import { useAdminStatus } from '../../hooks/useAdminStatus';

// Clean admin panel without test email functionality

export default function AdminTabScreen() {
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'pending-users' | 'pending-businesses' | 'pending-listings' | 'pending-reports'>('dashboard');

  const handleNavigateToPendingUsers = () => {
    setCurrentPage('pending-users');
  };

  const handleNavigateToPendingBusinesses = () => {
    setCurrentPage('pending-businesses');
  };

  const handleNavigateToPendingListings = () => {
    setCurrentPage('pending-listings');
  };

  const handleNavigateToReports = () => {
    setCurrentPage('pending-reports');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  const getTitle = () => {
    switch (currentPage) {
      case 'pending-users':
        return 'Pending Users';
      case 'pending-businesses':
        return 'Pending Businesses';
      case 'pending-listings':
        return 'Pending Listings';
      case 'pending-reports':
        return 'All Reports';
      default:
        return 'Admin Action Center';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(tabs)/profilebutton')}>
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
          <View>
            <AdminMobileActionCenter
              onNavigateToPendingUsers={handleNavigateToPendingUsers}
              onNavigateToPendingBusinesses={handleNavigateToPendingBusinesses}
              onNavigateToPendingListings={handleNavigateToPendingListings}
              onNavigateToReports={handleNavigateToReports}
            />
          </View>
        ) : currentPage === 'pending-users' ? (
          <AdminPendingApprovals />
        ) : currentPage === 'pending-businesses' ? (
          <AdminPendingBusinesses />
        ) : currentPage === 'pending-reports' ? (
          <AdminAllReports />
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
