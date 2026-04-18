import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AdminAllReports from '../../components/AdminAllReports';
import AdminListings from '../../components/AdminListings';
import AdminMobileActionCenter from '../../components/AdminMobileActionCenter';
import AdminPendingApprovals from '../../components/AdminPendingApprovals';
import AdminPendingBusinesses from '../../components/AdminPendingBusinesses';

const testEmailFunction = async (emailType: string) => {
  try {
    const functions = getFunctions();
    const sendTestEmail = httpsCallable(functions, 'sendTestEmail');

    const result = await sendTestEmail({
      emailType,
      recipientEmail: 'coena@locallist.biz' // Replace with your email
    });

    Alert.alert('Success', `Test ${emailType} email sent! Check your inbox.`);
    console.log('Email sent:', result.data);
  } catch (error: any) {
    Alert.alert('Error', `Failed to send ${emailType} email: ${error.message}`);
    console.error('Error:', error);
  }
};

export default function AdminTabScreen() {
  const router = useRouter();
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
        {currentPage === 'dashboard' ? (
          <View>
            <AdminMobileActionCenter
              onNavigateToPendingUsers={handleNavigateToPendingUsers}
              onNavigateToPendingBusinesses={handleNavigateToPendingBusinesses}
              onNavigateToPendingListings={handleNavigateToPendingListings}
              onNavigateToReports={handleNavigateToReports}
            />

            {/* Test Email Buttons */}
            <View style={styles.testEmailSection}>
              <Text style={styles.testEmailTitle}>Test Email Templates</Text>
              <View style={styles.testEmailButtons}>
                <TouchableOpacity
                  style={styles.testEmailBtn}
                  onPress={() => testEmailFunction('welcome')}
                >
                  <Text style={styles.testEmailBtnText}>Test Welcome Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.testEmailBtn}
                  onPress={() => testEmailFunction('premium')}
                >
                  <Text style={styles.testEmailBtnText}>Test Premium Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.testEmailBtn}
                  onPress={() => testEmailFunction('featured')}
                >
                  <Text style={styles.testEmailBtnText}>Test Featured Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.testEmailBtn}
                  onPress={() => testEmailFunction('message')}
                >
                  <Text style={styles.testEmailBtnText}>Test Message Email</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  testEmailSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  testEmailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  testEmailButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testEmailBtn: {
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 120,
  },
  testEmailBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});