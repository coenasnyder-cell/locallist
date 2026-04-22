import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, getDocs, query, serverTimestamp } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { db } from '../../firebase';

const REPORT_REASONS = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'scam', label: 'Scam' },
  { key: 'inappropriate-content', label: 'Inappropriate Content' },
  { key: 'other', label: 'Other' },
];

export default function ReportUserScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const user = getAuth().currentUser;
  const reportedUserId = typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : '';
  const reportedUserName = typeof params.userName === 'string' ? params.userName : Array.isArray(params.userName) ? params.userName[0] : 'this user';

  const [selectedReason, setSelectedReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('../(tabs)/messagesbutton');
  };

  const canSubmit = useMemo(() => Boolean(selectedReason && reportedUserId), [reportedUserId, selectedReason]);

  const handleSubmit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to report a user.');
      return;
    }

    if (!reportedUserId) {
      Alert.alert('Error', 'Could not identify the user you want to report.');
      return;
    }

    if (!selectedReason) {
      Alert.alert('Select A Reason', 'Choose a reason before submitting your report.');
      return;
    }

    if (reportedUserId === user.uid) {
      Alert.alert('Not Allowed', 'You cannot report yourself.');
      return;
    }

    setSubmitting(true);

    try {
      const existingReportsSnapshot = await getDocs(query(collection(db, 'userReports')));
      const alreadyReported = existingReportsSnapshot.docs.some((reportDoc) => {
        const reportData = reportDoc.data() || {};
        return reportData.reportedUserId === reportedUserId && reportData.reportedBy === user.uid;
      });

      if (alreadyReported) {
        Alert.alert('Already Reported', 'You have already reported this user.');
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'userReports'), {
        reportedUserId,
        reportedBy: user.uid,
        reason: selectedReason,
        explanation: explanation.trim() || 'No explanation provided',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report Submitted', 'User report submitted successfully. Thank you for helping keep Local List safe.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert('Error', 'Could not submit this report right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.screenTitleRowWrap}>
          <ScreenTitleRow title="Report User" onBackPress={handleBack} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.subtitle}>Tell us why you are reporting {reportedUserName}.</Text>

          <View style={styles.reasonList}>
            {REPORT_REASONS.map((reason) => {
              const selected = selectedReason === reason.key;
              return (
                <TouchableOpacity
                  key={reason.key}
                  style={[styles.reasonCard, selected ? styles.reasonCardSelected : null]}
                  onPress={() => setSelectedReason(reason.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.radioCircle, selected ? styles.radioCircleSelected : null]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={[styles.reasonText, selected ? styles.reasonTextSelected : null]}>{reason.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Please explain your reason for reporting this user (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={explanation}
            onChangeText={setExplanation}
            placeholder="Provide details about why you're reporting this user..."
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleBack} activeOpacity={0.85}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, (!canSubmit || submitting) ? styles.submitButtonDisabled : null]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Report User'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 12,
    gap: 10,
  },
  screenTitleRowWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  panel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  reasonList: {
    gap: 10,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  reasonCardSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#0f766e',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f766e',
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  reasonTextSelected: {
    color: '#065f46',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    fontSize: 15,
    color: '#0f172a',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '800',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
