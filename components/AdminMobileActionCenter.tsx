import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getFirestore, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type UserRow = {
  status?: string;
};

type ListingRow = {
  status?: string;
  approvalStatus?: string;
  isApproved?: boolean;
};

type BusinessRow = {
  isApproved?: boolean;
  approvalStatus?: string;
};

type ReportRow = {
  status?: string;
};

type AllReportSources = {
  reportedMessages: ReportRow[];
  reportedListings: ReportRow[];
  messageReports: ReportRow[];
  userReports: ReportRow[];
};

type QueueCardProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  title: string;
  count: number;
  hint: string;
  onPress: () => void;
};

type SetupChecklistItemProps = {
  done: boolean;
  title: string;
  detail: string;
  actionLabel: string;
  onPress: () => void;
};

function isPendingListing(item: ListingRow) {
  const status = String(item.status || '').toLowerCase();
  const approvalStatus = String(item.approvalStatus || '').toLowerCase();
  return status === 'pending' || approvalStatus === 'pending' || item.isApproved === false;
}

function isPendingBusiness(item: BusinessRow) {
  const approvalStatus = String(item.approvalStatus || '').toLowerCase();
  return item.isApproved !== true && approvalStatus !== 'rejected' && approvalStatus !== 'deleted';
}

function QueueCard({ icon, color, title, count, hint, onPress }: QueueCardProps) {
  return (
    <TouchableOpacity style={styles.queueCard} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.queueIconWrap, { backgroundColor: `${color}18` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={styles.queueCount}>{count}</Text>
      <Text style={styles.queueTitle}>{title}</Text>
      <Text style={styles.queueHint}>{hint}</Text>
      <View style={styles.queueFooter}>
        <Text style={styles.queueAction}>Review queue</Text>
        <Feather name="chevron-right" size={16} color="#1d4ed8" />
      </View>
    </TouchableOpacity>
  );
}

function SetupChecklistItem({ done, title, detail, actionLabel, onPress }: SetupChecklistItemProps) {
  return (
    <View style={styles.setupItem}>
      <View style={[styles.setupIndicator, done ? styles.setupIndicatorDone : styles.setupIndicatorPending]}>
        <Feather name={done ? 'check' : 'clock'} size={12} color={done ? '#166534' : '#9a3412'} />
      </View>
      <View style={styles.setupTextWrap}>
        <Text style={[styles.setupItemTitle, done && styles.setupItemTitleDone]}>{title}</Text>
        <Text style={styles.setupItemDetail}>{detail}</Text>
      </View>
      <TouchableOpacity style={styles.setupActionBtn} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.setupActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminMobileActionCenter({
  onNavigateToPendingUsers,
  onNavigateToPendingBusinesses,
  onNavigateToPendingListings,
  onNavigateToReports,
}: {
  onNavigateToPendingUsers?: () => void;
  onNavigateToPendingBusinesses?: () => void;
  onNavigateToPendingListings?: () => void;
  onNavigateToReports?: () => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [reportSources] = useState<AllReportSources>({
    reportedMessages: [],
    reportedListings: [],
    messageReports: [],
    userReports: [],
  });
  const [allReports, setAllReports] = useState<ReportRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingState, setLoadingState] = useState({
    users: true,
    listings: true,
    businesses: true,
    reportedMessages: true,
    reportedListings: true,
    messageReports: true,
    userReports: true,
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
    const unsubscribers = [
      onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          setUsers(snapshot.docs.map((docSnap) => docSnap.data() as UserRow));
          setLoadingState((current) => ({ ...current, users: false }));
        },
        (error) => {
          console.error('Snapshot listener error (users):', error);
          setLoadingState((current) => ({ ...current, users: false }));
        }
      ),
      onSnapshot(
        collection(db, 'listings'),
        (snapshot) => {
          setListings(snapshot.docs.map((docSnap) => docSnap.data() as ListingRow));
          setLoadingState((current) => ({ ...current, listings: false }));
        },
        (error) => {
          console.error('Snapshot listener error (listings):', error);
          setLoadingState((current) => ({ ...current, listings: false }));
        }
      ),
      onSnapshot(
        collection(db, 'businessLocal'),
        (snapshot) => {
          setBusinesses(snapshot.docs.map((docSnap) => docSnap.data() as BusinessRow));
          setLoadingState((current) => ({ ...current, businesses: false }));
        },
        (error) => {
          console.error('Snapshot listener error (businessLocal):', error);
          setLoadingState((current) => ({ ...current, businesses: false }));
        }
      ),
      ...(['reportedMessages', 'reportedListings', 'messageReports', 'userReports'] as const).map(
        (source) =>
          onSnapshot(
            collection(db, source),
            (snapshot) => {
              reportSources[source] = snapshot.docs.map((d) => d.data() as ReportRow);
              setAllReports([
                ...reportSources.reportedMessages,
                ...reportSources.reportedListings,
                ...reportSources.messageReports,
                ...reportSources.userReports,
              ]);
              setLoadingState((current) => ({ ...current, [source]: false }));
            },
            () => {
              setLoadingState((current) => ({ ...current, [source]: false }));
            }
          )
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isAdmin]);

  const loading = useMemo(() => Object.values(loadingState).some(Boolean), [loadingState]);

  const pendingUsers = useMemo(
    () => users.filter((user) => String(user.status || '').toLowerCase() !== 'approved').length,
    [users]
  );

  const pendingListings = useMemo(
    () => listings.filter((listing) => isPendingListing(listing)).length,
    [listings]
  );

  const pendingBusinesses = useMemo(
    () => businesses.filter((business) => isPendingBusiness(business)).length,
    [businesses]
  );

  const openReports = useMemo(
    () => allReports.filter((report) => String(report.status || '').toLowerCase() === 'pending').length,
    [allReports]
  );

  const totalQueues = pendingUsers + pendingListings + pendingBusinesses + openReports;

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
        <Feather name="lock" size={64} color="#ef4444" />
        <Text style={styles.unauthorizedText}>Access Denied</Text>
        <Text style={styles.unauthorizedSubtext}>You do not have admin access.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <Text style={styles.loadingText}>Loading operational queues...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Mobile Admin</Text>
        <Text style={styles.heroTitle}>Focus on fast queue decisions.</Text>
        <Text style={styles.heroBody}>
          Keep time-sensitive approvals moving here. Leave sanctions, settings, exports, and deep investigations to the web dashboard.
        </Text>
      </View>

      <View style={styles.snapshotRow}>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotValue}>{totalQueues}</Text>
          <Text style={styles.snapshotLabel}>Items needing attention</Text>
        </View>
        <View style={styles.snapshotCard}>
          <Text style={styles.snapshotValue}>{openReports}</Text>
          <Text style={styles.snapshotLabel}>Open reports</Text>
        </View>
      </View>

      <View style={styles.setupCard}>
        <View style={styles.setupHeaderRow}>
          <Text style={styles.setupTitle}>Setup Checklist</Text>
          <Text style={styles.setupProgress}>{[pendingUsers === 0, pendingBusinesses === 0, pendingListings === 0, openReports === 0].filter(Boolean).length}/4 done</Text>
        </View>
        <Text style={styles.setupBody}>Finish these admin tasks before launch to reduce risk in production.</Text>

        <SetupChecklistItem
          done={pendingUsers === 0}
          title="User approvals cleared"
          detail={pendingUsers === 0 ? 'No pending user approvals remaining.' : `${pendingUsers} users still pending review.`}
          actionLabel="Open"
          onPress={() => onNavigateToPendingUsers?.()}
        />
        <SetupChecklistItem
          done={pendingBusinesses === 0}
          title="Business approvals cleared"
          detail={pendingBusinesses === 0 ? 'No pending business approvals remaining.' : `${pendingBusinesses} businesses still pending review.`}
          actionLabel="Open"
          onPress={() => onNavigateToPendingBusinesses?.()}
        />
        <SetupChecklistItem
          done={pendingListings === 0}
          title="Listing approvals cleared"
          detail={pendingListings === 0 ? 'No listing submissions waiting for approval.' : `${pendingListings} listings still pending review.`}
          actionLabel="Open"
          onPress={() => onNavigateToPendingListings?.()}
        />
        <SetupChecklistItem
          done={openReports === 0}
          title="Report queue resolved"
          detail={openReports === 0 ? 'No open reports waiting for moderation.' : `${openReports} reports still pending action.`}
          actionLabel="Open"
          onPress={() => onNavigateToReports?.()}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Text style={styles.sectionBody}>Each queue keeps the next critical decisions one tap away.</Text>
      </View>

      <View style={styles.queueGrid}>
        <QueueCard
          icon="user-check"
          color="#16a34a"
          title="Pending Users"
          count={pendingUsers}
          hint="Approve or reject account access requests."
          onPress={() => onNavigateToPendingUsers?.()}
        />
        <QueueCard
          icon="briefcase"
          color="#0f766e"
          title="Pending Businesses"
          count={pendingBusinesses}
          hint="Review business profiles waiting on approval."
          onPress={() => onNavigateToPendingBusinesses?.()}
        />
        <QueueCard
          icon="file-text"
          color="#ea580c"
          title="Pending Listings"
          count={pendingListings}
          hint="Approve or reject new listing submissions."
          onPress={() => onNavigateToPendingListings?.()}
        />
        <QueueCard
          icon="flag"
          color="#dc2626"
          title="Open Reports"
          count={openReports}
          hint="Review flagged messages, listings, and user reports."
          onPress={() => onNavigateToReports?.()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#64748b',
  },
  unauthorizedText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ef4444',
    marginTop: 16,
  },
  unauthorizedSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    padding: 18,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#93c5fd',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#cbd5e1',
  },
  snapshotRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
  },
  snapshotCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  snapshotValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  snapshotLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  setupCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  setupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  setupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  setupProgress: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  setupBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
    marginBottom: 10,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: '#f8fafc',
  },
  setupIndicator: {
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  setupIndicatorDone: {
    backgroundColor: '#dcfce7',
  },
  setupIndicatorPending: {
    backgroundColor: '#ffedd5',
  },
  setupTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  setupItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  setupItemTitleDone: {
    color: '#166534',
  },
  setupItemDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
  },
  setupActionBtn: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setupActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
  },
  queueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
  },
  queueCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  queueIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  queueCount: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
  },
  queueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  queueHint: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
    marginTop: 6,
    minHeight: 34,
  },
  queueFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
