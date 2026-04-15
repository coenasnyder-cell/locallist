import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { app } from '../../firebase';
import { useAccountStatus } from '../../hooks/useAccountStatus';

type JobListing = {
  id: string;
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
  createdAt?: { toMillis?: () => number } | string | number | Date;
};

function getCreatedAtMillis(value: JobListing['createdAt']): number {
  if (!value) return 0;
  if (typeof value === 'object' && value !== null && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export default function JobListingsScreen() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { profile } = useAccountStatus();
  const isBusinessUser = profile?.accountType === 'business';

  useEffect(() => {
    const fetchListings = async () => {
      try {
        const db = getFirestore(app);
        const jobsQuery = query(collection(db, 'jobBoard'), where('status', '==', 'approved'));
        const snapshot = await getDocs(jobsQuery);

        const fetched = snapshot.docs.map((doc) => {
          const data = doc.data() as Omit<JobListing, 'id'>;
          return { id: doc.id, ...data };
        });

        fetched.sort((left, right) => getCreatedAtMillis(right.createdAt) - getCreatedAtMillis(left.createdAt));
        setJobs(fetched);
      } catch (error) {
        console.error('Error fetching job listings:', error);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow
          title="Job Board"
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/(tabs)/communitybutton');
          }}
        />
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroSubtitle}>Browse local opportunities and find your next role.</Text>
      </View>

      {isBusinessUser && (
        <View style={styles.benefitsCard}>
          <Image source={require('../../assets/images/jobhub.png')} style={styles.benefitsImage} resizeMode="cover" />
          <View style={styles.benefitsContent}>
            <TouchableOpacity style={styles.postButton} activeOpacity={0.86} onPress={() => router.push('/create-job-listing' as any)}>
              <Text style={styles.postButtonText}>+ Post A Job</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading job listings...</Text>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No job listings found.</Text>
        </View>
      ) : (
        <View style={styles.jobsGrid}>
          {jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/(app)/job-details', params: { id: job.id } })}
            >
              <Text style={styles.title}>{job.jobTitle || 'Untitled role'}</Text>
              <Text style={styles.company}>{job.companyName || 'Company not specified'}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaPill}>{job.jobCategory || 'Uncategorized'}</Text>
                <Text style={styles.metaPill}>{job.jobType || 'Type not set'}</Text>
              </View>
              <Text style={styles.description} numberOfLines={4}>
                {job.jobDescription || 'No description provided.'}
              </Text>
              <Text style={styles.infoText}>Location: {job.jobLocation || 'N/A'}</Text>
              <Text style={styles.infoText}>Pay: ${job.payMin ?? '0'} - ${job.payMax ?? '0'}</Text>
              <Text style={styles.infoText}>Apply: {job.howApply || 'See contact info'}</Text>
              <Text style={styles.infoText}>Contact: {job.contactEmail || 'N/A'}</Text>
              <Text style={styles.poster}>Posted by: {job.userName || 'Unknown'}</Text>
              <Text style={styles.detailsLink}>View details</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 60,
  },
  screenTitleRowWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  benefitsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  benefitsImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#64748b',
  },
  benefitsContent: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 8,
  },
  benefitsText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  postButton: {
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#475569',
  },
  postButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  jobsGrid: {
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  company: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    backgroundColor: '#e2e8f0',
    color: '#334155',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  poster: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  detailsLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f766e',
  },
  digestBanner: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  digestIcon: {
    fontSize: 46,
    marginBottom: 12,
  },
  digestBody: {
    alignItems: 'center',
  },
  digestTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  digestText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 14,
  },
  digestPill: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#0f172a',
  },
  digestPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
