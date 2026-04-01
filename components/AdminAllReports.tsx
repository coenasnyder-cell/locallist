import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import {
    collection,
    doc,
    getFirestore,
    onSnapshot,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type ReportSource = 'reportedMessages' | 'reportedListings' | 'messageReports' | 'userReports';

type UnifiedReport = {
  id: string;
  source: ReportSource;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  createdAt?: any;
  // shared optional fields
  reason?: string;
  details?: string;
  explanation?: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  // reportedMessages
  messageText?: string;
  reportedBy?: string;
  reportedUser?: string;
  threadId?: string;
  // reportedListings
  listingTitle?: string;
  listingImage?: string;
  sellerEmail?: string;
  listingId?: string;
  // messageReports / userReports
  reportedUserId?: string;
};

const SOURCE_LABELS: Record<ReportSource, string> = {
  reportedMessages: 'Message Report',
  reportedListings: 'Listing Report',
  messageReports: 'Chat Report',
  userReports: 'User Report',
};

const SOURCE_COLORS: Record<ReportSource, string> = {
  reportedMessages: '#7c3aed',
  reportedListings: '#ea580c',
  messageReports: '#0f766e',
  userReports: '#dc2626',
};

function formatDate(value: any): string {
  if (!value) return '';
  try {
    return new Date(value.toMillis?.() ?? value).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function AdminAllReports() {
  const [sourceData] = useState<Record<ReportSource, UnifiedReport[]>>({
    reportedMessages: [],
    reportedListings: [],
    messageReports: [],
    userReports: [],
  });
  const [allReports, setAllReports] = useState<UnifiedReport[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingState, setLoadingState] = useState({
    reportedMessages: true,
    reportedListings: true,
    messageReports: true,
    userReports: true,
  });
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [selectedReport, setSelectedReport] = useState<UnifiedReport | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

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
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const db = getFirestore(app);
    const sources: ReportSource[] = [
      'reportedMessages',
      'reportedListings',
      'messageReports',
      'userReports',
    ];

    const rebuild = () => {
      setAllReports([
        ...sourceData.reportedMessages,
        ...sourceData.reportedListings,
        ...sourceData.messageReports,
        ...sourceData.userReports,
      ]);
    };

    const unsubscribers = sources.map((source) =>
      onSnapshot(
        collection(db, source),
        (snapshot) => {
          sourceData[source] = snapshot.docs.map((d) => ({
            id: d.id,
            source,
            status: 'pending' as const,
            ...d.data(),
          }));
          rebuild();
          setLoadingState((prev) => ({ ...prev, [source]: false }));
        },
        () => {
          setLoadingState((prev) => ({ ...prev, [source]: false }));
        }
      )
    );

    return () => unsubscribers.forEach((u) => u());
     
  }, [isAdmin]);

  const loading = useMemo(() => Object.values(loadingState).some(Boolean), [loadingState]);

  const pendingCount = useMemo(
    () => allReports.filter((r) => r.status === 'pending').length,
    [allReports]
  );

  const filteredReports = useMemo(() => {
    return [...allReports]
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt?.toMillis?.() ?? (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      })
      .filter((r) =>
        activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
      );
  }, [allReports, activeTab]);

  const getPreviewText = (report: UnifiedReport): string => {
    if (report.messageText) return `"${report.messageText}"`;
    if (report.listingTitle) return report.listingTitle;
    if (report.explanation) return report.explanation;
    return report.reason ?? '';
  };

  const openReport = (report: UnifiedReport) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes ?? '');
    setModalVisible(true);
  };

  const updateStatus = async (status: 'dismissed' | 'action_taken') => {
    if (!selectedReport) return;
    setProcessing(true);
    try {
      const db = getFirestore(app);
      const auth = getAuth();
      const payload: Record<string, any> = {
        status,
        reviewedBy: auth.currentUser?.uid,
        reviewedAt: serverTimestamp(),
      };
      if (
        selectedReport.source === 'reportedMessages' ||
        selectedReport.source === 'reportedListings'
      ) {
        payload.adminNotes = adminNotes.trim();
      }
      await updateDoc(doc(db, selectedReport.source, selectedReport.id), payload);
      setModalVisible(false);
      Alert.alert(
        'Updated',
        status === 'dismissed' ? 'Report dismissed.' : 'Action taken recorded.'
      );
    } catch {
      Alert.alert('Error', 'Failed to update report. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const renderReport = ({ item }: { item: UnifiedReport }) => {
    const color = SOURCE_COLORS[item.source];
    const previewText = getPreviewText(item);
    const createdDate = formatDate(item.createdAt);
    const statusColors: Record<string, string> = {
      pending: '#FF9800',
      reviewed: '#2196F3',
      dismissed: '#9E9E9E',
      action_taken: '#4CAF50',
    };

    return (
      <TouchableOpacity style={styles.card} onPress={() => openReport(item)} activeOpacity={0.85}>
        <View style={styles.cardTop}>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: `${color}18`, borderColor: `${color}44` },
            ]}
          >
            <Text style={[styles.typeText, { color }]}>{SOURCE_LABELS[item.source]}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] ?? '#9E9E9E' }]}>
            <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {previewText ? (
          <Text style={styles.previewText} numberOfLines={2}>
            {previewText}
          </Text>
        ) : null}

        {(item.reason || item.explanation) && (
          <Text style={styles.reasonText} numberOfLines={1}>
            Reason: {item.reason ?? item.explanation}
          </Text>
        )}

        {createdDate ? <Text style={styles.dateText}>{createdDate}</Text> : null}
      </TouchableOpacity>
    );
  };

  if (checkingAuth) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Checking authorization...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Feather name="lock" size={48} color="#ef4444" />
        <Text style={styles.unauthorizedText}>Access Denied</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviewed' && styles.activeTab]}
          onPress={() => setActiveTab('reviewed')}
        >
          <Text style={[styles.tabText, activeTab === 'reviewed' && styles.activeTabText]}>
            Reviewed ({allReports.length - pendingCount})
          </Text>
        </TouchableOpacity>
      </View>

      {filteredReports.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-circle" size={48} color="#4CAF50" />
          <Text style={styles.emptyText}>
            {activeTab === 'pending' ? 'No pending reports' : 'No reviewed reports'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !processing && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedReport && (
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Report Details</Text>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: `${SOURCE_COLORS[selectedReport.source]}18`,
                        borderColor: `${SOURCE_COLORS[selectedReport.source]}44`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        { color: SOURCE_COLORS[selectedReport.source] },
                      ]}
                    >
                      {SOURCE_LABELS[selectedReport.source]}
                    </Text>
                  </View>
                </View>

                {selectedReport.messageText && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reported Message:</Text>
                    <Text style={styles.detailValue}>"{selectedReport.messageText}"</Text>
                  </View>
                )}

                {selectedReport.listingTitle && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Listing:</Text>
                    <Text style={styles.detailValue}>{selectedReport.listingTitle}</Text>
                  </View>
                )}

                {selectedReport.sellerEmail && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Seller:</Text>
                    <Text style={styles.detailValue}>{selectedReport.sellerEmail}</Text>
                  </View>
                )}

                {(selectedReport.reason || selectedReport.explanation) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reason:</Text>
                    <Text style={styles.detailValue}>
                      {selectedReport.reason ?? selectedReport.explanation}
                    </Text>
                  </View>
                )}

                {selectedReport.details && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Details:</Text>
                    <Text style={styles.detailValue}>{selectedReport.details}</Text>
                  </View>
                )}

                {selectedReport.reportedUserId && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reported User ID:</Text>
                    <Text style={styles.detailValue}>{selectedReport.reportedUserId}</Text>
                  </View>
                )}

                {selectedReport.threadId && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Thread ID:</Text>
                    <Text style={styles.detailValue}>{selectedReport.threadId}</Text>
                  </View>
                )}

                {(selectedReport.source === 'reportedMessages' ||
                  selectedReport.source === 'reportedListings') && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Admin Notes:</Text>
                    <TextInput
                      style={styles.notesInput}
                      placeholder="Add admin notes..."
                      value={adminNotes}
                      onChangeText={setAdminNotes}
                      multiline
                      numberOfLines={3}
                      editable={!processing && selectedReport.status === 'pending'}
                      maxLength={500}
                    />
                    <Text style={styles.charCount}>{adminNotes.length}/500</Text>
                  </View>
                )}

                {selectedReport.status === 'pending' ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.dismissBtn]}
                      onPress={() => updateStatus('dismissed')}
                      disabled={processing}
                    >
                      <Text style={styles.actionBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionTakenBtn]}
                      onPress={() => updateStatus('action_taken')}
                      disabled={processing}
                    >
                      <Text style={styles.actionBtnText}>Action Taken</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.reviewedRow}>
                    <Feather name="check-circle" size={16} color="#4CAF50" />
                    <View>
                      <Text style={styles.reviewedText}>Already reviewed</Text>
                      {selectedReport.reviewedAt && (
                        <Text style={styles.reviewedDate}>
                          {formatDate(selectedReport.reviewedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setModalVisible(false)}
                  disabled={processing}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 16, color: '#64748b' },
  unauthorizedText: { fontSize: 18, fontWeight: '700', color: '#ef4444', marginTop: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#dc2626' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  activeTabText: { color: '#dc2626' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeBadge: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeText: { fontSize: 11, fontWeight: '700' },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  previewText: { fontSize: 14, color: '#334155', marginBottom: 4, fontStyle: 'italic' },
  reasonText: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  dateText: { fontSize: 11, color: '#94a3b8' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  detailSection: { marginBottom: 12 },
  detailLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
  detailValue: { fontSize: 14, color: '#334155' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#334155',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  dismissBtn: { backgroundColor: '#64748b' },
  actionTakenBtn: { backgroundColor: '#16a34a' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  reviewedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  reviewedText: { fontSize: 14, color: '#16a34a', fontWeight: '600' },
  reviewedDate: { fontSize: 12, color: '#64748b' },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: '#334155' },
});
