import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { app } from '../../firebase';

type JobPost = {
  userId?: string;
  jobTitle?: string;
  companyName?: string;
  jobCategory?: string;
  jobType?: string;
  jobDescription?: string;
  jobLocation?: string;
  payMin?: number;
  payMax?: number;
  howApply?: string;
  contactEmail?: string;
  userName?: string;
  createdAt?: any;
};

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = getAuth().currentUser;

  useEffect(() => {
    const loadJob = async () => {
      if (!id || typeof id !== 'string') {
        setLoading(false);
        return;
      }

      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'jobBoard', id));
        if (snap.exists()) {
          setJob(snap.data() as JobPost);
        } else {
          setJob(null);
        }
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    };

    loadJob();
  }, [id]);

  const postedDate = job?.createdAt?.toDate ? job.createdAt.toDate().toLocaleDateString() : null;

  const resolveApplyUrl = (value?: string): string | null => {
    const text = (value || '').trim();
    if (!text) return null;

    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      const subject = encodeURIComponent(`Application: ${job?.jobTitle || 'Job Opening'}`);
      return `mailto:${emailMatch[0]}?subject=${subject}`;
    }

    if (/^https?:\/\//i.test(text)) {
      return text;
    }

    if (/^www\./i.test(text)) {
      return `https://${text}`;
    }

    return null;
  };

  const handleApplyPress = async () => {
    const howApplyUrl = resolveApplyUrl(job?.howApply);
    const contactEmailUrl = resolveApplyUrl(job?.contactEmail);
    const targetUrl = howApplyUrl || contactEmailUrl;

    if (!targetUrl) {
      Alert.alert('How To Apply', job?.howApply || 'Please use the listed contact information.');
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert('Unable To Open', 'Could not open application link. Please use the listed contact info.');
    }
  };

  const submitJobReport = async (reason: string) => {
    if (!id || !job) return;

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (job.userId && job.userId === currentUser.uid) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'reportedListings'), {
        listingId: id,
        listingType: 'job',
        listingTitle: job.jobTitle || 'Job listing',
        listingImage: '',
        sellerId: job.userId || '',
        sellerEmail: job.contactEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from job details screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch (error) {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleReportJob = () => {
    Alert.alert('Report Listing', 'Why are you reporting this job listing?', [
      { text: 'Spam', onPress: () => submitJobReport('spam') },
      { text: 'Scam/Fraud', onPress: () => submitJobReport('scam') },
      { text: 'Prohibited Content', onPress: () => submitJobReport('prohibited_content') },
      { text: 'Misleading Information', onPress: () => submitJobReport('misleading_content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <BackToCommunityHubRow />

        {loading ? (
          <Text style={styles.loading}>Loading job...</Text>
        ) : !job ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Job not found</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Back to Jobs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>{job.jobTitle || 'Job listing'}</Text>
            {!!job.companyName && <Text style={styles.company}>{job.companyName}</Text>}

            <View style={styles.metaRow}>
              {!!job.jobCategory && <Text style={styles.pill}>{job.jobCategory}</Text>}
              {!!job.jobType && <Text style={styles.pill}>{job.jobType}</Text>}
            </View>

            <Text style={styles.sectionLabel}>Description</Text>
            {!!job.jobDescription && <Text style={styles.paragraph}>{job.jobDescription}</Text>}

            <Text style={styles.sectionLabel}>Details</Text>
            {!!job.jobLocation && <Text style={styles.info}>Location: {job.jobLocation}</Text>}
            {(typeof job.payMin === 'number' || typeof job.payMax === 'number') && (
              <Text style={styles.info}>
                Pay: {typeof job.payMin === 'number' ? `$${job.payMin}` : ''}
                {typeof job.payMin === 'number' && typeof job.payMax === 'number' ? ' - ' : ''}
                {typeof job.payMax === 'number' ? `$${job.payMax}` : ''}
              </Text>
            )}
            {!!job.howApply && <Text style={styles.info}>How To Apply: {job.howApply}</Text>}
            {!!job.contactEmail && <Text style={styles.info}>Contact Email: {job.contactEmail}</Text>}
            {!!job.userName && <Text style={styles.info}>Posted By: {job.userName}</Text>}
            {postedDate ? <Text style={styles.info}>Posted On: {postedDate}</Text> : null}

            <TouchableOpacity style={styles.applyButton} onPress={handleApplyPress}>
              <Text style={styles.applyButtonText}>Apply Now</Text>
            </TouchableOpacity>
            {!!currentUser && job.userId !== currentUser.uid && (
              <TouchableOpacity style={styles.reportButton} onPress={handleReportJob}>
                <Text style={styles.reportButtonText}>Report Listing</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 12,
    flexGrow: 1,
  },
  loading: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 16,
    color: '#64748b',
  },
  emptyWrap: {
    marginTop: 28,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  backButton: {
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  card: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  company: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 12,
  },
  info: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 6,
  },
  applyButton: {
    marginTop: 12,
    backgroundColor: '#0f766e',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  reportButton: {
    marginTop: 10,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reportButtonText: {
    color: '#b91c1c',
    fontWeight: '700',
    fontSize: 14,
  },
});
