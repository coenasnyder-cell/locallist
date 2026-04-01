import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

const ISSUE_TYPES = ['bug', 'ux', 'performance', 'crash', 'payment', 'other'] as const;

type IssueType = (typeof ISSUE_TYPES)[number];

export default function BetaFeedbackScreen() {
  const [issueType, setIssueType] = useState<IssueType>('bug');
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setIssueType('bug');
    setTitle('');
    setSteps('');
    setExpectedResult('');
    setActualResult('');
    setDeviceInfo('');
  };

  const submitFeedback = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in before sending beta feedback.');
      return;
    }

    if (!title.trim() || !steps.trim() || !actualResult.trim()) {
      Alert.alert('Missing details', 'Please complete title, steps, and actual result.');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'betaFeedback'), {
        userId: user.uid,
        issueType,
        title: title.trim(),
        steps: steps.trim(),
        expectedResult: expectedResult.trim(),
        actualResult: actualResult.trim(),
        deviceInfo: deviceInfo.trim(),
        severity: 'untriaged',
        status: 'open',
        source: 'in_app_beta_form',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Submitted', 'Thanks. Your beta feedback has been submitted.');
      resetForm();
    } catch (error) {
      Alert.alert('Submission failed', 'Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Submit Beta Feedback</Text>
      <Text style={styles.subtitle}>Use this form for actionable bug and UX reports during closed beta.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.pillRow}>
          {ISSUE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.pill, issueType === type && styles.pillActive]}
              onPress={() => setIssueType(type)}
            >
              <Text style={[styles.pillText, issueType === type && styles.pillTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Short issue summary"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Steps To Reproduce</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={steps}
          onChangeText={setSteps}
          placeholder="1) Open app 2) ..."
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Expected Result</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={expectedResult}
          onChangeText={setExpectedResult}
          placeholder="What you expected to happen"
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Actual Result</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={actualResult}
          onChangeText={setActualResult}
          placeholder="What actually happened"
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Device / OS (optional)</Text>
        <TextInput
          style={styles.input}
          value={deviceInfo}
          onChangeText={setDeviceInfo}
          placeholder="iPhone 14 iOS 18.1 / Pixel 8 Android 15"
          placeholderTextColor="#94a3b8"
        />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitDisabled]} disabled={submitting} onPress={submitFeedback}>
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Feedback'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 14,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 10,
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
  },
  pillActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  pillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pillTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 90,
  },
  submitBtn: {
    marginTop: 14,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
