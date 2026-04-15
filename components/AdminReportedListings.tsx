import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, onSnapshot, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { checkIsAdmin } from '../utils/adminUtils';

type ReportedListing = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  sellerId: string;
  sellerEmail: string;
  reportedBy: string;
  reason: string;
  details: string;
  createdAt: any;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: any;
};

export default function AdminReportedListings() {
  const [reports, setReports] = useState<ReportedListing[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [selectedReport, setSelectedReport] = useState<ReportedListing | null>(null);
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
    const reportsRef = collection(db, 'reportedListings');
    const q = query(reportsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rows: ReportedListing[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ReportedListing, 'id'>),
      }));
      setReports(rows);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    const filtered = reports.filter((r) =>
      activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
    );
    setFilteredReports(filtered);
  }, [reports, activeTab]);

  const openReportDetails = (report: ReportedListing) => {
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

      await updateDoc(doc(db, 'reportedListings', selectedReport.id), {
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

  const renderReport = ({ item }: { item: ReportedListing }) => {
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
          <View style={styles.imageRow}>
            {item.listingImage ? (
              <Image
                source={{ uri: item.listingImage }}
                style={styles.listingImage}
              />
            ) : (
              <View style={[styles.listingImage, { backgroundColor: '#f0f0f0' }]} />
            )}
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={2}>{item.listingTitle}</Text>
              <Text style={styles.sellerEmail} numberOfLines={1}>{item.sellerEmail}</Text>
            </View>
          </View>

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
        </View>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => openReportDetails(item)}
        >
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (checkingAuth) {
    return (
      <View style={styles.centerContent}>
        <Text>Checking permissions...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centerContent}>
        <Text>Access denied. Admin privileges required.</Text>
      </View>
    );
  }

  return (
    <>
      {loading ? (
        <View style={styles.centerContent}>
          <Text>Loading reports...</Text>
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
                  <Text style={styles.detailLabel}>Listing:</Text>
                  <View style={styles.listingPreviewContainer}>
                    {selectedReport.listingImage ? (
                      <Image
                        source={{ uri: selectedReport.listingImage }}
                        style={styles.listingPreviewImage}
                      />
                    ) : (
                      <View style={[styles.listingPreviewImage, { backgroundColor: '#f0f0f0' }]} />
                    )}
                    <View style={styles.listingPreviewText}>
                      <Text style={styles.listingPreviewTitle} numberOfLines={2}>{selectedReport.listingTitle}</Text>
                      <Text style={styles.listingPreviewEmail} numberOfLines={1}>{selectedReport.sellerEmail}</Text>
                    </View>
                  </View>
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
                    <Feather name="check-circle" size={20} color="#4CAF50" />
                    <View>
                      <Text style={styles.reviewedLabel}>Reviewed by admin</Text>
                      {selectedReport.reviewedAt ? (
                        <Text style={styles.reviewedDate}>
                          {new Date(selectedReport.reviewedAt.toMillis?.() || selectedReport.reviewedAt).toLocaleString()}
                        </Text>
                      ) : null}
                    </View>
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  listContent: {
    padding: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
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
  imageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  listingImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  listingInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sellerEmail: {
    fontSize: 12,
    color: '#999',
  },
  metaRow: {
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  metaValue: {
    fontSize: 13,
    color: '#333',
    marginTop: 2,
  },
  viewButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '90%',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  listingPreviewContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  listingPreviewImage: {
    width: 70,
    height: 70,
    borderRadius: 6,
  },
  listingPreviewText: {
    flex: 1,
  },
  listingPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  listingPreviewEmail: {
    fontSize: 12,
    color: '#999',
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  inputHelper: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontStyle: 'italic',
  },
  notesInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    marginHorizontal: 16,
    marginVertical: 12,
  },
  reviewedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  reviewedDate: {
    fontSize: 12,
    color: '#7CB342',
    marginTop: 2,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
});
