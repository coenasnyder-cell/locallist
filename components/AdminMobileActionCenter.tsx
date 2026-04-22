import { Feather } from '@expo/vector-icons';
import { collection, getCountFromServer, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

type Props = {
  onNavigateToAnalytics: () => void;
  onNavigateToPendingUsers: () => void;
  onNavigateToUsers: () => void;
  onNavigateToPendingBusinesses: () => void;
  onNavigateToPendingListings: () => void;
  onNavigateToFeaturePurchases: () => void;
  onNavigateToReportedMessages: () => void;
  onNavigateToReportedListings: () => void;
  onNavigateToReports: () => void;
  onNavigateToSiteSettings: () => void;
};

export default function AdminMobileActionCenter({
  onNavigateToAnalytics,
  onNavigateToPendingUsers,
  onNavigateToUsers,
  onNavigateToPendingBusinesses,
  onNavigateToPendingListings,
  onNavigateToFeaturePurchases,
  onNavigateToReportedMessages,
  onNavigateToReportedListings,
  onNavigateToReports,
  onNavigateToSiteSettings,
}: Props) {
  const [stats, setStats] = useState<{ users: number; listings: number; businesses: number; services: number } | null>(null);

  useEffect(() => {
    const db = getFirestore(app);
    const fetchStats = async () => {
      try {
        const [usersSnap, listingsSnap, businessSnap, servicesSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'listings')),
          getCountFromServer(query(collection(db, 'users'), where('accountType', '==', 'business'))),
          getCountFromServer(collection(db, 'services')),
        ]);
        setStats({
          users: usersSnap.data().count,
          listings: listingsSnap.data().count,
          businesses: businessSnap.data().count,
          services: servicesSnap.data().count,
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
        setStats({ users: 0, listings: 0, businesses: 0, services: 0 });
      }
    };
    fetchStats();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Admin Action Center</Text>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        {stats ? (
          <>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.users}</Text>
              <Text style={styles.statLabel}>Users</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.listings}</Text>
              <Text style={styles.statLabel}>Listings</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.businesses}</Text>
              <Text style={styles.statLabel}>Businesses</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.services}</Text>
              <Text style={styles.statLabel}>Services</Text>
            </View>
          </>
        ) : (
          <View style={styles.statCard}>
            <ActivityIndicator size="small" color="#64748b" />
            <Text style={styles.statLabel}>Loading...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.card} onPress={onNavigateToAnalytics} activeOpacity={0.8}>
        <Feather name="bar-chart-2" size={22} color="#2563eb" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Analytics</Text>
          <Text style={styles.cardSubtitle}>Review user, listing, and report metrics</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* Always show navigation cards */}
      <TouchableOpacity style={styles.card} onPress={onNavigateToPendingUsers} activeOpacity={0.8}>
        <Feather name="users" size={22} color="#0ea5e9" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Pending Users</Text>
          <Text style={styles.cardSubtitle}>Review and approve new user registrations</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToUsers} activeOpacity={0.8}>
        <Feather name="user-check" size={22} color="#1d4ed8" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>User Management</Text>
          <Text style={styles.cardSubtitle}>Search, disable, ban, suspend, and convert accounts</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToPendingBusinesses} activeOpacity={0.8}>
        <Feather name="briefcase" size={22} color="#8b5cf6" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Pending Businesses</Text>
          <Text style={styles.cardSubtitle}>Approve or reject business applications</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToPendingListings} activeOpacity={0.8}>
        <Feather name="list" size={22} color="#f59e0b" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Pending Listings</Text>
          <Text style={styles.cardSubtitle}>Review listings awaiting approval</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToFeaturePurchases} activeOpacity={0.8}>
        <Feather name="credit-card" size={22} color="#f59e0b" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Featured Purchases</Text>
          <Text style={styles.cardSubtitle}>Review and verify featured listing purchase records</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToReportedMessages} activeOpacity={0.8}>
        <Feather name="message-square" size={22} color="#7c3aed" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Reported Messages</Text>
          <Text style={styles.cardSubtitle}>Review flagged chat messages from users</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToReportedListings} activeOpacity={0.8}>
        <Feather name="image" size={22} color="#ea580c" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Reported Listings</Text>
          <Text style={styles.cardSubtitle}>Review flagged listings and listing details</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToReports} activeOpacity={0.8}>
        <Feather name="flag" size={22} color="#ef4444" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>All Reports</Text>
          <Text style={styles.cardSubtitle}>Open the combined report queue across all sources</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToSiteSettings} activeOpacity={0.8}>
        <Feather name="settings" size={22} color="#334155" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Site Settings</Text>
          <Text style={styles.cardSubtitle}>Update the quote and other shared display content</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardText: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
});
