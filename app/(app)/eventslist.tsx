import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { app } from '../../firebase';

type EventRecord = {
  id: string;
  userId?: string;
  contactEmail?: string;
  eventImage?: string;
  eventTitle?: string;
  eventDescription?: string;
  eventDate?: unknown;
  eventEndDate?: unknown;
  eventStarttime?: string;
  eventEndtime?: string;
  eventAdress?: string;
  eventCity?: string;
  eventState?: string;
  eventZipcode?: string;
  eventCategory?: string;
  eventStatus?: string;
};

const DEFAULT_CATEGORIES = ['Community', 'Family', 'Food', 'Music', 'Sports', 'Business', 'Charity'];

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }

  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseInputDate(value: string): Date | null {
  const s = String(value || '').trim();
  if (!s) return null;

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year
      && parsed.getMonth() === month - 1
      && parsed.getDate() === day
    ) {
      return parsed;
    }
    return null;
  }

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!usMatch) return null;

  const month = Number(usMatch[1]);
  const day = Number(usMatch[2]);
  const yearPart = usMatch[3];
  const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  ) {
    return parsed;
  }

  return null;
}

function formatDate(dateValue: unknown): string {
  const date = normalizeDate(dateValue);
  if (!date) return '';
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

  if (!startDate && !endDate) return '';
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);

  const startText = formatDate(startDate as Date);
  const endText = formatDate(endDate as Date);
  if (startText === endText) return startText;
  return `${startText} - ${endText}`;
}

function getEventRange(eventItem: EventRecord): { start: Date | null; end: Date | null } {
  const start = normalizeDate(eventItem.eventDate);
  const end = normalizeDate(eventItem.eventEndDate || eventItem.eventDate);

  if (start && end && end < start) {
    return { start, end: start };
  }

  return { start, end: end || start };
}

function buildEventDigestSubscriberId(email: string, frequency: 'weekly' | 'monthly'): string {
  return `${encodeURIComponent(email.trim().toLowerCase())}__${frequency}`;
}

function getDateBuckets(events: EventRecord[]) {
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfWeek = new Date(startToday);
  endOfWeek.setDate(startToday.getDate() + (7 - startToday.getDay()));

  const endOfMonth = new Date(startToday.getFullYear(), startToday.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);

  const buckets = {
    week: [] as EventRecord[],
    month: [] as EventRecord[],
    upcoming: [] as EventRecord[],
  };

  for (const eventItem of events) {
    const { start, end } = getEventRange(eventItem);
    if (!start || !end) continue;

    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (endDay < startToday) continue;

    if (startDay <= endOfWeek && endDay >= startToday) {
      buckets.week.push(eventItem);
    } else if (startDay <= endOfMonth && endDay >= startToday) {
      buckets.month.push(eventItem);
    } else {
      buckets.upcoming.push(eventItem);
    }
  }

  return buckets;
}

export default function EventsListScreen() {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 920;
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [digestEmail, setDigestEmail] = useState('');
  const [digestMessage, setDigestMessage] = useState('');
  const [digestMessageType, setDigestMessageType] = useState<'success' | 'error' | ''>('');
  const [subscribing, setSubscribing] = useState(false);
  const [savedEventIds, setSavedEventIds] = useState<string[]>([]);
  const [savingEventId, setSavingEventId] = useState('');
  const router = useRouter();
  const isMountedRef = useRef(true);

  useEffect(() => {
    console.log('[EventsList] mounted');
    return () => {
      console.log('[EventsList] unmounted');
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
      try {
        const db = getFirestore(app);
        const snapshot = await getDocs(collection(db, 'events'));
        const fetched = snapshot.docs
          .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<EventRecord, 'id'>) }))
          .filter((eventItem) => String(eventItem.eventStatus || '').toLowerCase() !== 'cancelled');

        fetched.sort((left, right) => {
          const leftDate = normalizeDate(left.eventDate)?.getTime() ?? 0;
          const rightDate = normalizeDate(right.eventDate)?.getTime() ?? 0;
          return leftDate - rightDate;
        });

        if (!cancelled) {
          setEvents(fetched);
        }
      } catch (error) {
        console.error('Error loading events:', error);
        if (!cancelled) {
          setEvents([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchSavedEvents = async () => {
      const currentUser = getAuth().currentUser;
      if (!currentUser?.uid) {
        if (!cancelled) {
          setSavedEventIds([]);
        }
        return;
      }

      try {
        const db = getFirestore(app);
        const snapshot = await getDocs(query(collection(db, 'saveListings'), where('userId', '==', currentUser.uid)));
        const ids = snapshot.docs
          .map((docSnap) => docSnap.data() as { listingId?: string; listingType?: string })
          .filter((item) => item.listingType === 'event' && typeof item.listingId === 'string' && item.listingId)
          .map((item) => item.listingId as string);
        if (!cancelled) {
          setSavedEventIds(ids);
        }
      } catch (error) {
        console.error('Error loading saved events:', error);
        if (!cancelled) {
          setSavedEventIds([]);
        }
      }
    };

    fetchSavedEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const dynamic = new Set<string>();
    events.forEach((eventItem) => {
      const category = String(eventItem.eventCategory || '').trim();
      if (category) dynamic.add(category);
    });

    const merged = new Set<string>([...DEFAULT_CATEGORIES, ...Array.from(dynamic)]);
    return Array.from(merged);
  }, [events]);

  const categoryOptionsWithAll = useMemo(() => ['All Categories', ...categoryOptions], [categoryOptions]);

  useEffect(() => {
    setCategoryDropdownOpen(false);
  }, [selectedCategory]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const selectedDay = parseInputDate(selectedDate);

    return events.filter((eventItem) => {
      const title = String(eventItem.eventTitle || '').toLowerCase();
      const city = String(eventItem.eventCity || '').toLowerCase();
      const description = String(eventItem.eventDescription || '').toLowerCase();
      const eventCategory = String(eventItem.eventCategory || '').trim();
      const { start, end } = getEventRange(eventItem);

      const matchesSearch =
        !normalizedSearch
        || title.includes(normalizedSearch)
        || city.includes(normalizedSearch)
        || description.includes(normalizedSearch);

      const matchesCategory = !selectedCategory || eventCategory === selectedCategory;

      const matchesDate =
        !selectedDate
        || (selectedDay && start && end && start <= selectedDay && end >= selectedDay);

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [events, searchTerm, selectedCategory, selectedDate]);

  const buckets = useMemo(() => getDateBuckets(filteredEvents), [filteredEvents]);

  const subscribeToDigest = async () => {
    const email = digestEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDigestMessage('Please enter a valid email address.');
      setDigestMessageType('error');
      return;
    }

    const frequencies: ('weekly' | 'monthly')[] = ['monthly', 'weekly'];

    try {
      setSubscribing(true);
      setDigestMessage('');
      setDigestMessageType('');

      const db = getFirestore(app);
      await Promise.all(
        frequencies.map((frequency) => {
          const subscriberId = buildEventDigestSubscriberId(email, frequency);
          return setDoc(doc(db, 'eventDigestSubscribers', subscriberId), {
            email,
            frequency,
            subscribedAt: serverTimestamp(),
          });
        })
      );

      if (!isMountedRef.current) return;
      setDigestMessage('Subscribed! You will receive monthly and weekly event digest updates.');
      setDigestMessageType('success');
      setDigestEmail('');
    } catch (error) {
      console.error('Events digest subscription error:', error);
      if (!isMountedRef.current) return;
      setDigestMessage('Something went wrong. Please try again.');
      setDigestMessageType('error');
    } finally {
      if (isMountedRef.current) {
        setSubscribing(false);
      }
    }
  };

  const submitEventReport = async (eventItem: EventRecord, reason: string) => {
    const currentUser = getAuth().currentUser;

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to report listings.');
      return;
    }

    if (eventItem.userId && eventItem.userId === currentUser.uid) {
      Alert.alert('Not allowed', 'You cannot report your own listing.');
      return;
    }

    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'reportedListings'), {
        listingId: eventItem.id,
        listingType: 'event',
        listingTitle: eventItem.eventTitle || 'Event listing',
        listingImage: '',
        sellerId: eventItem.userId || '',
        sellerEmail: eventItem.contactEmail || '',
        reportedBy: currentUser.uid,
        reason,
        details: 'Reported from events list screen',
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      Alert.alert('Report submitted', 'Thanks. Our moderators will review this listing.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    }
  };

  const handleReportEvent = (eventItem: EventRecord) => {
    Alert.alert('Report Listing', 'Why are you reporting this event listing?', [
      { text: 'Spam', onPress: () => submitEventReport(eventItem, 'spam') },
      { text: 'Scam/Fraud', onPress: () => submitEventReport(eventItem, 'scam') },
      { text: 'Inappropriate Content', onPress: () => submitEventReport(eventItem, 'inappropriate_content') },
      { text: 'Misleading Information', onPress: () => submitEventReport(eventItem, 'misleading_content') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const toggleSaveEvent = async (eventItem: EventRecord) => {
    const currentUser = getAuth().currentUser;

    if (!currentUser) {
      Alert.alert('Sign in required', 'Please sign in to save listings.');
      return;
    }

    if (savingEventId) return;

    const isSaved = savedEventIds.includes(eventItem.id);
    const saveDocId = `${currentUser.uid}_event_${eventItem.id}`;

    try {
      setSavingEventId(eventItem.id);
      const db = getFirestore(app);

      if (isSaved) {
        await deleteDoc(doc(db, 'saveListings', saveDocId));
        if (!isMountedRef.current) return;
        setSavedEventIds((prev) => prev.filter((id) => id !== eventItem.id));
        return;
      }

      await setDoc(doc(db, 'saveListings', saveDocId), {
        listingId: eventItem.id,
        listingType: 'event',
        userId: currentUser.uid,
        title: eventItem.eventTitle || 'Event',
        description: eventItem.eventDescription || '',
        image: null,
        city: eventItem.eventCity || '',
        category: eventItem.eventCategory || 'Event',
        eventDate: eventItem.eventDate || null,
        eventEndDate: eventItem.eventEndDate || eventItem.eventDate || null,
        eventStarttime: eventItem.eventStarttime || '',
        eventEndtime: eventItem.eventEndtime || '',
        savedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      if (!isMountedRef.current) return;
      setSavedEventIds((prev) => (prev.includes(eventItem.id) ? prev : [...prev, eventItem.id]));
      Alert.alert('Listing Saved', 'You can view saved listings from your profile.');
    } catch (error) {
      console.error('Error saving event listing:', error);
      Alert.alert('Error', 'Could not save listing. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setSavingEventId('');
      }
    }
  };

  const renderEventCard = (eventItem: EventRecord) => (
    <View key={eventItem.id} style={[styles.eventCard, isWideLayout ? styles.eventCardWide : null]}>
      <View style={[styles.eventMediaWrap, isWideLayout ? styles.eventMediaWrapWide : null]}>
        {eventItem.eventImage ? (
          <Image source={{ uri: eventItem.eventImage }} style={styles.eventMediaImage} contentFit="cover" />
        ) : (
          <View style={[styles.eventMediaImage, styles.eventMediaPlaceholder]}>
            <Text style={styles.eventMediaPlaceholderText}>🎉</Text>
          </View>
        )}
      </View>

      <View style={[styles.eventBody, isWideLayout ? styles.eventBodyWide : null]}>
        {/** Save/unsave uses the shared saveListings collection with listingType='event'. */}
        <Text style={styles.eventTitle}>{eventItem.eventTitle || 'Event'}</Text>
        {!!formatDateRange(eventItem.eventDate, eventItem.eventEndDate) && (
          <Text style={styles.eventMeta}>{formatDateRange(eventItem.eventDate, eventItem.eventEndDate)}</Text>
        )}
        {!!(eventItem.eventCity || eventItem.eventState) && (
          <Text style={styles.eventMeta}>
            {eventItem.eventCity || ''}
            {eventItem.eventState ? `${eventItem.eventCity ? ', ' : ''}${eventItem.eventState}` : ''}
          </Text>
        )}
        {!!(eventItem.eventStarttime || eventItem.eventEndtime) && (
          <Text style={styles.eventMeta}>
            {eventItem.eventStarttime || ''}
            {eventItem.eventEndtime ? `${eventItem.eventStarttime ? ' - ' : ''}${eventItem.eventEndtime}` : ''}
          </Text>
        )}
        {!!eventItem.eventDescription && <Text style={styles.eventDescription}>{eventItem.eventDescription}</Text>}
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={[styles.saveButton, savedEventIds.includes(eventItem.id) ? styles.saveButtonSaved : null]}
            activeOpacity={0.86}
            disabled={savingEventId === eventItem.id}
            onPress={() => toggleSaveEvent(eventItem)}
          >
            <Text style={[styles.saveButtonText, savedEventIds.includes(eventItem.id) ? styles.saveButtonTextSaved : null]}>
              {savedEventIds.includes(eventItem.id) ? 'Saved' : 'Save Listing'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reportButton}
            activeOpacity={0.86}
            onPress={() => handleReportEvent(eventItem)}
          >
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      

        <View style={styles.screenTitleRowWrap}>
          <ScreenTitleRow
            title="Events"
            onBackPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace('/(tabs)/communitybutton');
            }}
          />
        </View>

        <View style={styles.benefitsRow}>
          <Image
            source={require('../../assets/images/eventshub.png')}
            style={styles.benefitsImage}
            contentFit="cover"
          />
          <View style={styles.benefitsContent}>
            <Text style={styles.benefitsTitle}>Promote Your Next Event Locally</Text>
            <Text style={styles.benefitsText}>
              Hosting something in the community? Post your event on Local List to reach local attendees, share key details in one place, and help more people discover what is happening.
            </Text>
            <TouchableOpacity style={styles.benefitsCta} onPress={() => router.push('/create-event-listing' as any)} activeOpacity={0.86}>
              <Text style={styles.benefitsCtaText}>+ Post Your Event</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filtersPanel}>
          <Text style={styles.filterLabel}>Search Events</Text>
          <TextInput
            style={styles.filterInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by title, city, or keyword"
            placeholderTextColor="#94a3b8"
          />

          <Text style={[styles.filterLabel, { marginTop: 10 }]}>Filter by Category</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setCategoryDropdownOpen((prev) => !prev)}
            activeOpacity={0.86}
          >
            <Text style={styles.dropdownButtonText}>{selectedCategory || 'All Categories'}</Text>
            <Text style={styles.dropdownChevron}>{categoryDropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {categoryDropdownOpen ? (
            <View style={styles.dropdownMenu}>
              <ScrollView nestedScrollEnabled style={styles.dropdownScroll}>
                {categoryOptionsWithAll.map((category) => {
                  const active = (!selectedCategory && category === 'All Categories') || selectedCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.dropdownItem, active ? styles.dropdownItemActive : null]}
                      onPress={() => setSelectedCategory(category === 'All Categories' ? '' : category)}
                      activeOpacity={0.86}
                    >
                      <Text style={[styles.dropdownItemText, active ? styles.dropdownItemTextActive : null]}>{category}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
     
        </View>
                <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {loading ? <Text style={styles.emptyState}>Loading events...</Text> : buckets.upcoming.length ? buckets.upcoming.map(renderEventCard) : <Text style={styles.emptyState}>No upcoming events found yet.</Text>}
        </View>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>This Month</Text>
          {loading ? <Text style={styles.emptyState}>Loading events...</Text> : buckets.month.length ? buckets.month.map(renderEventCard) : <Text style={styles.emptyState}>No additional events found this month.</Text>}
        </View>
        <View style={styles.digestBanner}>
          <Text style={styles.digestIcon}>📬</Text>
          <View style={styles.digestBody}>
            <Text style={styles.digestTitle}>Get Events Digest Updates</Text>
            <Text style={styles.digestText}>Subscribe once to receive both monthly and weekly event roundups so you never miss what is happening locally.</Text>
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
              <TouchableOpacity
                style={[styles.digestButton, subscribing ? styles.digestButtonDisabled : null]}
                activeOpacity={0.86}
                onPress={subscribeToDigest}
                disabled={subscribing}
              >
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
    paddingBottom: 64,
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
  benefitsRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    padding: 8,
    marginBottom: 18,
  },
  benefitsImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#64748b',
  },
  benefitsContent: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
    textAlign: 'center',
  },
  benefitsText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 10,
  },
  benefitsCta: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  benefitsCtaText: {
    fontSize: 13,
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
  dropdownButton: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  dropdownButtonText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 220,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemActive: {
    backgroundColor: '#e8f5f3',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  dropdownItemTextActive: {
    color: '#0f766e',
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#64748b',
    backgroundColor: '#fff',
  },
  eventCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  eventCardWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 10,
  },
  eventMediaWrap: {
    width: '100%',
    marginBottom: 10,
  },
  eventMediaWrapWide: {
    width: 220,
    marginBottom: 0,
    marginRight: 12,
  },
  eventMediaImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  eventMediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfeff',
  },
  eventMediaPlaceholderText: {
    fontSize: 44,
  },
  eventBody: {
    flex: 1,
  },
  eventBodyWide: {
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  eventMeta: {
    color: '#334155',
    fontSize: 13,
    marginBottom: 4,
  },
  eventDescription: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  eventActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  saveButton: {
    borderRadius: 10,
    backgroundColor: '#1e3a5f',
    paddingVertical: 9,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonSaved: {
    backgroundColor: '#e2e8f0',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  saveButtonTextSaved: {
    color: '#334155',
  },
  reportButton: {
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
  },
  digestBanner: {
    marginTop: 8,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  digestIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  digestBody: {
    alignItems: 'center',
  },
  digestTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  digestText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
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
    backgroundColor: '#0f172a',
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
