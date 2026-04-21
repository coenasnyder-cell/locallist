import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormInput from '../../components/FormInput';
import { ThemedView } from '../../components/themed-view';
import { app } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';

const DEFAULT_JOB_CATEGORIES = [
  'General Labor',
  'Construction',
  'Retail',
  'Food Service',
  'Healthcare',
  'Education',
  'Administrative',
  'Skilled Trades',
  'Transportation',
  'Technology',
  'Sales',
  'Customer Service',
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Seasonal', 'Internship'];
const PAY_TYPES = ['Hourly', 'Salary', 'Other'];

export default function CreateJobListingPage() {
  const router = useRouter();
  const { user, profile, loading, canPostListings, postingBlockedReason } = useAccountStatus();
  const loginPromptShownRef = useRef(false);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('../(tabs)/browsebutton');
  };

  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobCategory, setJobCategory] = useState('');
  const [jobType, setJobType] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [payType, setPayType] = useState('');
  const [allowInAppMessaging, setAllowInAppMessaging] = useState(false);
  const [applyInstructions, setApplyInstructions] = useState('');
  const [salaryInfo, setSalaryInfo] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [jobCategories, setJobCategories] = useState<string[]>(DEFAULT_JOB_CATEGORIES);
  const [submitting, setSubmitting] = useState(false);

  const isBusinessAccount = profile?.accountType === 'business';
  const canCreateJobPost = canPostListings && isBusinessAccount;

  const normalizedUserName = useMemo(
    () => profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Unknown',
    [profile?.displayName, user?.displayName, user?.email]
  );

  useEffect(() => {
    if (profile?.accountType === 'business' && profile?.businessName) {
      setCompanyName(profile.businessName);
    }
    if (user?.email) {
      setContactEmail(user.email);
    }
  }, [profile?.accountType, profile?.businessName, user?.email]);

  useEffect(() => {
    const loadJobCategories = async () => {
      try {
        const db = getFirestore(app);
        const snapshot = await getDocs(collection(db, 'jobCategories'));
        const categories = snapshot.docs
          .map((docSnap) => docSnap.data()?.name)
          .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
          .map((name) => name.trim());

        if (categories.length > 0) {
          setJobCategories(categories);
        }
      } catch {
        setJobCategories(DEFAULT_JOB_CATEGORIES);
      }
    };

    loadJobCategories();
  }, []);

  useEffect(() => {
    if (user) {
      loginPromptShownRef.current = false;
      return;
    }

    if (loading || loginPromptShownRef.current) {
      return;
    }

    loginPromptShownRef.current = true;
    Alert.alert('Login Required', 'Please sign in to create a job listing.', [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Log In', onPress: () => router.push('../login') },
    ]);
  }, [loading, user, router]);

  const isValid =
    !!jobTitle.trim() &&
    !!jobDescription.trim() &&
    !!jobCategory &&
    !!jobType &&
    !!jobLocation.trim() &&
    !!companyName.trim() &&
    !!payType;

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please sign in to post a job.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('../login') },
      ]);
      return;
    }

    if (loading) {
      Alert.alert('Please Wait', 'Checking account status. Please try again in a moment.');
      return;
    }

    if (!isBusinessAccount) {
      Alert.alert('Business Account Required', 'Only business accounts can post job listings.');
      return;
    }

    if (!canPostListings) {
      Alert.alert('Account Action Required', postingBlockedReason || 'Your account is not eligible to post right now.');
      return;
    }

    if (!isValid) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    if (!allowInAppMessaging && !applyInstructions.trim() && !contactEmail.trim()) {
      Alert.alert('Application Info Needed', 'Provide at least one way for applicants to reach you: enable in-app messaging, add a contact email, or include application instructions.');
      return;
    }

    setSubmitting(true);
    try {
      const db = getFirestore(app);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await addDoc(collection(db, 'jobBoard'), {
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim(),
        jobCategory,
        jobType,
        jobLocation: jobLocation.trim(),
        companyName: companyName.trim(),
        contactEmail: contactEmail.trim() || null,
        payType,
        allowInAppMessaging,
        applyInstructions: applyInstructions.trim() || null,
        salaryInfo: salaryInfo.trim() || null,
        jobRequirements: jobRequirements.trim() || null,
        status: 'approved',
        createdAt: serverTimestamp(),
        expiresAt: expiresAt.toISOString(),
        userName: normalizedUserName,
        userId: user.uid,
        businessId: profile?.accountType === 'business' ? user.uid : null,
      });

      Alert.alert('Success', 'Job listing created successfully.');
      setJobTitle('');
      setJobDescription('');
      setJobCategory('');
      setJobType('');
      setJobLocation('');
      setPayType('');
      setAllowInAppMessaging(false);
      setApplyInstructions('');
      setSalaryInfo('');
      setJobRequirements('');

      router.replace('../(tabs)/profilebutton');
    } catch {
      Alert.alert('Error', 'Could not create job listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ThemedView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <Text style={styles.title}>Create Job Listing</Text>
          <Text style={styles.subtitle}>Business accounts can post hiring opportunities to the job board</Text>
          {!loading && user && !isBusinessAccount ? (
            <Text style={styles.notice}>Only business accounts can create job posts.</Text>
          ) : null}
          {!loading && user && isBusinessAccount && !canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}

          <FormInput label="Job Title" value={jobTitle} onChangeText={setJobTitle} required editable={!loading && canCreateJobPost} />
          <FormInput
            label="Job Description"
            value={jobDescription}
            onChangeText={setJobDescription}
            multiline
            required
            editable={!loading && canCreateJobPost}
          />
          <FormInput
            label="Job Category"
            value={jobCategory}
            onChangeText={setJobCategory}
            type="picker"
            options={jobCategories}
            placeholder="Select category"
            dropdownZIndex={3000}
            required
            editable={!loading && canCreateJobPost}
          />
          <FormInput
            label="Job Type"
            value={jobType}
            onChangeText={setJobType}
            type="picker"
            options={JOB_TYPES}
            placeholder="Select job type"
            dropdownZIndex={2000}
            required
            editable={!loading && canCreateJobPost}
          />
          <FormInput label="Job Location" value={jobLocation} onChangeText={setJobLocation} required editable={!loading && canCreateJobPost} />
          <FormInput label="Company Name" value={companyName} onChangeText={setCompanyName} required editable={!loading && canCreateJobPost} />
          <FormInput
            label="Contact Email"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            placeholder="Optional"
            editable={!loading && canCreateJobPost}
          />
          <FormInput
            label="Pay Type"
            value={payType}
            onChangeText={setPayType}
            type="picker"
            options={PAY_TYPES}
            placeholder="Select pay type"
            dropdownZIndex={1000}
            required
            editable={!loading && canCreateJobPost}
          />
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setAllowInAppMessaging((v) => !v)}
            activeOpacity={0.8}
            disabled={!canCreateJobPost}
          >
            <View style={[styles.checkbox, allowInAppMessaging && styles.checkboxChecked]}>
              {allowInAppMessaging ? <Text style={styles.checkboxCheck}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>Allow in-app messaging from applicants</Text>
          </TouchableOpacity>
          <FormInput
            label="Instructions on How to Apply"
            value={applyInstructions}
            onChangeText={setApplyInstructions}
            multiline
            placeholder="e.g. Email your resume to..., apply at our website..."
            editable={!loading && canCreateJobPost}
          />
          <FormInput
            label="Salary Information"
            value={salaryInfo}
            onChangeText={setSalaryInfo}
            multiline
            placeholder="e.g. $18/hr, $45,000–$55,000/yr, Competitive"
            editable={!loading && canCreateJobPost}
          />
          <FormInput
            label="Job Requirements"
            value={jobRequirements}
            onChangeText={setJobRequirements}
            multiline
            placeholder="e.g. 2+ years experience, valid driver's license..."
            editable={!loading && canCreateJobPost}
          />

          <TouchableOpacity
            style={[styles.submitButton, (!isValid || submitting || !canCreateJobPost || loading) && styles.submitButtonDisabled]}
            disabled={!isValid || submitting || !canCreateJobPost || loading}
            onPress={handleSubmit}
          >
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Job'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  notice: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#94a3b8',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
});
