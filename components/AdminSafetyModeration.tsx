import { Feather } from '@expo/vector-icons';
import { collection, getCountFromServer, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

type Props = {
  onNavigateToAiFlaggedListings: () => void;
  onNavigateToReportedListings: () => void;
};

type ModerationCounts = {
  aiFlaggedListings: number;
  reportedListings: number;
};

export default function AdminSafetyModeration({
  onNavigateToAiFlaggedListings,
  onNavigateToReportedListings,
}: Props) {
  const [counts, setCounts] = useState<ModerationCounts | null>(null);

  useEffect(() => {
    const db = getFirestore(app);

    const loadCounts = async () => {
      try {
        const [aiFlaggedSnap, reportedListingsSnap] = await Promise.all([
          getCountFromServer(
            query(collection(db, 'listings'), where('status', '==', 'pending_review'))
          ),
          getCountFromServer(
            query(collection(db, 'reportedListings'), where('status', '==', 'pending'))
          ),
        ]);

        setCounts({
          aiFlaggedListings: aiFlaggedSnap.data().count,
          reportedListings: reportedListingsSnap.data().count,
        });
      } catch (error) {
        console.error('Error loading safety moderation counts:', error);
        setCounts({
          aiFlaggedListings: 0,
          reportedListings: 0,
        });
      }
    };

    loadCounts();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Safety Moderation</Text>
        <Text style={styles.heroTitle}>Review AI flags before listings go live.</Text>
        <Text style={styles.heroBody}>
          Keep pre-publication moderation separate from community reports so admins can move faster.
        </Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={onNavigateToAiFlaggedListings} activeOpacity={0.85}>
        <View style={[styles.iconWrap, styles.aiIconWrap]}>
          <Feather name="shield" size={20} color="#b91c1c" />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>AI Flagged Listings</Text>
          <Text style={styles.cardSubtitle}>High, medium, and low risk listings waiting for admin review.</Text>
        </View>
        <View style={styles.trailingWrap}>
          {counts ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{counts.aiFlaggedListings}</Text>
            </View>
          ) : (
            <ActivityIndicator size="small" color="#64748b" />
          )}
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={onNavigateToReportedListings} activeOpacity={0.85}>
        <View style={[styles.iconWrap, styles.reportedIconWrap]}>
          <Feather name="flag" size={20} color="#c2410c" />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>Reported Listings</Text>
          <Text style={styles.cardSubtitle}>Community-submitted listing reports that need follow-up.</Text>
        </View>
        <View style={styles.trailingWrap}>
          {counts ? (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{counts.reportedListings}</Text>
            </View>
          ) : (
            <ActivityIndicator size="small" color="#64748b" />
          )}
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 16,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#b91c1c',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiIconWrap: {
    backgroundColor: '#fee2e2',
  },
  reportedIconWrap: {
    backgroundColor: '#ffedd5',
  },
  cardCopy: {
    flex: 1,
    marginLeft: 14,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 17,
  },
  trailingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
  },
  countText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
