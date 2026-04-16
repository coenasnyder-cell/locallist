import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onNavigateToPendingUsers: () => void;
  onNavigateToPendingBusinesses: () => void;
  onNavigateToPendingListings: () => void;
  onNavigateToReports: () => void;
};

export default function AdminMobileActionCenter({
  onNavigateToPendingUsers,
  onNavigateToPendingBusinesses,
  onNavigateToPendingListings,
  onNavigateToReports,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Admin Action Center</Text>

      <TouchableOpacity style={styles.card} onPress={onNavigateToPendingUsers} activeOpacity={0.8}>
        <Feather name="users" size={22} color="#0ea5e9" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Pending Users</Text>
          <Text style={styles.cardSubtitle}>Review and approve new user registrations</Text>
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

      <TouchableOpacity style={styles.card} onPress={onNavigateToReports} activeOpacity={0.8}>
        <Feather name="flag" size={22} color="#ef4444" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Reports</Text>
          <Text style={styles.cardSubtitle}>View and manage reported content</Text>
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
});
