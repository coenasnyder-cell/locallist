import { collection, collectionGroup, getCountFromServer, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { app } from '../firebase';

type ZipCount = { zip: string; count: number };

type SummaryStats = {
  totalUsers: number;
  pendingUsers: number;
  totalListings: number;
  totalMessages: number;
  totalReportedMessages: number;
  pendingMessageReports: number;
  totalReportedListings: number;
  pendingListingReports: number;
};

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SummaryStats>({
    totalUsers: 0,
    pendingUsers: 0,
    totalListings: 0,
    totalMessages: 0,
    totalReportedMessages: 0,
    pendingMessageReports: 0,
    totalReportedListings: 0,
    pendingListingReports: 0,
  });
  const [zipCounts, setZipCounts] = useState<ZipCount[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const db = getFirestore(app);

        const usersCol = collection(db, 'users');
        const pendingApprovalsCol = collection(db, 'pendingApprovals');
        const listingsCol = collection(db, 'listings');
        const messagesCol = collectionGroup(db, 'messages');
        const reportedMessagesCol = collection(db, 'reportedMessages');
        const reportedListingsCol = collection(db, 'reportedListings');
        const pendingMessageReportsQuery = query(reportedMessagesCol, where('status', '==', 'pending'));
        const pendingListingReportsQuery = query(reportedListingsCol, where('status', '==', 'pending'));

        const [usersSnap, pendingSnap, listingsSnap, messagesSnap, reportedMessagesSnap, reportedListingsSnap, pendingMessageReportsSnap, pendingListingReportsSnap] = await Promise.all([
          getCountFromServer(usersCol),
          getCountFromServer(pendingApprovalsCol),
          getCountFromServer(listingsCol),
          getCountFromServer(messagesCol),
          getCountFromServer(reportedMessagesCol),
          getCountFromServer(reportedListingsCol),
          getCountFromServer(pendingMessageReportsQuery),
          getCountFromServer(pendingListingReportsQuery),
        ]);

        if (!isMounted) return;

        setStats({
          totalUsers: usersSnap.data().count,
          pendingUsers: pendingSnap.data().count,
          totalListings: listingsSnap.data().count,
          totalMessages: messagesSnap.data().count,
          totalReportedMessages: reportedMessagesSnap.data().count,
          pendingMessageReports: pendingMessageReportsSnap.data().count,
          totalReportedListings: reportedListingsSnap.data().count,
          pendingListingReports: pendingListingReportsSnap.data().count,
        });

        const approvedUsersQuery = query(usersCol, where('status', '==', 'approved'));
        const approvedUsers = await getDocs(approvedUsersQuery);
        const zipMap: Record<string, number> = {};

        approvedUsers.forEach((docSnap) => {
          const data = docSnap.data() as { zipCode?: string };
          if (!data.zipCode) return;
          zipMap[data.zipCode] = (zipMap[data.zipCode] || 0) + 1;
        });

        const list = Object.entries(zipMap)
          .map(([zip, count]) => ({ zip, count }))
          .sort((a, b) => b.count - a.count);

        setZipCounts(list);
      } catch (error) {
        console.error('Admin analytics load error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const hasZips = useMemo(() => zipCounts.length > 0, [zipCounts.length]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.performanceSection}>
        <Text style={styles.performanceTitle}>Performance Analytics</Text>
        <Text style={styles.performanceSubtitle}>System-wide metrics and key statistics.</Text>
        
        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Total Users</Text>
            <Text style={styles.performanceValue}>{stats.totalUsers}</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Pending Users</Text>
            <Text style={styles.performanceValue}>{stats.pendingUsers}</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Total Listings</Text>
            <Text style={styles.performanceValue}>{stats.totalListings}</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Total Messages</Text>
            <Text style={styles.performanceValue}>{stats.totalMessages}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Metrics</Text>
        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Users</Text>
            <Text style={styles.cardValue}>{stats.totalUsers}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending Users</Text>
            <Text style={styles.cardValue}>{stats.pendingUsers}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Listings</Text>
            <Text style={styles.cardValue}>{stats.totalListings}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Messages</Text>
            <Text style={styles.cardValue}>{stats.totalMessages}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reported Messages</Text>
            <Text style={styles.cardValue}>{stats.totalReportedMessages}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending Message Reports</Text>
            <Text style={styles.cardValue}>{stats.pendingMessageReports}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Reported Listings</Text>
            <Text style={styles.cardValue}>{stats.totalReportedListings}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pending Listing Reports</Text>
            <Text style={styles.cardValue}>{stats.pendingListingReports}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zip Code Distribution (Approved Users)</Text>
        {!hasZips && <Text style={styles.emptyText}>No approved users yet.</Text>}
        {zipCounts.map((item) => (
          <View key={item.zip} style={styles.row}>
            <Text style={styles.rowLabel}>{item.zip}</Text>
            <Text style={styles.rowValue}>{item.count}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  performanceSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  performanceSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  performanceCard: {
    width: '48%',
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
    padding: 10,
  },
  performanceLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 14,
  },
  cardLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowLabel: {
    color: '#333',
    fontSize: 13,
  },
  rowValue: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#777',
    fontSize: 13,
    paddingVertical: 6,
  },
  reportGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  reportCard: {
    flex: 1,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  reportCardLabel: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 6,
  },
  reportCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6F00',
    marginBottom: 4,
  },
  reportCardSubtitle: {
    fontSize: 11,
    color: '#BF360C',
  },
});
