import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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

type ReportableMessage = {
  id: string;
  createdAt?: unknown;
  deleted?: boolean;
  senderId?: string;
  text?: string;
};

function formatMessageTime(value: unknown): string {
  if (!value) return '';
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
}

export default function ReportMessageScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const threadId = typeof params.threadId === 'string' ? params.threadId : Array.isArray(params.threadId) ? params.threadId[0] : '';
  const listingTitle = typeof params.listingTitle === 'string' ? params.listingTitle : Array.isArray(params.listingTitle) ? params.listingTitle[0] : 'Conversation';
  const user = getAuth().currentUser;

  const [messages, setMessages] = useState<ReportableMessage[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('../(tabs)/messagesbutton');
  };

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      if (!threadId || !user?.uid) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const snapshot = await getDocs(query(collection(db, 'threads', threadId, 'messages'), orderBy('createdAt', 'desc')));
        const reportableMessages = snapshot.docs
          .map((messageDoc) => ({ id: messageDoc.id, ...(messageDoc.data() as Omit<ReportableMessage, 'id'>) }))
          .filter((message) => !message.deleted && message.senderId !== user.uid);

        if (!cancelled) {
          setMessages(reportableMessages);
        }
      } catch (error) {
        console.error('Error loading reportable messages:', error);
        if (!cancelled) {
          Alert.alert('Error', 'Could not load messages to report right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [threadId, user?.uid]);

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) || null,
    [messages, selectedMessageId]
  );

  const handleSubmit = async () => {
    if (!user?.uid || !threadId) {
      Alert.alert('Error', 'You must be signed in to report a message.');
      return;
    }

    if (!selectedMessage) {
      Alert.alert('Select A Message', 'Choose the message you want to report first.');
      return;
    }

    setSubmitting(true);

    try {
      const messageSnap = await getDoc(doc(db, 'threads', threadId, 'messages', selectedMessage.id));
      if (!messageSnap.exists()) {
        Alert.alert('Error', 'That message is no longer available.');
        setSubmitting(false);
        return;
      }

      const messageData = messageSnap.data() || {};
      if (messageData.senderId === user.uid) {
        Alert.alert('Not Allowed', 'You cannot report your own messages.');
        setSubmitting(false);
        return;
      }

      const existingReportSnapshot = await getDocs(query(collection(db, 'messageReports')));
      const alreadyReported = existingReportSnapshot.docs.some((reportDoc) => {
        const reportData = reportDoc.data() || {};
        return reportData.messageId === selectedMessage.id && reportData.reportedBy === user.uid;
      });

      if (alreadyReported) {
        Alert.alert('Already Reported', 'You have already reported this message.');
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'messageReports'), {
        messageId: selectedMessage.id,
        threadId,
        reportedBy: user.uid,
        messageSenderId: messageData.senderId || '',
        messageText: messageData.text || '',
        reason: 'other',
        explanation: explanation.trim() || 'No explanation provided',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report Submitted', 'Message reported successfully. Thank you for helping keep Local List safe.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error reporting message:', error);
      Alert.alert('Error', 'Could not submit this report right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.screenTitleRowWrap}>
          <ScreenTitleRow title="Report Message" onBackPress={handleBack} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.subtitle}>Select a message from {listingTitle} and tell us what happened.</Text>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator size="small" color="#0f766e" />
              <Text style={styles.stateText}>Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No reportable messages</Text>
              <Text style={styles.emptyText}>Only messages sent by the other user can be reported from this screen.</Text>
            </View>
          ) : (
            <View style={styles.messageList}>
              {messages.map((message) => {
                const selected = message.id === selectedMessageId;
                return (
                  <TouchableOpacity
                    key={message.id}
                    style={[styles.messageCard, selected ? styles.messageCardSelected : null]}
                    onPress={() => setSelectedMessageId(message.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.messageMeta}>{formatMessageTime(message.createdAt)}</Text>
                    <Text style={[styles.messageText, selected ? styles.messageTextSelected : null]}>{message.text || 'No message text available'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Why are you reporting this message? (optional)</Text>
          <TextInput
            style={styles.textArea}
            value={explanation}
            onChangeText={setExplanation}
            placeholder="Provide details about why you are reporting this message..."
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleBack} activeOpacity={0.85}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, (!selectedMessage || submitting) ? styles.submitButtonDisabled : null]}
              onPress={handleSubmit}
              disabled={!selectedMessage || submitting}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonText}>{submitting ? 'Submitting...' : 'Report Message'}</Text>
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
    padding: 16,
    gap: 14,
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
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  stateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#64748b',
  },
  messageList: {
    gap: 10,
  },
  messageCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  messageCardSelected: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfdf5',
  },
  messageMeta: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0f172a',
  },
  messageTextSelected: {
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
