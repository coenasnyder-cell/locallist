import { useRouter } from 'expo-router';
import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import { app } from '../../firebase';

type YardSaleRecord = {
  id: string;
  yardsaleTitle?: string;
  yardsaleDescription?: string;
  yardsaleDate?: unknown;
  yardsaleEndDate?: unknown;
  yardsaleExpires?: unknown;
  yardsaleStart?: string;
  yardsaleEndtime?: string;
  yardsaleAddress?: string;
  yardsaleCity?: string;
  yardsaleState?: string;
  yardsaleZipcode?: string;
  yardsalelocation?: string;
  yardsaleCreatedat?: unknown;
  yardsalestatus?: string;
};

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown): string {
  const date = normalizeDate(value);
  if (!date) return 'Date TBD';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(startValue: unknown, endValue: unknown): string {
  const startDate = normalizeDate(startValue);
  const endDate = normalizeDate(endValue);

  if (!startDate && !endDate) return 'Date TBD';
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);

  const startText = formatDate(startDate as Date);
  const endText = formatDate(endDate as Date);
  if (startText === endText) return startText;
  return `${startText} - ${endText}`;
}

function getSaleRange(sale: YardSaleRecord): { start: Date | null; end: Date | null } {
  const start = normalizeDate(sale.yardsaleDate);
  const end = normalizeDate(sale.yardsaleEndDate || sale.yardsaleExpires || sale.yardsaleDate);

  if (start && end && end < start) {
    return { start, end: start };
  }

  return { start, end: end || start };
}

function getDisplayLocation(sale: YardSaleRecord): string {
  const address = String(sale.yardsaleAddress || '').trim();
  const city = String(sale.yardsaleCity || '').trim();
  const state = String(sale.yardsaleState || '').trim();
  const zip = String(sale.yardsaleZipcode || '').trim();

  const structured = [
    address,
    [city, state].filter(Boolean).join(', '),
    zip,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+,/g, ',');

  return structured || String(sale.yardsalelocation || '').trim() || 'Location TBD';
}


function buildYardSaleSubscriberId(email: string): string {
  return encodeURIComponent(email.trim().toLowerCase());
}
function getWeekendBounds() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;

  const sat = new Date(today);
  sat.setDate(today.getDate() + daysUntilSat);
  sat.setHours(0, 0, 0, 0);

  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(23, 59, 59, 999);

  return { sat, sun };
}

function getBuckets(sales: YardSaleRecord[]) {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const { sat, sun } = getWeekendBounds();

  const weekend: YardSaleRecord[] = [];
  const upcoming: YardSaleRecord[] = [];

  for (const sale of sales) {
    const { start, end } = getSaleRange(sale);
    if (!start || !end) continue;

    const saleStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const saleEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (saleEndDay < startToday) continue;

    const overlapsWeekend = saleStartDay <= sun && saleEndDay >= sat;
    if (overlapsWeekend) {
      weekend.push(sale);
    } else {
      upcoming.push(sale);
    }
  }

  const recent = [...sales]
    .sort((left, right) => {
      const leftDate = normalizeDate(left.yardsaleCreatedat)?.getTime() ?? 0;
      const rightDate = normalizeDate(right.yardsaleCreatedat)?.getTime() ?? 0;
      return rightDate - leftDate;
    })
    .slice(0, 10);

  return { weekend, upcoming, recent };
}

export default function YardSaleListingsScreen() {
  const [sales, setSales] = useState<YardSaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [digestEmail, setDigestEmail] = useState('');
  const [digestMessage, setDigestMessage] = useState('');
  const [digestMessageType, setDigestMessageType] = useState<'success' | 'error' | ''>('');
  const [subscribing, setSubscribing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const db = getFirestore(app);
        const snapshot = await getDocs(collection(db, 'yardSales'));
        const fetched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<YardSaleRecord, 'id'>) }))
          .filter((sale) => String(sale.yardsalestatus || '').toLowerCase() !== 'cancelled');

        fetched.sort((left, right) => {
          const leftDate = normalizeDate(left.yardsaleDate)?.getTime() ?? 0;
          const rightDate = normalizeDate(right.yardsaleDate)?.getTime() ?? 0;
          return leftDate - rightDate;
        });

        setSales(fetched);
      } catch (error) {
        console.error('Error loading yard sales:', error);
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  const filteredSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return sales.filter((sale) => {
      const title = String(sale.yardsaleTitle || '').toLowerCase();
      const location = getDisplayLocation(sale).toLowerCase();
      const { start, end } = getSaleRange(sale);

      const matchesSearch = !term || title.includes(term) || location.includes(term);
      const matchesFrom = !fromDate || (end && end.toISOString().slice(0, 10) >= fromDate);
      const matchesTo = !toDate || (start && start.toISOString().slice(0, 10) <= toDate);

      return matchesSearch && matchesFrom && matchesTo;
    });
  }, [sales, searchTerm, fromDate, toDate]);

  const buckets = useMemo(() => getBuckets(filteredSales), [filteredSales]);

  const subscribeToDigest = async () => {
    const email = digestEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDigestMessage('Please enter a valid email address.');
      setDigestMessageType('error');
      return;
    }

    try {
      setSubscribing(true);
      setDigestMessage('');
      setDigestMessageType('');

      const db = getFirestore(app);
      const subscriberId = buildYardSaleSubscriberId(email);
      await setDoc(doc(db, 'yardSaleSubscribers', subscriberId), {
        email,
        subscribedAt: serverTimestamp(),
      });

      setDigestMessage('Subscribed! You will receive the weekly yard sale digest.');
      setDigestMessageType('success');
      setDigestEmail('');
    } catch (error) {
      console.error('Yard sale digest subscription error:', error);
      setDigestMessage('Something went wrong. Please try again.');
      setDigestMessageType('error');
    } finally {
      setSubscribing(false);
    }
  };

  const renderSaleCard = (sale: YardSaleRecord) => {
    const timeText = sale.yardsaleStart
      ? `${sale.yardsaleStart}${sale.yardsaleEndtime ? ` - ${sale.yardsaleEndtime}` : ''}`
      : 'Time TBD';

    return (
      <View key={sale.id} style={styles.saleCard}>
        <Text style={styles.saleTitle}>{sale.yardsaleTitle || 'Yard Sale'}</Text>
        <Text style={styles.saleMeta}>Date: {formatDateRange(sale.yardsaleDate, sale.yardsaleEndDate || sale.yardsaleExpires)}</Text>
        <Text style={styles.saleMeta}>Time: {timeText}</Text>
        <Text style={styles.saleMeta}>Location: {getDisplayLocation(sale)}</Text>
        <Text style={styles.saleDescription}>{sale.yardsaleDescription || ''}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackToCommunityHubRow />

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Yard Sales</Text>
          <Text style={styles.heroSubtitle}>Browse local garage and yard sales near you</Text>
        </View>

        <View style={styles.promoRow}>
          <TouchableOpacity style={styles.promoImageLink} onPress={() => router.push('/create-yard-sale' as any)} activeOpacity={0.86}>
            <Image source={require('../../assets/images/yardsale.png')} style={styles.promoImage} resizeMode="cover" />
          </TouchableOpacity>
          <View style={styles.promoTextWrap}>
            <Text style={styles.promoTitle}>Hosting a Yard Sale?</Text>
            <Text style={styles.promoText}>
              Let your neighbors know. Post your yard sale for free and reach shoppers in your area. It only takes a minute to get listed.
            </Text>
            <TouchableOpacity style={styles.promoButton} onPress={() => router.push('/create-yard-sale' as any)} activeOpacity={0.86}>
              <Text style={styles.promoButtonText}>Post Your Yard Sale</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filtersPanel}>
          <Text style={styles.filterLabel}>Search Yard Sales</Text>
          <TextInput
            style={styles.filterInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by title or location"
            placeholderTextColor="#94a3b8"
          />

         </View>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Upcoming Yard Sales</Text>
          {loading ? <Text style={styles.emptyState}>Loading yard sales...</Text> : buckets.upcoming.length ? buckets.upcoming.map(renderSaleCard) : <Text style={styles.emptyState}>No upcoming yard sales found.</Text>}
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Recently Posted</Text>
          {loading ? <Text style={styles.emptyState}>Loading yard sales...</Text> : buckets.recent.length ? buckets.recent.map(renderSaleCard) : <Text style={styles.emptyState}>No recently posted yard sales.</Text>}
        </View>

        <View style={styles.digestBanner}>
          <Text style={styles.digestIcon}>📬</Text>
          <View style={styles.digestBody}>
            <Text style={styles.digestTitle}>Get the Weekly Yard Sale Digest</Text>
            <Text style={styles.digestText}>
              Every week we send a roundup of all upcoming yard sales in your area straight to your inbox.
            </Text>
            <View style={styles.digestForm}>
              <TextInput
                style={styles.digestInput}
                value={digestEmail}
                onChangeText={setDigestEmail}
                placeholder="Enter your email address"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[styles.digestButton, subscribing ? styles.digestButtonDisabled : null]} onPress={subscribeToDigest} activeOpacity={0.86} disabled={subscribing}>
                <Text style={styles.digestButtonText}>{subscribing ? 'Subscribing...' : 'Subscribe'}</Text>
              </TouchableOpacity>
            </View>
            {digestMessage ? <Text style={[styles.digestMessage, digestMessageType === 'success' ? styles.digestMessageSuccess : styles.digestMessageError]}>{digestMessage}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 36,
  },
  hero: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    textAlign: 'center',
  },
  promoRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  promoImageLink: {
    width: '100%',
  },
  promoImage: {
    width: '100%',
    height: 190,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fee2e2',
  },
  promoTextWrap: {
    alignItems: 'center',
  },
  promoTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 8,
    textAlign: 'center',
  },
  promoText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  promoButton: {
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  filtersPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  mapBlock: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  mapPlaceholder: {
    height: 180,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mapPlaceholderText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  mapNote: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  sectionBlock: {
    marginBottom: 22,
  },
  saleCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  saleTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 22,
  },
  saleMeta: {
    color: '#334155',
    fontSize: 13,
    marginBottom: 4,
  },
  saleDescription: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    color: '#64748b',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
  },
  digestBanner: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 22,
    marginBottom: 22,
    alignItems: 'center',
  },
  digestIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  digestBody: {
    width: '100%',
    alignItems: 'center',
  },
  digestTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    color: '#1f2937',
    textAlign: 'center',
  },
  digestText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  digestForm: {
    width: '100%',
    gap: 8,
  },
  digestInput: {
    width: '100%',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  digestButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#475569',
    alignItems: 'center',
  },
  digestButtonDisabled: {
    opacity: 0.6,
  },
  digestButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  digestMessage: {
    fontSize: 13,
    marginTop: 8,
    minHeight: 18,
    textAlign: 'center',
  },
  digestMessageSuccess: {
    color: '#15803d',
  },
  digestMessageError: {
    color: '#b91c1c',
  },
});
