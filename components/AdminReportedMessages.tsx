import { Feather } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type ReportedMessage = {
  id: string;
  messageId: string;
  threadId: string;
  reportedBy: string;
  reportedUser: string;
  reason: string;
  details: string;
  messageText: string;
  createdAt: any;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: any;
};

export default function AdminReportedMessages() {
  const [reports, setReports] = useState<ReportedMessage[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [selectedReport, setSelectedReport] = useState<ReportedMessage | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processingReport, setProcessingReport] = useState(false);

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
    const reportsRef = collection(db, 'reportedMessages');
    const q = query(reportsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: ReportedMessage[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ReportedMessage, 'id'>),
        }));
        setReports(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Snapshot listener error (reportedMessages):', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    const filtered = reports.filter((r) =>
      activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
    );
    setFilteredReports(filtered);
  }, [reports, activeTab]);

  const openReportDetails = (report: ReportedMessage) => {
    setSelectedReport(report);
    setAdminNotes(report.adminNotes || '');
    setDetailsModalVisible(true);
  };

  const updateReportStatus = async (status: 'dismissed' | 'action_taken' | 'reviewed', notes: string) => {
    if (!selectedReport) return;

    setProcessingReport(true);
    try {
      const db = getFirestore(app);
      const auth = getAuth();

      await updateDoc(doc(db, 'reportedMessages', selectedReport.id), {
        status,
        adminNotes: notes.trim(),
        reviewedBy: auth.currentUser?.uid,
        reviewedAt: new Date(),
      });

      setDetailsModalVisible(false);
      Alert.alert('Success', `Report marked as ${status === 'dismissed' ? 'dismissed' : status === 'action_taken' ? 'action taken' : 'reviewed'}`);
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Error', 'Failed to update report.');
    } finally {
      setProcessingReport(false);
    }
  };

  const renderReport = ({ item }: { item: ReportedMessage }) => {
    const createdDate = item.createdAt
      ? new Date(item.createdAt.toMillis?.() || item.createdAt).toLocaleDateString()
      : '';

    const statusColors: Record<string, string> = {
      pending: '#FF9800',
      reviewed: '#2196F3',
      dismissed: '#9E9E9E',
      action_taken: '#4CAF50',
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.reason}>{item.reason}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>
          {createdDate ? <Text style={styles.date}>{createdDate}</Text> : null}
        </View>

        <View style={styles.cardContent}>
          {item.messageText ? (
            <>
              <Text style={styles.label}>Reported Message:</Text>
              <Text style={styles.messagePreview} numberOfLines={2}>
                "{item.messageText}"
              </Text>
            </>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Reason:</Text>
            <Text style={styles.metaValue}>{item.reason}</Text>
          </View>

          {item.details && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Details:</Text>
              <Text style={[styles.metaValue, { flex: 1 }]} numberOfLines={2}>
                {item.details}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => openReportDetails(item)}
          >
            <Feather name="eye" size={16} color="#2196F3" />
            <Text style={styles.detailsButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
        <>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
                Pending ({reports.filter((r) => r.status === 'pending').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'reviewed' && styles.activeTab]}
              onPress={() => setActiveTab('reviewed')}
            >
              <Text style={[styles.tabText, activeTab === 'reviewed' && styles.activeTabText]}>
                Reviewed ({reports.filter((r) => r.status !== 'pending').length})
              </Text>
            </TouchableOpacity>
          </View>

          {filteredReports.length === 0 ? (
            <View style={styles.centerContent}>
              <Feather name="check-circle" size={64} color="#4CAF50" />
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? 'No pending reports' : 'No reviewed reports'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredReports}
              keyExtractor={(item) => item.id}
              renderItem={renderReport}
              contentContainerStyle={styles.listContent}
            />
          )}
        </>
      )}

      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !processingReport && setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedReport && (
              <ScrollView>
                <Text style={styles.modalTitle}>Report Details</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Message Reported:</Text>
                  <Text style={styles.detailText}>"{selectedReport.messageText}"</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Reason:</Text>
                  <Text style={styles.detailText}>{selectedReport.reason}</Text>
                </View>

                {selectedReport.details && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Report Details:</Text>
                    <Text style={styles.detailText}>{selectedReport.details}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <Text style={styles.detailText}>{selectedReport.status}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Admin Notes:</Text>
                  <Text style={styles.inputLabel}>Add notes about this report</Text>
                  <Text style={styles.inputHelper}>(visible only to admins)</Text>
                </View>

                <View style={styles.notesInputContainer}>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Enter admin notes..."
                    value={adminNotes}
                    onChangeText={setAdminNotes}
                    multiline
                    numberOfLines={3}
                    editable={!processingReport}
                    maxLength={500}
                  />
                  <Text style={styles.charCount}>{adminNotes.length}/500</Text>
                </View>

                {selectedReport.status === 'pending' && !processingReport && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => updateReportStatus('dismissed', adminNotes)}
                      disabled={processingReport}
                    >
                      <Text style={styles.actionButtonText}>Dismiss</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionTakenButton]}
                      onPress={() => updateReportStatus('action_taken', adminNotes)}
                      disabled={processingReport}
                    >
                      <Text style={styles.actionButtonText}>Action Taken</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedReport.status !== 'pending' && (
                  <View style={styles.reviewedBadge}>
                    <Feather name="check" size={16} color="#4CAF50" />
                    <Text style={styles.reviewedText}>Already reviewed</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setDetailsModalVisible(false)}
                  disabled={processingReport}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  tabContainer: {
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
  activeTab: {
    borderBottomColor: '#FF9800',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#FF9800',
  },
  listContent: {
    padding: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reason: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
  },
  messagePreview: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    minWidth: 60,
  },
  metaValue: {
    fontSize: 12,
    color: '#333',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 6,
  },
  detailsButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#333',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
  },
  inputHelper: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  notesInputContainer: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dismissButton: {
    backgroundColor: '#9E9E9E',
  },
  actionTakenButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f1f8e9',
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewedText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});
